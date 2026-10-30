import { env } from 'cloudflare:workers';

const FALLBACK = 'admin';

export function rootUsername() {
  const username = env.ADMIN_USERNAME ?? FALLBACK;
  if (
    !username.trim() ||
    username.length > 128 ||
    ['\r', '\n', '\0'].some((character) => username.includes(character))
  )
    throw new Error(
      'Configure ADMIN_USERNAME with a nonempty username of at most 128 characters.',
    );
  return username.trim();
}
