import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from './helpers/sqlite-d1';

const fixture = vi.hoisted(() => ({
  env: {
    DB: undefined as unknown as D1Database,
    ADMIN_USERNAME: 'root',
    SESSION_SECRET: 'test-secret-long-enough-for-regression-testing',
  },
  cookie: 'test-session',
  jar: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));
vi.mock('cloudflare:workers', () => ({ env: fixture.env }));
vi.mock('next/headers', () => ({ cookies: async () => fixture.jar }));

let store: ReturnType<typeof sqliteD1>;
let auth: typeof import('../lib/server-auth');
let data: typeof import('../lib/server-data');

beforeEach(async () => {
  vi.resetModules();
  store = sqliteD1();
  fixture.env.DB = store.db;
  fixture.jar.get.mockReturnValue({ value: fixture.cookie });
  auth = await import('../lib/server-auth');
  data = await import('../lib/server-data');
  const { ensureSchema } = await import('../lib/server-schema');
  await ensureSchema();
  store.sqlite
    .exec(`INSERT INTO users (id,username,password_hash,created_at,updated_at,role,active)
    VALUES (1,'root','hash','now','now','admin',1),(2,'editor','hash','now','now','editor',1)`);
  // Older versions lack user_id; that is itself the reviewed regression.
  const columns = store.sqlite.prepare('PRAGMA table_info(sessions)').all() as {
    name: string;
  }[];
  const hasUserId = columns.some((column) => column.name === 'user_id');
  const digest = createHmac('sha256', fixture.env.SESSION_SECRET)
    .update(fixture.cookie)
    .digest('hex');
  store.sqlite
    .prepare(
      `INSERT INTO sessions (id,username,expires_at,created_at${hasUserId ? ',user_id' : ''}) VALUES (?,?,?,?${hasUserId ? ',?' : ''})`,
    )
    .run(
      digest,
      'editor',
      new Date(Date.now() + 60000).toISOString(),
      'now',
      ...(hasUserId ? [2] : []),
    );
});
afterEach(() => store.sqlite.close());

describe('session lifecycle', () => {
  it('refuses login with a missing or placeholder session secret', async () => {
    const original = fixture.env.SESSION_SECRET;
    try {
      for (const value of [
        '',
        'development-only-change-me',
        'replace-with-a-long-random-value',
      ]) {
        fixture.env.SESSION_SECRET = value;
        await expect(auth.login('root', 'anything', false)).rejects.toThrow(
          /SESSION_SECRET/,
        );
      }
    } finally {
      fixture.env.SESSION_SECRET = original;
    }
  });
  it('does not bootstrap a default-password administrator', async () => {
    store.sqlite.exec('DELETE FROM users');
    await expect(auth.login('root', 'changeme', false)).rejects.toThrow(
      /ADMIN_PASSWORD/,
    );
    expect(
      store.sqlite.prepare('SELECT COUNT(*) AS count FROM users').get()?.count,
    ).toBe(0);
  });
  it('temporarily limits repeated password guesses for an account', async () => {
    const { hashPassword } = await import('../lib/password');
    const hash = await hashPassword('correct-test-password');
    store.sqlite
      .prepare('UPDATE users SET password_hash=? WHERE id=2')
      .run(hash);
    for (let i = 0; i < 5; i++)
      expect(await auth.login('editor', 'incorrect', false)).toBe(false);
    expect(await auth.login('editor', 'correct-test-password', false)).toBe(
      false,
    );
    store.sqlite
      .prepare('UPDATE login_attempts SET window_started_at=?')
      .run(Date.now() - 16 * 60 * 1000);
    expect(await auth.login('editor', 'correct-test-password', false)).toBe(
      true,
    );
  });
  it('creates a working session bound to the current user ID on sign-in', async () => {
    const { hashPassword } = await import('../lib/password');
    const hash = await hashPassword('correct-test-password');
    store.sqlite
      .prepare('UPDATE users SET password_hash=? WHERE id=2')
      .run(hash);
    expect(await auth.login('editor', 'incorrect', false)).toBe(false);
    expect(await auth.login('editor', 'correct-test-password', false)).toBe(
      true,
    );
    const cookie = fixture.jar.set.mock.calls.at(-1)?.[1];
    fixture.jar.get.mockReturnValue({ value: cookie });
    expect(await auth.currentUser()).toEqual({
      id: 2,
      username: 'editor',
      role: 'editor',
      active: 1,
    });
    const digest = createHmac('sha256', fixture.env.SESSION_SECRET)
      .update(cookie)
      .digest('hex');
    store.sqlite
      .prepare('UPDATE sessions SET expires_at=? WHERE id=?')
      .run('2000-01-01T00:00:00Z', digest);
    expect(await auth.isAuthenticated()).toBe(false);
  });
  it('accepts an active account and rejects it immediately when disabled', async () => {
    expect(await auth.isAuthenticated()).toBe(true);
    store.sqlite.exec('UPDATE users SET active=0 WHERE id=2');
    expect(await auth.isAuthenticated()).toBe(false);
    expect(await auth.currentUser()).toBeNull();
  });
  it('rejects a deleted account even if its session row survives', async () => {
    store.sqlite.exec('DELETE FROM users WHERE id=2');
    expect(await auth.isAuthenticated()).toBe(false);
  });
  it('never transfers an old cookie to an admin reusing the username', async () => {
    await data.deleteUser(2, 'root');
    await data.saveUser({
      username: 'editor',
      passwordHash: 'new-hash',
      role: 'admin',
      active: true,
    });
    expect(await auth.currentUser()).toBeNull();
    expect(await auth.isAuthenticated()).toBe(false);
  });
  it('revokes sessions when changing an account password, name, or permissions', async () => {
    await data.saveUser({
      id: 2,
      username: 'renamed',
      passwordHash: 'new-hash',
      role: 'admin',
      active: true,
    });
    expect(
      store.sqlite.prepare('SELECT COUNT(*) AS count FROM sessions').get()
        ?.count,
    ).toBe(0);
    expect(await auth.isAuthenticated()).toBe(false);
  });
  it('rejects legacy sessions that have no immutable user identity', async () => {
    store.sqlite.exec('DELETE FROM sessions');
    const digest = createHmac('sha256', fixture.env.SESSION_SECRET)
      .update(fixture.cookie)
      .digest('hex');
    store.sqlite
      .prepare(
        'INSERT INTO sessions (id,username,expires_at,created_at) VALUES (?,?,?,?)',
      )
      .run(digest, 'editor', new Date(Date.now() + 60000).toISOString(), 'now');
    expect(await auth.isAuthenticated()).toBe(false);
  });
});

describe('public state', () => {
  it('keeps a disabled emergency message private until publication', async () => {
    const { defaultSettings } = await import('../lib/masjid-types');
    await data.saveSettings({
      ...defaultSettings,
      emergencyEnabled: false,
      emergencyMessage: 'PRIVATE EMERGENCY DRAFT',
    });
    expect((await data.readState(false, true)).settings.emergencyMessage).toBe(
      '',
    );
    expect((await data.readState(true, true)).settings.emergencyMessage).toBe(
      'PRIVATE EMERGENCY DRAFT',
    );
    await data.saveSettings({
      ...defaultSettings,
      emergencyEnabled: true,
      emergencyMessage: 'Published emergency',
    });
    expect((await data.readState(false, true)).settings.emergencyMessage).toBe(
      'Published emergency',
    );
  });
  it('keeps private and unpublished records in admin data only', async () => {
    const timestamp = new Date().toISOString();
    for (const [id, enabled, archived, startAt] of [
      [1, 1, 0, ''],
      [2, 0, 0, ''],
      [3, 1, 1, ''],
      [4, 1, 0, '2099-01-01T12:00'],
    ] as const) {
      store.sqlite
        .prepare(`INSERT INTO content_items (id,type,zone,title,details,enabled,archived,start_at,created_at,updated_at)
        VALUES (?,'EXTERNAL_POSTER','COMMUNITY_POSTERS','poster',?, ?,?,?,?,?)`)
        .run(
          id,
          JSON.stringify({
            organisationName: 'Public name',
            notes: 'PRIVATE',
            posterMimeType: 'application/pdf',
          }),
          enabled,
          archived,
          startAt,
          timestamp,
          timestamp,
        );
    }
    store.sqlite.exec(
      `INSERT INTO media (key,filename,mime_type,size,created_at) VALUES ('media/private.pdf','private.pdf','application/pdf',1,'now')`,
    );
    const publicState = await data.readState(false, true);
    expect(publicState.contentItems.map((item) => item.id)).toEqual([1]);
    expect(publicState.contentItems[0].details).toEqual({
      organisationName: 'Public name',
      posterMimeType: 'application/pdf',
    });
    expect(publicState.media).toEqual([]);
    const adminState = await data.readState(true, true);
    expect(adminState.contentItems).toHaveLength(4);
    expect(adminState.contentItems[0].details.notes).toBe('PRIVATE');
    expect(adminState.media).toHaveLength(1);
  });
  it('rejects an invalid timezone before changing saved settings', async () => {
    const { defaultSettings } = await import('../lib/masjid-types');
    await expect(
      data.saveSettings({
        ...defaultSettings,
        timezone: 'Africa/Johannesberg',
      }),
    ).rejects.toThrow(/timezone/i);
    expect(
      store.sqlite
        .prepare('SELECT COUNT(*) AS count FROM settings WHERE id=1')
        .get()?.count,
    ).toBe(0);
  });
});
