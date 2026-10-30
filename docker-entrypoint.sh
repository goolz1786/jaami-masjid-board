#!/bin/sh
set -eu
export X_LOCAL_EXPLORER=false
export X_LOCAL_OBSERVABILITY=false
node scripts/migrate-board.mjs --persist-to /data
if [ -f /run/board.env ]; then
  runtime_env=/run/board.env
else
  runtime_env="$(node scripts/write-runtime-env.mjs)"
fi
exec node scripts/start-board.mjs --env-file "$runtime_env" --ip 0.0.0.0 --port 3000 --persist-to /data
