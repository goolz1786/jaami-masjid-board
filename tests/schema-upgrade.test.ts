import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { sqliteD1 } from './helpers/sqlite-d1';

const fixture = vi.hoisted(() => ({
  env: { DB: undefined as unknown as D1Database },
}));
vi.mock('cloudflare:workers', () => ({ env: fixture.env }));
let store: ReturnType<typeof sqliteD1>;
beforeEach(() => {
  vi.resetModules();
  store = sqliteD1();
  fixture.env.DB = store.db;
});
afterEach(() => store.sqlite.close());

it('upgrades a legacy database without dropping content, credentials, or legacy schedules', async () => {
  store.sqlite.exec(
    readFileSync(
      new URL('../drizzle/0000_simple_ultragirl.sql', import.meta.url),
      'utf8',
    ),
  );
  store.sqlite
    .exec(`INSERT INTO users (username,password_hash,created_at,updated_at) VALUES ('existing','UNCHANGED','now','now');
    INSERT INTO settings VALUES (1,'{"masjidName":"Existing masjid"}','now');
    INSERT INTO media (key,filename,mime_type,size,created_at) VALUES ('media/existing.pdf','existing.pdf','application/pdf',123,'now')`);
  store.sqlite.exec(
    "CREATE TABLE IF NOT EXISTS preservation_probe (value TEXT); INSERT INTO preservation_probe VALUES ('keep')",
  );
  // The old app had schedule rows; preserve their exact schema and payload.
  store.sqlite.exec(
    "DROP TABLE IF EXISTS schedules; CREATE TABLE schedules (id INTEGER PRIMARY KEY, payload TEXT); INSERT INTO schedules VALUES (1,'existing schedule')",
  );
  const { ensureSchema } = await import('../lib/server-schema');
  await ensureSchema();
  expect(
    store.sqlite.prepare('SELECT payload FROM schedules').get()?.payload,
  ).toBe('existing schedule');
  expect(
    store.sqlite.prepare('SELECT password_hash FROM users').get()
      ?.password_hash,
  ).toBe('UNCHANGED');
  expect(
    store.sqlite.prepare('SELECT data FROM settings').get()?.data,
  ).toContain('Existing masjid');
  expect(store.sqlite.prepare('SELECT key FROM media').get()?.key).toBe(
    'media/existing.pdf',
  );
  const columns = store.sqlite.prepare('PRAGMA table_info(sessions)').all() as {
    name: string;
  }[];
  expect(columns.map((column) => column.name)).toContain('user_id');
  vi.resetModules();
  await (await import('../lib/server-schema')).ensureSchema();
  expect(
    store.sqlite.prepare('SELECT COUNT(*) AS count FROM users').get()?.count,
  ).toBe(1);
});

it('initializes fresh databases and tolerates runtime schema ahead of the migration ledger', async () => {
  const { ensureSchema } = await import('../lib/server-schema');
  await ensureSchema();
  vi.resetModules();
  await (await import('../lib/server-schema')).ensureSchema();
  const columns = store.sqlite.prepare('PRAGMA table_info(sessions)').all() as {
    name: string;
  }[];
  expect(columns.map((column) => column.name)).toContain('user_id');
});
