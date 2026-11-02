CREATE TABLE IF NOT EXISTS `mayyit_webhook_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `notice_id` integer NOT NULL,
  `payload_hash` text NOT NULL,
  `created_at` text NOT NULL
);
