const tables = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    role TEXT DEFAULT 'admin' NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    user_id INTEGER,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS programmes (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '' NOT NULL,
    category TEXT DEFAULT 'PROGRAMME' NOT NULL,
    image_url TEXT DEFAULT '' NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    date_text TEXT DEFAULT '' NOT NULL,
    start_time TEXT DEFAULT '' NOT NULL,
    end_time TEXT DEFAULT '' NOT NULL,
    venue TEXT DEFAULT '' NOT NULL,
    audience TEXT DEFAULT '' NOT NULL,
    speaker TEXT DEFAULT '' NOT NULL,
    quote TEXT DEFAULT '' NOT NULL,
    quote_source TEXT DEFAULT '' NOT NULL,
    event_start TEXT DEFAULT '' NOT NULL,
    event_end TEXT DEFAULT '' NOT NULL,
    display_from TEXT DEFAULT '' NOT NULL,
    display_until TEXT DEFAULT '' NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL,
    show_upcoming INTEGER DEFAULT 0 NOT NULL,
    featured INTEGER DEFAULT 0 NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    recurring_weekdays TEXT DEFAULT '[]' NOT NULL,
    priority TEXT DEFAULT 'NORMAL' NOT NULL,
    display_duration INTEGER DEFAULT 15 NOT NULL,
    archived INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '' NOT NULL,
    icon TEXT DEFAULT 'megaphone' NOT NULL,
    type TEXT DEFAULT 'General' NOT NULL,
    start_date TEXT DEFAULT '' NOT NULL,
    end_date TEXT DEFAULT '' NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL,
    panel_position INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    recurring_weekdays TEXT DEFAULT '[]' NOT NULL,
    priority TEXT DEFAULT 'NORMAL' NOT NULL,
    display_duration INTEGER DEFAULT 12 NOT NULL,
    archived INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS content_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    type TEXT NOT NULL,
    display_profile TEXT DEFAULT 'MAIN' NOT NULL,
    zone TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '' NOT NULL,
    body TEXT DEFAULT '' NOT NULL,
    image_url TEXT DEFAULT '' NOT NULL,
    icon TEXT DEFAULT 'megaphone' NOT NULL,
    qr_url TEXT DEFAULT '' NOT NULL,
    details TEXT DEFAULT '{}' NOT NULL,
    enabled INTEGER DEFAULT 1 NOT NULL,
    archived INTEGER DEFAULT 0 NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    display_duration INTEGER DEFAULT 12 NOT NULL,
    start_at TEXT DEFAULT '' NOT NULL,
    end_at TEXT DEFAULT '' NOT NULL,
    recurring_weekdays TEXT DEFAULT '[]' NOT NULL,
    priority TEXT DEFAULT 'NORMAL' NOT NULL,
    takeover INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS donation_settings (
    id INTEGER PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    changed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    summary TEXT DEFAULT '' NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hadith (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    arabic TEXT NOT NULL,
    translation TEXT NOT NULL,
    reference TEXT NOT NULL,
    narrator TEXT DEFAULT '' NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

const legacyColumns: Record<string, Record<string, string>> = {
  sessions: { user_id: 'INTEGER' },
  users: {
    role: "TEXT DEFAULT 'admin' NOT NULL",
    active: 'INTEGER DEFAULT 1 NOT NULL',
  },
  programmes: {
    speaker: "TEXT DEFAULT '' NOT NULL",
    event_start: "TEXT DEFAULT '' NOT NULL",
    event_end: "TEXT DEFAULT '' NOT NULL",
    recurring_weekdays: "TEXT DEFAULT '[]' NOT NULL",
    priority: "TEXT DEFAULT 'NORMAL' NOT NULL",
    display_duration: 'INTEGER DEFAULT 15 NOT NULL',
    archived: 'INTEGER DEFAULT 0 NOT NULL',
  },
  announcements: {
    sort_order: 'INTEGER DEFAULT 0 NOT NULL',
    recurring_weekdays: "TEXT DEFAULT '[]' NOT NULL",
    priority: "TEXT DEFAULT 'NORMAL' NOT NULL",
    display_duration: 'INTEGER DEFAULT 12 NOT NULL',
    archived: 'INTEGER DEFAULT 0 NOT NULL',
  },
  content_items: {
    display_profile: "TEXT DEFAULT 'MAIN' NOT NULL",
  },
};

const indexes = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)',
  'CREATE INDEX IF NOT EXISTS idx_programmes_display ON programmes (active,show_upcoming,sort_order)',
  'CREATE INDEX IF NOT EXISTS idx_programmes_featured ON programmes (featured,active)',
  'CREATE INDEX IF NOT EXISTS idx_announcements_display ON announcements (active,panel_position)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_media_key ON media (key)',
  'CREATE INDEX IF NOT EXISTS idx_content_items_display_profile ON content_items (enabled,archived,display_profile,zone,sort_order)',
  'CREATE INDEX IF NOT EXISTS idx_content_items_schedule ON content_items (start_at,end_at)',
  'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at)',
  'CREATE INDEX IF NOT EXISTS idx_hadith_display ON hadith (active,sort_order)',
];

export async function upgradeSchema(db: Pick<D1Database, 'prepare' | 'batch'>) {
  await db.batch(tables.map((sql) => db.prepare(sql)));

  for (const [table, columns] of Object.entries(legacyColumns)) {
    const existing = await db
      .prepare(`PRAGMA table_info(${table})`)
      .all<{ name: string }>();
    const names = new Set(existing.results.map((column) => column.name));
    for (const [name, definition] of Object.entries(columns)) {
      if (!names.has(name)) {
        await db
          .prepare(`ALTER TABLE ${table} ADD ${name} ${definition}`)
          .run();
        if (table === 'content_items' && name === 'display_profile') {
          await db
            .prepare(
              "UPDATE content_items SET display_profile='COMMUNITY' WHERE type IN ('JANAZAH','NIKAH','SICK_DUA')",
            )
            .run();
        }
      }
    }
  }

  await db.batch(indexes.map((sql) => db.prepare(sql)));
  // Retain legacy schedules: an upgrade must not discard existing data.
}
