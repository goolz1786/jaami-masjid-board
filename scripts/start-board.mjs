import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
let hasEnvFile = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--env-file' && args[index + 1]) {
    hasEnvFile = true;
    args[index + 1] = resolve(args[index + 1]);
    index++;
  } else if (args[index].startsWith('--env-file=')) {
    hasEnvFile = true;
    args[index] =
      `--env-file=${resolve(args[index].slice('--env-file='.length))}`;
  }
}
if (!hasEnvFile) args.push('--env-file', resolve(root, '.env'));

// Use Node directly instead of shell command interpolation, on every platform.
const wrangler = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);
const child = spawn(
  process.execPath,
  [wrangler, 'dev', '--config', 'dist/server/wrangler.json', ...args],
  {
    stdio: 'inherit',
    cwd: root,
    env: {
      ...process.env,
      X_LOCAL_EXPLORER: 'false',
      X_LOCAL_OBSERVABILITY: 'false',
    },
  },
);
child.on('error', (error) => {
  console.error('Board could not start:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
