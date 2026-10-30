import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';

it('Docker credentials stay literal and unrelated process secrets are excluded', () => {
  const root = mkdtempSync(join(tmpdir(), 'board-env-test-'));
  try {
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/write-runtime-env.mjs')],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          TMPDIR: root,
          TMP: root,
          TEMP: root,
          ADMIN_PASSWORD: 'literal$HOME\\path"password',
          SESSION_SECRET: 'test-secret-that-is-long-enough-for-config',
          UNRELATED_SECRET: 'never-forward-this-value',
        },
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(resolve(result.stdout).startsWith(resolve(root) + sep)).toBe(true);
    const contents = readFileSync(result.stdout, 'utf8');
    expect(contents).toContain(
      "ADMIN_PASSWORD='literal\\$HOME\\path\"password'",
    );
    expect(contents).not.toContain('never-forward-this-value');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
