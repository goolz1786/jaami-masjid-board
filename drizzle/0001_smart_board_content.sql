ALTER TABLE `users` ADD `role` text DEFAULT 'admin' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD `active` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `programmes` ADD `recurring_weekdays` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `programmes` ADD `priority` text DEFAULT 'NORMAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE `programmes` ADD `display_duration` integer DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE `programmes` ADD `speaker` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `recurring_weekdays` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `priority` text DEFAULT 'NORMAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `display_duration` integer DEFAULT 12 NOT NULL;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `archived` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE `content_items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `zone` text NOT NULL,
  `title` text NOT NULL,
  `subtitle` text DEFAULT '' NOT NULL,
  `body` text DEFAULT '' NOT NULL,
  `image_url` text DEFAULT '' NOT NULL,
  `icon` text DEFAULT 'megaphone' NOT NULL,
  `qr_url` text DEFAULT '' NOT NULL,
  `details` text DEFAULT '{}' NOT NULL,
  `enabled` integer DEFAULT true NOT NULL,
  `archived` integer DEFAULT false NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `display_duration` integer DEFAULT 12 NOT NULL,
  `start_at` text DEFAULT '' NOT NULL,
  `end_at` text DEFAULT '' NOT NULL,
  `recurring_weekdays` text DEFAULT '[]' NOT NULL,
  `priority` text DEFAULT 'NORMAL' NOT NULL,
  `takeover` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_content_items_display` ON `content_items` (`enabled`,`archived`,`zone`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_content_items_schedule` ON `content_items` (`start_at`,`end_at`);
--> statement-breakpoint
CREATE TABLE `audit_log` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `username` text NOT NULL,
  `action` text NOT NULL,
  `entity` text NOT NULL,
  `entity_id` integer,
  `summary` text DEFAULT '' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);
