# Reviewed fixes and preserving-data upgrade

Goal: Fix the six reviewed defects and deliver a Windows update ZIP that preserves existing credentials, content and media.

Design approved by the user's request to fix the review: bind sessions to user IDs and reject legacy/disabled sessions; revoke sessions on user changes; return a sanitized public state; validate and normalize timezones; use the saved bride name; share an additive, repeatable schema upgrade between runtime and local setup. Keep legacy schedule data, even though the current app no longer reads it.

Execution: inline implementation, regression tests first, then one independent review.

- [x] Reproduce security and public-state defects with real SQLite-backed tests.
- [x] Implement session identity/revocation, public projection, timezone and Nikah fixes.
- [x] Extract shared additive schema upgrade; test old, current and fresh databases, including repeated upgrades.
- [x] Harden backup/upgrade/package scripts: full verified snapshot, protected runtime paths, rollback instructions, no credentials in release ZIP.
- [x] Run tests, typecheck, build, isolated local runtime smoke, independent review, and inspect ZIP.

Tradeoffs: pre-upgrade sessions require sign-in again. Local setup uses the same inspected schema as runtime instead of blindly replaying historical migrations. Historical SQL remains for existing hosted migration workflows. Server upgrade execution is left to the user; no live server is identified in this chat.

Validation: 83 Vitest tests, TypeScript, build, lint (existing React warnings), real local D1 repeat upgrades, HTTP auth/public/R2 smoke, Windows PowerShell success/failure/missing-config fixtures. Independent review identified disabled emergency draft text; fixed with regression coverage. ZIP inspection follows packaging.
