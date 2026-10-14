import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    role: text('role').notNull().default('admin'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [uniqueIndex('idx_users_username').on(table.username)],
);

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const programmes = sqliteTable(
  'programmes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    category: text('category').notNull().default('PROGRAMME'),
    imageUrl: text('image_url').notNull().default(''),
    description: text('description').notNull().default(''),
    dateText: text('date_text').notNull().default(''),
    startTime: text('start_time').notNull().default(''),
    endTime: text('end_time').notNull().default(''),
    venue: text('venue').notNull().default(''),
    audience: text('audience').notNull().default(''),
    speaker: text('speaker').notNull().default(''),
    quote: text('quote').notNull().default(''),
    quoteSource: text('quote_source').notNull().default(''),
    eventStart: text('event_start').notNull().default(''),
    eventEnd: text('event_end').notNull().default(''),
    displayFrom: text('display_from').notNull().default(''),
    displayUntil: text('display_until').notNull().default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    showUpcoming: integer('show_upcoming', { mode: 'boolean' })
      .notNull()
      .default(false),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    recurringWeekdays: text('recurring_weekdays').notNull().default('[]'),
    priority: text('priority').notNull().default('NORMAL'),
    displayDuration: integer('display_duration').notNull().default(15),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_programmes_display').on(
      table.active,
      table.showUpcoming,
      table.sortOrder,
    ),
    index('idx_programmes_featured').on(table.featured, table.active),
  ],
);

export const announcements = sqliteTable(
  'announcements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    icon: text('icon').notNull().default('megaphone'),
    type: text('type').notNull().default('General'),
    startDate: text('start_date').notNull().default(''),
    endDate: text('end_date').notNull().default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    panelPosition: integer('panel_position').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    recurringWeekdays: text('recurring_weekdays').notNull().default('[]'),
    priority: text('priority').notNull().default('NORMAL'),
    displayDuration: integer('display_duration').notNull().default(12),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_announcements_display').on(table.active, table.panelPosition),
  ],
);

export const media = sqliteTable(
  'media',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_media_key').on(table.key)],
);

export const donationSettings = sqliteTable('donation_settings', {
  id: integer('id').primaryKey(),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    userId: integer('user_id'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_sessions_expires_at').on(table.expiresAt)],
);

export const changeLog = sqliteTable('change_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  changedAt: text('changed_at').notNull(),
});

export const contentItems = sqliteTable(
  'content_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    displayProfile: text('display_profile').notNull().default('MAIN'),
    zone: text('zone').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    body: text('body').notNull().default(''),
    imageUrl: text('image_url').notNull().default(''),
    icon: text('icon').notNull().default('megaphone'),
    qrUrl: text('qr_url').notNull().default(''),
    details: text('details').notNull().default('{}'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    displayDuration: integer('display_duration').notNull().default(12),
    startAt: text('start_at').notNull().default(''),
    endAt: text('end_at').notNull().default(''),
    recurringWeekdays: text('recurring_weekdays').notNull().default('[]'),
    priority: text('priority').notNull().default('NORMAL'),
    takeover: integer('takeover', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_content_items_display').on(
      table.enabled,
      table.archived,
      table.displayProfile,
      table.zone,
      table.sortOrder,
    ),
    index('idx_content_items_schedule').on(table.startAt, table.endAt),
  ],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: integer('entity_id'),
    summary: text('summary').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_created').on(table.createdAt)],
);

export const hadith = sqliteTable(
  'hadith',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    arabic: text('arabic').notNull(),
    translation: text('translation').notNull(),
    reference: text('reference').notNull(),
    narrator: text('narrator').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_hadith_display').on(table.active, table.sortOrder)],
);
