import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('npm startup forces local management surfaces off and preserves arguments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'board-startup-test-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, '.env'), '# disposable startup fixture\n');
    mkdirSync(join(dir, 'node_modules/wrangler/bin'), { recursive: true });
    copyFileSync(
      resolve('scripts/start-board.mjs'),
      join(dir, 'scripts/start-board.mjs'),
    );
    writeFileSync(
      join(dir, 'node_modules/wrangler/bin/wrangler.js'),
      'console.log(JSON.stringify({explorer:process.env.X_LOCAL_EXPLORER,observability:process.env.X_LOCAL_OBSERVABILITY,args:process.argv.slice(2)}))',
    );
    const result = spawnSync(
      process.execPath,
      [join(dir, 'scripts/start-board.mjs'), '--port', '4312'],
      {
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          X_LOCAL_EXPLORER: 'true',
          X_LOCAL_OBSERVABILITY: 'true',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      explorer: 'false',
      observability: 'false',
      args: [
        'dev',
        '--config',
        'dist/server/wrangler.json',
        '--port',
        '4312',
        '--env-file',
        join(dir, '.env'),
      ],
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
