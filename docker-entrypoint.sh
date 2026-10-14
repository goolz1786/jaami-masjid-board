#!/bin/sh
set -eu
node scripts/migrate-board.mjs --persist-to /data
exec npx wrangler dev --config dist/server/wrangler.json --ip 0.0.0.0 --port 3000 --persist-to /data
