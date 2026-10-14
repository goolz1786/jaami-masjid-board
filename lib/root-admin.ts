import { env } from 'cloudflare:workers';

const FALLBACK = 'admin';

export function rootUsername() {
  return env.ADMIN_USERNAME ?? FALLBACK;
}
