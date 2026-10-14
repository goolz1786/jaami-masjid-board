CREATE TABLE `hadith` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arabic` text NOT NULL,
	`translation` text NOT NULL,
	`reference` text NOT NULL,
	`narrator` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hadith_display` ON `hadith` (`active`,`sort_order`);
