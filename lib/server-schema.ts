import { env } from 'cloudflare:workers';
import { upgradeSchema } from './schema-upgrade';

let schemaReady: Promise<void> | undefined;

export function ensureSchema() {
  schemaReady ??= upgradeSchema(env.DB).catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}
