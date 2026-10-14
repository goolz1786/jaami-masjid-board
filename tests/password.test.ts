import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  hashPassword,
  passwordIterations,
  verifyPassword,
} from '../lib/password';

const LEGACY_SALT = 'jaami-masjid:test-secret';

async function legacyHash(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

describe('password hashing', () => {
  it('round-trips a new-format hash and reports no rehash needed', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('pbkdf2$sha256$')).toBe(true);
    const result = await verifyPassword(
      stored,
      'correct horse battery staple',
      LEGACY_SALT,
    );
    expect(result).toEqual({ valid: true, needsRehash: false });
  });

  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('right-password');
    const result = await verifyPassword(stored, 'wrong-password', LEGACY_SALT);
    expect(result).toEqual({ valid: false, needsRehash: false });
  });

  it('uses a unique salt for every hash', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
  });

  it('verifies a legacy hash and asks for a rehash', async () => {
    const stored = await legacyHash(
      'legacy-password',
      LEGACY_SALT,
      passwordIterations.current,
    );
    const result = await verifyPassword(stored, 'legacy-password', LEGACY_SALT);
    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it('verifies the older 210k-iteration legacy hash', async () => {
    const stored = await legacyHash(
      'ancient-password',
      LEGACY_SALT,
      passwordIterations.legacy,
    );
    const result = await verifyPassword(stored, 'ancient-password', LEGACY_SALT);
    expect(result).toEqual({ valid: true, needsRehash: true });
  });

  it('rejects a legacy hash when the password is wrong', async () => {
    const stored = await legacyHash(
      'legacy-password',
      LEGACY_SALT,
      passwordIterations.current,
    );
    const result = await verifyPassword(stored, 'other-password', LEGACY_SALT);
    expect(result).toEqual({ valid: false, needsRehash: true });
  });

  it('verifies a legacy hash created before the secret was configured', async () => {
    const stored = await legacyHash(
      'changeme',
      'jaami-masjid:development-only-change-me',
      passwordIterations.legacy,
    );
    const result = await verifyPassword(stored, 'changeme', [
      'jaami-masjid:rotated-secret',
      'jaami-masjid:development-only-change-me',
    ]);
    expect(result).toEqual({ valid: true, needsRehash: true });
  });
});

describe('constantTimeEqual', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(constantTimeEqual('abcdef', 'abcdef')).toBe(true);
    expect(constantTimeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(constantTimeEqual('abcdef', 'abcde')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
