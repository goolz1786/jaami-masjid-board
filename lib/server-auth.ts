import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { ensureSchema } from './server-schema';
import { hashPassword, verifyPassword } from './password';
import { rootUsername } from './root-admin';
import {
  requireBootstrapPassword,
  requireSessionSecret,
} from './security-config';

const COOKIE_NAME = 'masjid_admin_session';
const SESSION_HOURS = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 5;
const encoder = new TextEncoder();

const sessionSecret = () => requireSessionSecret(env.SESSION_SECRET);

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
      await hashPassword(requireBootstrapPassword(env.ADMIN_PASSWORD)),
      timestamp,
      timestamp,
      'admin',
      1,
    )
    .run();
}

export async function login(username: string, password: string, secure = true) {
  sessionSecret();
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > 128 ||
    password.length > 1024
  )
    return false;
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
  const attemptKey = user?.active ? `user:${user.id}` : 'unknown';
  const timestamp = Date.now();
  const attempts = await env.DB.prepare(
    `INSERT INTO login_attempts (account_key,attempts,window_started_at) VALUES (?,1,?)
     ON CONFLICT(account_key) DO UPDATE SET
       attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END,
       window_started_at = CASE WHEN window_started_at <= ? THEN ? ELSE window_started_at END
     RETURNING attempts`,
  )
    .bind(
      attemptKey,
      timestamp,
      timestamp - LOGIN_WINDOW_MS,
      timestamp - LOGIN_WINDOW_MS,
      timestamp,
    )
    .first<{ attempts: number }>();
  if (!attempts || attempts.attempts > LOGIN_ATTEMPTS || !user || !user.active)
    return false;
  const verification = await verifyPassword(
    user.password_hash,
    password,
    legacyPasswordSalts(),
  );
  if (!verification.valid) return false;
  await env.DB.prepare('DELETE FROM login_attempts WHERE account_key=?')
    .bind(attemptKey)
    .run();
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
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .bind(new Date().toISOString())
    .run();
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
