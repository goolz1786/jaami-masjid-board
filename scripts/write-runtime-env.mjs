import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dotenvValue } from './dotenv-value.mjs';

// Docker's environment is not automatically a Wrangler worker binding.
// Pass only the application's credentials, never the entire process environment.
const directory = mkdtempSync(join(tmpdir(), 'board-runtime-env-'));
const path = join(directory, 'board.env');
const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
writeFileSync(
  path,
  keys
    .filter((key) => process.env[key] !== undefined)
    .map((key) => `${key}=${dotenvValue(process.env[key])}`)
    .join('\n'),
  { mode: 0o600 },
);
process.stdout.write(path);
