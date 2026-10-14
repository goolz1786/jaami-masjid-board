const CURRENT_ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const encoder = new TextEncoder();

export type PasswordVerification = {
  valid: boolean;
  needsRehash: boolean;
};

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const normalized = hex.length % 2 ? `0${hex}` : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16,
    );
  return bytes;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1)
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, CURRENT_ITERATIONS);
  return `pbkdf2$sha256$${CURRENT_ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(
  stored: string,
  password: string,
  legacySalts: string | string[],
): Promise<PasswordVerification> {
  if (stored.startsWith('pbkdf2$')) {
    const [scheme, algorithm, iterationText, saltHex, expected] =
      stored.split('$');
    if (scheme !== 'pbkdf2' || algorithm !== 'sha256')
      return { valid: false, needsRehash: false };
    const iterations = Number.parseInt(iterationText ?? '', 10);
    if (
      !Number.isInteger(iterations) ||
      iterations <= 0 ||
      !saltHex ||
      !expected
    )
      return { valid: false, needsRehash: false };
    const derived = await derive(password, fromHex(saltHex), iterations);
    return { valid: constantTimeEqual(derived, expected), needsRehash: false };
  }
  const salts = Array.isArray(legacySalts) ? legacySalts : [legacySalts];
  for (const salt of salts) {
    const salted = encoder.encode(salt);
    const current = await derive(password, salted, CURRENT_ITERATIONS);
    if (constantTimeEqual(current, stored))
      return { valid: true, needsRehash: true };
    const legacy = await derive(password, salted, LEGACY_ITERATIONS);
    if (constantTimeEqual(legacy, stored))
      return { valid: true, needsRehash: true };
  }
  return { valid: false, needsRehash: true };
}

export const passwordIterations = {
  current: CURRENT_ITERATIONS,
  legacy: LEGACY_ITERATIONS,
} as const;
