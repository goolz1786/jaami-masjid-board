import { env } from 'cloudflare:workers';
import {
  defaultAnnouncements,
  defaultDisplayProfileFor,
  defaultDisplayState,
  defaultDonation,
  defaultProgrammes,
  defaultSettings,
  type Announcement,
  type AuditEntry,
  type ContentItem,
  type DisplayState,
  type DonationSettings,
  type HadithEntry,
  type MediaItem,
  type Programme,
  type Settings,
  type UserSummary,
} from './masjid-types';
import { starterHadith } from './hadith-library';
import {
  resolveIslamicDate,
  type JamiatIslamicDateCache,
} from './jamiat-islamic-date';
import { ensureSchema } from './server-schema';
import { rootUsername } from './root-admin';
import { isValidTimeZone, safeTimeZone } from './timezone';
import { publicDisplayState } from './public-state';
import { validateContentItem } from './content-validation';
import { RequestError } from './request-security';

const now = () => new Date().toISOString();
const bool = (value: unknown) => (value ? 1 : 0);
const str = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  return fallback;
};
const jsonArray = (value: unknown): number[] => {
  try {
    const parsed = JSON.parse(str(value, '[]'));
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((day) => day >= 0 && day <= 6)
      : [];
  } catch {
    return [];
  }
};

const emptyIslamicDateCache: JamiatIslamicDateCache = {
  value: '',
  fetchedAt: '',
  lastAttemptAt: '',
  available: false,
};

function parseIslamicDateCache(data?: string): JamiatIslamicDateCache {
  if (!data) return emptyIslamicDateCache;
  try {
    const parsed = JSON.parse(data) as Partial<JamiatIslamicDateCache>;
    return {
      value: String(parsed.value ?? ''),
      fetchedAt: String(parsed.fetchedAt ?? ''),
      lastAttemptAt: String(parsed.lastAttemptAt ?? ''),
      available: Boolean(parsed.available && parsed.value),
    };
  } catch {
    return emptyIslamicDateCache;
  }
}

function rowProgramme(row: Record<string, unknown>): Programme {
  return {
    id: Number(row.id),
    title: str(row.title),
    subtitle: str(row.subtitle ?? ''),
    category: str(row.category ?? ''),
    imageUrl: str(row.image_url ?? ''),
    description: str(row.description ?? ''),
    dateText: str(row.date_text ?? ''),
    startTime: str(row.start_time ?? ''),
    endTime: str(row.end_time ?? ''),
    venue: str(row.venue ?? ''),
    audience: str(row.audience ?? ''),
    speaker: str(row.speaker ?? ''),
    quote: str(row.quote ?? ''),
    quoteSource: str(row.quote_source ?? ''),
    eventStart: str(row.event_start ?? ''),
    eventEnd: str(row.event_end ?? ''),
    displayFrom: str(row.display_from ?? ''),
    displayUntil: str(row.display_until ?? ''),
    active: Boolean(row.active),
    showUpcoming: Boolean(row.show_upcoming),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order ?? 0),
    recurringWeekdays: jsonArray(row.recurring_weekdays),
    priority: str(row.priority ?? 'NORMAL') as Programme['priority'],
    displayDuration: Number(row.display_duration ?? 15),
    archived: Boolean(row.archived),
  };
}

function rowAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: Number(row.id),
    title: str(row.title),
    body: str(row.body ?? ''),
    icon: str(row.icon ?? 'megaphone'),
    type: str(row.type ?? 'General'),
    startDate: str(row.start_date ?? ''),
    endDate: str(row.end_date ?? ''),
    active: Boolean(row.active),
    panelPosition: Number(row.panel_position ?? 1),
    sortOrder: Number(row.sort_order ?? 0),
    recurringWeekdays: jsonArray(row.recurring_weekdays),
    priority: str(row.priority ?? 'NORMAL') as Announcement['priority'],
    displayDuration: Number(row.display_duration ?? 12),
    archived: Boolean(row.archived),
  };
}

function rowHadith(row: Record<string, unknown>): HadithEntry {
  return {
    id: Number(row.id),
    arabic: str(row.arabic),
    translation: str(row.translation),
    reference: str(row.reference),
    narrator: str(row.narrator ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
  };
}

function rowContent(row: Record<string, unknown>): ContentItem {
  let details: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(str(row.details ?? '{}'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      details = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string'),
      );
  } catch {
    /* malformed legacy details remain empty */
  }
  return {
    id: Number(row.id),
    type: str(row.type) as ContentItem['type'],
    displayProfile: str(
      row.display_profile ??
        defaultDisplayProfileFor(str(row.type) as ContentItem['type']),
    ) as ContentItem['displayProfile'],
    zone: str(row.zone) as ContentItem['zone'],
    title: str(row.title),
    subtitle: str(row.subtitle ?? ''),
    body: str(row.body ?? ''),
    imageUrl: str(row.image_url ?? ''),
    icon: str(row.icon ?? 'megaphone'),
    qrUrl: str(row.qr_url ?? ''),
    details,
    enabled: Boolean(row.enabled),
    archived: Boolean(row.archived),
    sortOrder: Number(row.sort_order ?? 0),
    displayDuration: Number(row.display_duration ?? 12),
    startAt: str(row.start_at ?? ''),
    endAt: str(row.end_at ?? ''),
    recurringWeekdays: jsonArray(row.recurring_weekdays),
    priority: str(row.priority ?? 'NORMAL') as ContentItem['priority'],
    takeover: Boolean(row.takeover),
    createdAt: str(row.created_at ?? ''),
    updatedAt: str(row.updated_at ?? ''),
  };
}

export async function readState(
  seed = false,
  strict = false,
): Promise<DisplayState> {
  try {
    await ensureSchema();
    const db = env.DB;
    if (seed) {
      const seededRow = await db
        .prepare('SELECT id FROM settings WHERE id = 3')
        .first<{ id: number }>();
      if (!seededRow) await seedDefaults();
    }
    const programmeRows = await db
      .prepare('SELECT * FROM programmes ORDER BY sort_order, id')
      .all<Record<string, unknown>>();
    const [
      settingRow,
      islamicDateRow,
      announcementRows,
      contentRows,
      hadithRows,
      mediaRows,
      donationRow,
      changedRow,
      userRows,
      auditRows,
    ] = await Promise.all([
      db
        .prepare('SELECT data FROM settings WHERE id = 1')
        .first<{ data: string }>(),
      db
        .prepare('SELECT data FROM settings WHERE id = 2')
        .first<{ data: string }>(),
      db
        .prepare('SELECT * FROM announcements ORDER BY panel_position, id')
        .all<Record<string, unknown>>(),
      db
        .prepare('SELECT * FROM content_items ORDER BY zone, sort_order, id')
        .all<Record<string, unknown>>(),
      db
        .prepare('SELECT * FROM hadith ORDER BY sort_order, id')
        .all<Record<string, unknown>>(),
      db
        .prepare('SELECT * FROM media ORDER BY created_at DESC')
        .all<Record<string, unknown>>(),
      db
        .prepare('SELECT data FROM donation_settings WHERE id = 1')
        .first<{ data: string }>(),
      db
        .prepare('SELECT changed_at FROM change_log ORDER BY id DESC LIMIT 1')
        .first<{ changed_at: string }>(),
      seed
        ? db
            .prepare(
              'SELECT id,username,role,active,created_at FROM users ORDER BY username',
            )
            .all<Record<string, unknown>>()
        : Promise.resolve({ results: [] as Record<string, unknown>[] }),
      seed
        ? db
            .prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100')
            .all<Record<string, unknown>>()
        : Promise.resolve({ results: [] as Record<string, unknown>[] }),
    ]);
    const settings = settingRow?.data
      ? ({ ...defaultSettings, ...JSON.parse(settingRow.data) } as Settings)
      : defaultSettings;
    // Do not rewrite old settings; normalize invalid legacy values for readers.
    const normalizedSettings = {
      ...settings,
      timezone: safeTimeZone(settings.timezone),
    };
    const islamicDateCache = parseIslamicDateCache(islamicDateRow?.data);
    const islamicDate = resolveIslamicDate(
      settings.islamicDateSource,
      settings.islamicDateManual,
      islamicDateCache,
    );
    const donation = donationRow?.data
      ? ({
          ...defaultDonation,
          ...JSON.parse(donationRow.data),
        } as DonationSettings)
      : defaultDonation;
    const media: MediaItem[] = mediaRows.results.map((row) => ({
      id: Number(row.id),
      key: str(row.key),
      filename: str(row.filename),
      mimeType: str(row.mime_type),
      size: Number(row.size),
      createdAt: str(row.created_at),
      url: `/api/media/${encodeURIComponent(str(row.key))}`,
    }));
    const state: DisplayState = {
      settings: normalizedSettings,
      islamicDate,
      donation,
      programmes: programmeRows.results.map(rowProgramme),
      announcements: announcementRows.results.map(rowAnnouncement),
      contentItems: contentRows.results.map(rowContent),
      hadith: hadithRows.results.map(rowHadith),
      media,
      users: userRows.results.map((row): UserSummary => ({
        id: Number(row.id),
        username: str(row.username),
        role: str(row.role ?? 'admin') as UserSummary['role'],
        active: Boolean(row.active),
        createdAt: str(row.created_at),
        root: str(row.username) === rootUsername(),
      })),
      auditLog: auditRows.results.map((row): AuditEntry => ({
        id: Number(row.id),
        username: str(row.username),
        action: str(row.action),
        entity: str(row.entity),
        entityId: row.entity_id == null ? null : Number(row.entity_id),
        summary: str(row.summary ?? ''),
        createdAt: str(row.created_at),
      })),
      lastUpdated: changedRow?.changed_at ?? now(),
    };
    return seed ? state : publicDisplayState(state);
  } catch (error) {
    console.error('Failed to read board state', error);
    if (strict) throw error;
    return defaultDisplayState;
  }
}

export async function seedDefaults() {
  const db = env.DB;
  const timestamp = now();
  const statements = [
    db
      .prepare(
        'INSERT OR IGNORE INTO settings (id, data, updated_at) VALUES (1, ?, ?)',
      )
      .bind(JSON.stringify(defaultSettings), timestamp),
    db
      .prepare(
        'INSERT OR IGNORE INTO donation_settings (id, data, updated_at) VALUES (1, ?, ?)',
      )
      .bind(JSON.stringify(defaultDonation), timestamp),
    db
      .prepare(
        'INSERT OR REPLACE INTO settings (id, data, updated_at) VALUES (3, ?, ?)',
      )
      .bind(JSON.stringify({ seeded: true }), timestamp),
  ];
  for (const p of defaultProgrammes)
    statements.push(
      db
        .prepare(
          `INSERT INTO programmes (title,subtitle,category,image_url,description,date_text,start_time,end_time,venue,audience,speaker,quote,quote_source,event_start,event_end,display_from,display_until,active,show_upcoming,featured,sort_order,created_at,updated_at,recurring_weekdays,priority,display_duration,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          p.title,
          p.subtitle,
          p.category,
          p.imageUrl,
          p.description,
          p.dateText,
          p.startTime,
          p.endTime,
          p.venue,
          p.audience,
          p.speaker,
          p.quote,
          p.quoteSource,
          p.eventStart,
          p.eventEnd,
          p.displayFrom,
          p.displayUntil,
          bool(p.active),
          bool(p.showUpcoming),
          bool(p.featured),
          p.sortOrder,
          timestamp,
          timestamp,
          JSON.stringify(p.recurringWeekdays),
          p.priority,
          p.displayDuration,
          bool(p.archived),
        ),
    );
  for (const a of defaultAnnouncements)
    statements.push(
      db
        .prepare(
          `INSERT INTO announcements (title,body,icon,type,start_date,end_date,active,panel_position,created_at,updated_at,sort_order,recurring_weekdays,priority,display_duration,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          a.title,
          a.body,
          a.icon,
          a.type,
          a.startDate,
          a.endDate,
          bool(a.active),
          a.panelPosition,
          timestamp,
          timestamp,
          a.sortOrder,
          JSON.stringify(a.recurringWeekdays),
          a.priority,
          a.displayDuration,
          bool(a.archived),
        ),
    );
  statements.push(
    db
      .prepare('INSERT INTO change_log (changed_at) VALUES (?)')
      .bind(timestamp),
  );
  for (const [index, h] of starterHadith.entries())
    statements.push(
      db
        .prepare(
          'INSERT INTO hadith (arabic,translation,reference,narrator,sort_order,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)',
        )
        .bind(
          h.arabic,
          h.translation,
          h.reference,
          h.narrator,
          index * 10,
          timestamp,
          timestamp,
        ),
    );
  await db.batch(statements);
}

async function changed() {
  await env.DB.prepare('INSERT INTO change_log (changed_at) VALUES (?)')
    .bind(now())
    .run();
}

export async function saveSettings(settings: Settings) {
  if (!isValidTimeZone(settings.timezone))
    throw new Error(
      'Choose a valid timezone, for example Africa/Johannesburg.',
    );
  settings = { ...settings, timezone: settings.timezone.trim() };
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO settings (id,data,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
    ).bind(JSON.stringify(settings), timestamp),
    env.DB.prepare('INSERT INTO change_log (changed_at) VALUES (?)').bind(
      timestamp,
    ),
  ]);
}

export async function saveIslamicDateCache(cache: JamiatIslamicDateCache) {
  await ensureSchema();
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO settings (id,data,updated_at) VALUES (2,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
    ).bind(JSON.stringify(cache), timestamp),
    env.DB.prepare('INSERT INTO change_log (changed_at) VALUES (?)').bind(
      timestamp,
    ),
  ]);
}

export async function saveDonation(donation: DonationSettings) {
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO donation_settings (id,data,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
    ).bind(JSON.stringify(donation), timestamp),
    env.DB.prepare('INSERT INTO change_log (changed_at) VALUES (?)').bind(
      timestamp,
    ),
  ]);
}

export async function saveProgramme(
  programme: Omit<Programme, 'id'> & { id?: number },
) {
  const db = env.DB;
  const timestamp = now();
  if (programme.id) {
    await db
      .prepare(
        `UPDATE programmes SET title=?,subtitle=?,category=?,image_url=?,description=?,date_text=?,start_time=?,end_time=?,venue=?,audience=?,speaker=?,quote=?,quote_source=?,event_start=?,event_end=?,display_from=?,display_until=?,active=?,show_upcoming=?,featured=?,sort_order=?,updated_at=?,recurring_weekdays=?,priority=?,display_duration=?,archived=? WHERE id=?`,
      )
      .bind(
        programme.title,
        programme.subtitle,
        programme.category,
        programme.imageUrl,
        programme.description,
        programme.dateText,
        programme.startTime,
        programme.endTime,
        programme.venue,
        programme.audience,
        programme.speaker,
        programme.quote,
        programme.quoteSource,
        programme.eventStart,
        programme.eventEnd,
        programme.displayFrom,
        programme.displayUntil,
        bool(programme.active),
        bool(programme.showUpcoming),
        bool(programme.featured),
        programme.sortOrder,
        timestamp,
        JSON.stringify(programme.recurringWeekdays ?? []),
        programme.priority ?? 'NORMAL',
        programme.displayDuration ?? 15,
        bool(programme.archived),
        programme.id,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO programmes (title,subtitle,category,image_url,description,date_text,start_time,end_time,venue,audience,speaker,quote,quote_source,event_start,event_end,display_from,display_until,active,show_upcoming,featured,sort_order,created_at,updated_at,recurring_weekdays,priority,display_duration,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        programme.title,
        programme.subtitle,
        programme.category,
        programme.imageUrl,
        programme.description,
        programme.dateText,
        programme.startTime,
        programme.endTime,
        programme.venue,
        programme.audience,
        programme.speaker,
        programme.quote,
        programme.quoteSource,
        programme.eventStart,
        programme.eventEnd,
        programme.displayFrom,
        programme.displayUntil,
        bool(programme.active),
        bool(programme.showUpcoming),
        bool(programme.featured),
        programme.sortOrder,
        timestamp,
        timestamp,
        JSON.stringify(programme.recurringWeekdays ?? []),
        programme.priority ?? 'NORMAL',
        programme.displayDuration ?? 15,
        bool(programme.archived),
      )
      .run();
  }
  await changed();
}

export async function deleteProgramme(id: number) {
  await env.DB.prepare('DELETE FROM programmes WHERE id=?').bind(id).run();
  await changed();
}

export async function saveAnnouncement(
  a: Omit<Announcement, 'id'> & { id?: number },
) {
  const timestamp = now();
  if (a.id)
    await env.DB.prepare(
      'UPDATE announcements SET title=?,body=?,icon=?,type=?,start_date=?,end_date=?,active=?,panel_position=?,updated_at=?,sort_order=?,recurring_weekdays=?,priority=?,display_duration=?,archived=? WHERE id=?',
    )
      .bind(
        a.title,
        a.body,
        a.icon,
        a.type,
        a.startDate,
        a.endDate,
        bool(a.active),
        a.panelPosition,
        timestamp,
        a.sortOrder ?? 0,
        JSON.stringify(a.recurringWeekdays ?? []),
        a.priority ?? 'NORMAL',
        a.displayDuration ?? 12,
        bool(a.archived),
        a.id,
      )
      .run();
  else
    await env.DB.prepare(
      'INSERT INTO announcements (title,body,icon,type,start_date,end_date,active,panel_position,created_at,updated_at,sort_order,recurring_weekdays,priority,display_duration,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(
        a.title,
        a.body,
        a.icon,
        a.type,
        a.startDate,
        a.endDate,
        bool(a.active),
        a.panelPosition,
        timestamp,
        timestamp,
        a.sortOrder ?? 0,
        JSON.stringify(a.recurringWeekdays ?? []),
        a.priority ?? 'NORMAL',
        a.displayDuration ?? 12,
        bool(a.archived),
      )
      .run();
  await changed();
}

export async function deleteAnnouncement(id: number) {
  await env.DB.prepare('DELETE FROM announcements WHERE id=?').bind(id).run();
  await changed();
}

export async function addMedia(
  key: string,
  filename: string,
  mimeType: string,
  size: number,
) {
  await env.DB.prepare(
    'INSERT INTO media (key,filename,mime_type,size,created_at) VALUES (?,?,?,?,?)',
  )
    .bind(key, filename, mimeType, size, now())
    .run();
  await changed();
}

export async function deleteMedia(id: number) {
  const row = await env.DB.prepare('SELECT key FROM media WHERE id=?')
    .bind(id)
    .first<{ key: string }>();
  if (row) await env.FILES.delete(row.key);
  await env.DB.prepare('DELETE FROM media WHERE id=?').bind(id).run();
  await changed();
}

export async function renameMedia(id: number, filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) throw new Error('A filename is required.');
  if (trimmed.length > 120)
    throw new Error('The filename must be 120 characters or fewer.');
  await env.DB.prepare('UPDATE media SET filename=? WHERE id=?')
    .bind(trimmed, id)
    .run();
  await changed();
}

export async function saveHadith(
  item: Omit<HadithEntry, 'id'> & { id?: number },
) {
  const timestamp = now();
  const arabic = item.arabic.trim();
  const translation = item.translation.trim();
  const reference = item.reference.trim();
  const narrator = item.narrator?.trim() ?? '';
  if (!arabic) throw new Error('The Arabic text is required.');
  if (!translation) throw new Error('The translation is required.');
  if (!reference) throw new Error('A reference is required.');
  if (arabic.length > 2000) throw new Error('The Arabic text is too long.');
  if (translation.length > 2000)
    throw new Error('The translation is too long.');
  if (reference.length > 160) throw new Error('The reference is too long.');
  if (narrator.length > 120) throw new Error('The narrator name is too long.');
  const values = [
    arabic,
    translation,
    reference,
    narrator,
    item.sortOrder,
    bool(item.active),
  ];
  if (item.id) {
    await env.DB.prepare(
      'UPDATE hadith SET arabic=?,translation=?,reference=?,narrator=?,sort_order=?,active=?,updated_at=? WHERE id=?',
    )
      .bind(...values, timestamp, item.id)
      .run();
  } else {
    await env.DB.prepare(
      'INSERT INTO hadith (arabic,translation,reference,narrator,sort_order,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    )
      .bind(...values, timestamp, timestamp)
      .run();
  }
  await changed();
}

export async function deleteHadith(id: number) {
  await env.DB.prepare('DELETE FROM hadith WHERE id=?').bind(id).run();
  await changed();
}

export async function saveContentItem(
  item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: number },
) {
  const errors = validateContentItem(item as ContentItem);
  if (errors.length) throw new RequestError(400, errors.join(' '));
  const timestamp = now();
  const values = [
    item.type,
    item.displayProfile,
    item.zone,
    item.title.trim(),
    item.subtitle ?? '',
    item.body ?? '',
    item.imageUrl ?? '',
    item.icon ?? 'megaphone',
    item.qrUrl ?? '',
    JSON.stringify(item.details ?? {}),
    bool(item.enabled),
    bool(item.archived),
    item.sortOrder ?? 0,
    Math.max(5, item.displayDuration ?? 12),
    item.startAt ?? '',
    item.endAt ?? '',
    JSON.stringify(item.recurringWeekdays ?? []),
    item.priority ?? 'NORMAL',
    bool(item.takeover),
  ];
  if (!item.title.trim()) throw new Error('A title is required.');
  if (item.id) {
    await env.DB.prepare(
      'UPDATE content_items SET type=?,display_profile=?,zone=?,title=?,subtitle=?,body=?,image_url=?,icon=?,qr_url=?,details=?,enabled=?,archived=?,sort_order=?,display_duration=?,start_at=?,end_at=?,recurring_weekdays=?,priority=?,takeover=?,updated_at=? WHERE id=?',
    )
      .bind(...values, timestamp, item.id)
      .run();
  } else {
    await env.DB.prepare(
      'INSERT INTO content_items (type,display_profile,zone,title,subtitle,body,image_url,icon,qr_url,details,enabled,archived,sort_order,display_duration,start_at,end_at,recurring_weekdays,priority,takeover,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(...values, timestamp, timestamp)
      .run();
  }
  await changed();
}

export async function deleteContentItem(id: number) {
  await env.DB.prepare('DELETE FROM content_items WHERE id=?').bind(id).run();
  await changed();
}

export async function writeAudit(
  username: string,
  action: string,
  entity: string,
  entityId: number | null,
  summary: string,
) {
  await env.DB.prepare(
    'INSERT INTO audit_log (username,action,entity,entity_id,summary,created_at) VALUES (?,?,?,?,?,?)',
  )
    .bind(username, action, entity, entityId, summary.slice(0, 500), now())
    .run();
}

export async function saveUser(input: {
  id?: number;
  username: string;
  passwordHash?: string;
  role: 'admin' | 'editor';
  active: boolean;
}) {
  const timestamp = now();
  if (!input.username.trim()) throw new Error('A username is required.');
  const root = rootUsername();
  if (input.id) {
    const target = await env.DB.prepare('SELECT username FROM users WHERE id=?')
      .bind(input.id)
      .first<{ username: string }>();
    if (target && target.username === root) {
      if (input.username.trim() !== target.username)
        throw new Error('The primary administrator account cannot be renamed.');
      input = { ...input, role: 'admin', active: true };
    }
    const statement = input.passwordHash
      ? env.DB.prepare(
          'UPDATE users SET username=?,password_hash=?,role=?,active=?,updated_at=? WHERE id=?',
        ).bind(
          input.username.trim(),
          input.passwordHash,
          input.role,
          bool(input.active),
          timestamp,
          input.id,
        )
      : env.DB.prepare(
          'UPDATE users SET username=?,role=?,active=?,updated_at=? WHERE id=?',
        ).bind(
          input.username.trim(),
          input.role,
          bool(input.active),
          timestamp,
          input.id,
        );
    await env.DB.batch([
      statement,
      env.DB.prepare('DELETE FROM sessions WHERE user_id=? OR username=?').bind(
        input.id,
        target?.username ?? '',
      ),
    ]);
  } else {
    if (!input.passwordHash)
      throw new Error('A password is required for a new user.');
    await env.DB.prepare(
      'INSERT INTO users (username,password_hash,created_at,updated_at,role,active) VALUES (?,?,?,?,?,?)',
    )
      .bind(
        input.username.trim(),
        input.passwordHash,
        timestamp,
        timestamp,
        input.role,
        bool(input.active),
      )
      .run();
  }
}

export async function deleteUser(id: number, currentUsername: string) {
  const target = await env.DB.prepare('SELECT username FROM users WHERE id=?')
    .bind(id)
    .first<{ username: string }>();
  if (!target) return;
  if (target.username === currentUsername)
    throw new Error('You cannot delete the account currently signed in.');
  if (target.username === rootUsername())
    throw new Error('The primary administrator account cannot be deleted.');
  const activeAdmins = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND active=1",
  ).first<{ count: number }>();
  const row = await env.DB.prepare('SELECT role,active FROM users WHERE id=?')
    .bind(id)
    .first<{ role: string; active: number }>();
  if (
    row?.role === 'admin' &&
    row.active &&
    Number(activeAdmins?.count ?? 0) <= 1
  )
    throw new Error('At least one active administrator is required.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id=? OR username=?').bind(
      id,
      target.username,
    ),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(id),
  ]);
}
