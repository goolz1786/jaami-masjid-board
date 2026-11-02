import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from './helpers/sqlite-d1';

const fixture = vi.hoisted(() => ({
  env: {
    DB: undefined as unknown as D1Database,
    MAYYIT_WEBHOOK_SECRET: 'synthetic-secret-0123456789-abcdefgh',
  },
}));
vi.mock('cloudflare:workers', () => ({ env: fixture.env }));
let store: ReturnType<typeof sqliteD1>;
let post: typeof import('../app/api/webhooks/mayyit/route').POST;
const payload = {
  eventId: 'source-123',
  deceasedName: 'Example Person',
  janazahDateTime: '2030-06-01T14:00:00+02:00',
  janazahLocation: 'Example Masjid',
};
const request = (data: unknown, token = fixture.env.MAYYIT_WEBHOOK_SECRET) =>
  new Request('https://board.example/api/webhooks/mayyit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

beforeEach(async () => {
  vi.resetModules();
  store = sqliteD1();
  fixture.env.DB = store.db;
  fixture.env.MAYYIT_WEBHOOK_SECRET = 'synthetic-secret-0123456789-abcdefgh';
  post = (await import('../app/api/webhooks/mayyit/route')).POST;
});
afterEach(() => store.sqlite.close());

describe('mayyit webhook', () => {
  it('rejects absent or wrong secrets before creating data', async () => {
    expect((await post(request(payload, 'wrong'))).status).toBe(401);
    fixture.env.MAYYIT_WEBHOOK_SECRET = '';
    expect((await post(request(payload, 'wrong'))).status).toBe(503);
  });
  it('immediately publishes a valid notice and safely handles retries', async () => {
    const created = await post(request(payload));
    expect(created.status).toBe(201);
    const body = (await created.json()) as { noticeId: number };
    const repeat = await post(request(payload));
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({
      noticeId: body.noticeId,
      duplicate: true,
    });
    const row = store.sqlite
      .prepare(
        'SELECT type,display_profile,zone,enabled,details FROM content_items',
      )
      .get();
    expect(row).toMatchObject({
      type: 'JANAZAH',
      display_profile: 'COMMUNITY',
      zone: 'JANAZAH',
      enabled: 1,
    });
    expect(JSON.parse(row?.details as string)).toMatchObject({
      deceasedName: payload.deceasedName,
      janazahDateTime: payload.janazahDateTime,
    });
    expect(
      store.sqlite.prepare('SELECT COUNT(*) AS n FROM content_items').get()?.n,
    ).toBe(1);
    const { readState } = await import('../lib/server-data');
    const display = await readState(false, true);
    expect(display.contentItems.map((notice) => notice.id)).toContain(body.noticeId);
    expect(
      (await post(request({ ...payload, deceasedName: 'Different person' })))
        .status,
    ).toBe(409);
  });
  it('rejects incomplete, malformed, overlong and ambiguous data', async () => {
    for (const item of [
      { ...payload, deceasedName: '' },
      { ...payload, eventId: '' },
      { ...payload, janazahDateTime: 'tomorrow' },
      { ...payload, janazahDateTime: '2030-01-01T12:00' },
      { ...payload, janazahDateTime: '2020-01-01T12:00:00Z' },
      { ...payload, surprise: 'field' },
      { ...payload, deceasedName: 'x'.repeat(201) },
    ])
      expect((await post(request(item))).status).toBe(400);
  });
  it('preserves existing notices when schema initializes and webhook is used', async () => {
    const { ensureSchema } = await import('../lib/server-schema');
    await ensureSchema();
    store.sqlite.exec(
      "INSERT INTO content_items (type,zone,title,created_at,updated_at) VALUES ('GENERAL_NOTICE','COMMUNITY','Existing','now','now')",
    );
    expect((await post(request(payload))).status).toBe(201);
    expect(
      store.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM content_items WHERE title='Existing'",
        )
        .get()?.n,
    ).toBe(1);
  });
});
