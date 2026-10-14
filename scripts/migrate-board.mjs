import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (
    !['--persist-to', '--config'].includes(process.argv[i]) ||
    !process.argv[i + 1]
  ) {
    throw new Error(
      'Usage: node scripts/migrate-board.mjs --persist-to PATH [--config PATH]',
    );
  }
  options.set(process.argv[i], process.argv[i + 1]);
}
const persist = resolve(root, options.get('--persist-to') ?? '.board-data');
const config = resolve(root, options.get('--config') ?? 'wrangler.local.jsonc');
const temporary = mkdtempSync(join(tmpdir(), 'jaami-schema-'));

function execute(sql) {
  const file = join(temporary, 'upgrade.sql');
  writeFileSync(file, sql, 'utf8');
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1',
      'execute',
      'site-creator-d1',
      '--local',
      '--config',
      config,
      '--persist-to',
      persist,
      '--file',
      file,
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Database upgrade failed: ${result.stderr || result.stdout}`,
    );
  const results = JSON.parse(result.stdout);
  if (!Array.isArray(results) || results.some((item) => !item.success))
    throw new Error('Database upgrade did not report success.');
  return results;
}

const prepare = (sql) => ({
  sql,
  async all() {
    return execute(sql)[0];
  },
  async run() {
    return execute(sql)[0];
  },
});

try {
  // Compile the same pure schema upgrader used by the server. Do not replay
  // historical ALTER/DROP migrations against a runtime-upgraded database.
  const source = readFileSync(join(root, 'lib/schema-upgrade.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const { upgradeSchema } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
  await upgradeSchema({
    prepare,
    async batch(statements) {
      if (!statements.length) return [];
      return execute(
        statements.map((statement) => `${statement.sql};`).join('\n'),
      );
    },
  });
  console.log(
    'Database schema ready. Existing credentials, content and legacy schedules retained.',
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
