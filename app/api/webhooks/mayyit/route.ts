import { env } from 'cloudflare:workers';
import { constantTimeEqual } from '@/lib/password';
import { ensureSchema } from '@/lib/server-schema';
import { isRecord } from '@/lib/admin-validation';
import {
  readJsonBody,
  RequestError,
  requestErrorResponse,
} from '@/lib/request-security';

export const dynamic = 'force-dynamic';

const detailNames = [
  'deceasedName',
  'arabicName',
  'relationship',
  'leavesFrom',
  'pickupDateTime',
  'janazahDateTime',
  'janazahLocation',
  'burialLocation',
  'burialDateTime',
  'dua',
] as const;
const dateNames = new Set([
  'pickupDateTime',
  'janazahDateTime',
  'burialDateTime',
]);

function validDate(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return false;
  const [, y, m, d, h, min, s, offset] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    Number(h) <= 23 &&
    Number(min) <= 59 &&
    Number(s) <= 59 &&
    (offset === 'Z' ||
      (Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4, 6)) <= 59)) &&
    Number.isFinite(Date.parse(value))
  );
}

function validate(value: unknown) {
  if (
    !isRecord(value) ||
    Object.keys(value).some(
      (key) =>
        key !== 'eventId' &&
        !detailNames.includes(key as (typeof detailNames)[number]),
    )
  )
    throw new RequestError(400, 'Invalid notice fields.');
  if (
    typeof value.eventId !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(value.eventId)
  )
    throw new RequestError(
      400,
      'Provide an eventId of 1–128 letters, numbers, dots, underscores, colons or hyphens.',
    );
  const details: Record<string, string> = {};
  for (const key of detailNames) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (
      typeof entry !== 'string' ||
      entry.length > (key === 'dua' ? 1000 : 200)
    )
      throw new RequestError(400, `Invalid ${key}.`);
    const text = entry.trim();
    if (dateNames.has(key) && text && !validDate(text))
      throw new RequestError(
        400,
        `${key} must be an ISO 8601 date and time with seconds and timezone.`,
      );
    if (text) details[key] = text;
  }
  if (
    !details.deceasedName ||
    !(details.janazahDateTime || details.burialDateTime)
  )
    throw new RequestError(
      400,
      'A deceasedName and a janazahDateTime or burialDateTime are required.',
    );
  return { eventId: value.eventId, details };
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (part) =>
    part.toString(16).padStart(2, '0'),
  ).join('');
}

export async function POST(request: Request) {
  try {
    const secret = env.MAYYIT_WEBHOOK_SECRET;
    if (
      !secret ||
      secret.length < 32 ||
      /\s/.test(secret) ||
      secret === env.SESSION_SECRET
    )
      return Response.json(
        { error: 'Webhook is not configured.' },
        { status: 503 },
      );
    const supplied = request.headers.get('authorization') ?? '';
    if (
      supplied.length > 512 ||
      !constantTimeEqual(supplied, `Bearer ${secret}`)
    )
      return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    const notice = validate(await readJsonBody(request, 16 * 1024));
    const digest = await hash(JSON.stringify(notice.details));
    await ensureSchema();
    const existing = () =>
      env.DB.prepare(
        'SELECT notice_id,payload_hash FROM mayyit_webhook_events WHERE event_id=?',
      )
        .bind(notice.eventId)
        .first<{ notice_id: number; payload_hash: string }>();
    const before = await existing();
    if (before)
      return before.payload_hash === digest
        ? Response.json({ noticeId: before.notice_id, duplicate: true })
        : Response.json(
            { error: 'eventId already exists with different details.' },
            { status: 409 },
          );
    const expirySource =
      notice.details.burialDateTime || notice.details.janazahDateTime;
    if (Date.parse(expirySource) + 6 * 60 * 60 * 1000 <= Date.now())
      throw new RequestError(400, 'The notice has already expired.');
    const timestamp = new Date().toISOString();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO content_items (type,display_profile,zone,title,details,enabled,archived,sort_order,display_duration,priority,takeover,created_at,updated_at) VALUES ('JANAZAH','COMMUNITY','JANAZAH','JANAZAH NOTICE',?,1,0,10,12,'URGENT',0,?,?)",
        ).bind(JSON.stringify(notice.details), timestamp, timestamp),
        env.DB.prepare(
          'INSERT INTO mayyit_webhook_events (event_id,notice_id,payload_hash,created_at) VALUES (?,last_insert_rowid(),?,?)',
        ).bind(notice.eventId, digest, timestamp),
        env.DB.prepare('INSERT INTO change_log (changed_at) VALUES (?)').bind(
          timestamp,
        ),
        env.DB.prepare(
          "INSERT INTO audit_log (username,action,entity,entity_id,summary,created_at) VALUES ('mayyit-webhook','create','content',(SELECT notice_id FROM mayyit_webhook_events WHERE event_id=?),'Mayyit webhook notice',?)",
        ).bind(notice.eventId, timestamp),
      ]);
    } catch (error) {
      // A simultaneous delivery may have committed first. Batch rollback prevents a duplicate notice.
      const winner = await existing();
      if (!winner) throw error;
      return winner.payload_hash === digest
        ? Response.json({ noticeId: winner.notice_id, duplicate: true })
        : Response.json(
            { error: 'eventId already exists with different details.' },
            { status: 409 },
          );
    }
    const created = await existing();
    if (!created) throw new Error('Webhook receipt was not saved.');
    return Response.json(
      { noticeId: created.notice_id, duplicate: false },
      { status: 201 },
    );
  } catch (error) {
    return requestErrorResponse(error, 'The notice could not be received.');
  }
}
