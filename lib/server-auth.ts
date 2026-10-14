import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { ensureSchema } from './server-schema';
import { hashPassword, verifyPassword } from './password';
import { rootUsername } from './root-admin';

const COOKIE_NAME = 'masjid_admin_session';
const SESSION_HOURS = 12;
const encoder = new TextEncoder();

const sessionSecret = () => env.SESSION_SECRET ?? 'development-only-change-me';

const legacyPasswordSalts = () =>
  Array.from(
    new Set([
      `jaami-masjid:${sessionSecret()}`,
      'jaami-masjid:development-only-change-me',
    ]),
  );

async function sessionDigest(id: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(id));
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

async function ensureBootstrapAdmin() {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM users WHERE username=?',
  )
    .bind(rootUsername())
    .first<{ count: number }>();
  if (Number(row?.count ?? 0) > 0) return;
  const timestamp = new Date().toISOString();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (username,password_hash,created_at,updated_at,role,active) VALUES (?,?,?,?,?,?)',
  )
    .bind(
      rootUsername(),
      await hashPassword(env.ADMIN_PASSWORD ?? 'changeme'),
      timestamp,
      timestamp,
      'admin',
      1,
    )
    .run();
}

export async function login(username: string, password: string, secure = true) {
  await ensureSchema();
  await ensureBootstrapAdmin();
  const user = await env.DB.prepare(
    'SELECT id,username,password_hash,active FROM users WHERE username=?',
  )
    .bind(username)
    .first<{
      id: number;
      username: string;
      password_hash: string;
      active: number;
    }>();
  if (!user || !user.active) return false;
  const verification = await verifyPassword(
    user.password_hash,
    password,
    legacyPasswordSalts(),
  );
  if (!verification.valid) return false;
  let verifiedHash = user.password_hash;
  if (verification.needsRehash) {
    verifiedHash = await hashPassword(password);
    await env.DB.prepare(
      'UPDATE users SET password_hash=?,updated_at=? WHERE id=? AND password_hash=? AND active=1',
    )
      .bind(verifiedHash, new Date().toISOString(), user.id, user.password_hash)
      .run();
  }
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const created = await env.DB.prepare(
    'INSERT INTO sessions (id,username,expires_at,created_at,user_id) SELECT ?,username,?,?,id FROM users WHERE id=? AND active=1 AND password_hash=?',
  )
    .bind(
      await sessionDigest(id),
      expires.toISOString(),
      new Date().toISOString(),
      user.id,
      verifiedHash,
    )
    .run();
  if (!created.meta.changes) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    expires,
  });
  return true;
}

export async function currentUsername() {
  return (await currentUser())?.username ?? null;
}

export async function currentUser() {
  try {
    await ensureSchema();
    const jar = await cookies();
    const id = jar.get(COOKIE_NAME)?.value;
    if (!id) return null;
    const row = await env.DB.prepare(
      'SELECT u.id,u.username,u.role,u.active,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND u.active=1',
    )
      .bind(await sessionDigest(id))
      .first<{
        id: number;
        username: string;
        role: 'admin' | 'editor';
        active: number;
        expires_at: string;
      }>();
    if (
      !row ||
      new Date(row.expires_at).getTime() <= Date.now() ||
      !Number.isFinite(new Date(row.expires_at).getTime())
    )
      return null;
    return {
      id: row.id,
      username: row.username,
      role: row.role,
      active: row.active,
    };
  } catch {
    return null;
  }
}

export async function isAuthenticated() {
  return Boolean(await currentUser());
}

export async function logout() {
  await ensureSchema();
  const jar = await cookies();
  const id = jar.get(COOKIE_NAME)?.value;
  if (id)
    await env.DB.prepare('DELETE FROM sessions WHERE id=?')
      .bind(await sessionDigest(id))
      .run();
  jar.delete(COOKIE_NAME);
}
