ALTER TABLE `content_items` ADD `display_profile` text DEFAULT 'MAIN' NOT NULL;
--> statement-breakpoint
UPDATE `content_items`
SET `display_profile` = 'COMMUNITY'
WHERE `type` IN ('JANAZAH', 'NIKAH', 'SICK_DUA');
--> statement-breakpoint
CREATE INDEX `idx_content_items_display_profile`
ON `content_items` (`enabled`, `archived`, `display_profile`, `zone`, `sort_order`);
