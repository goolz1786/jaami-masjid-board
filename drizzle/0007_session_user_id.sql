-- Existing username-only sessions remain unbound and require sign-in again.
-- Never backfill user_id from username: a username may have been reused.
ALTER TABLE `sessions` ADD `user_id` integer;
