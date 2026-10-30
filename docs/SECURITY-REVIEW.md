# Security review — 30 October 2026

This covers source changes, automated tests and a disposable local runtime. It is not a penetration-test certificate or evidence that the masjid server has been updated.

## Fixed in this release

- Disable Wrangler explorer/observability in every supplied launcher; fix npm and Docker credential-file loading.
- Reject cross-origin browser mutations and require JSON content types. Limit actual streamed bytes before parsing: login 8 KiB, administration 64 KiB, uploads 20 MiB plus 64 KiB multipart overhead, with a 30-second body timeout.
- Restrict unpublished media to authenticated users. Published relative and same-origin absolute media links remain public. Responses use no-store, nosniff and a restrictive media CSP. PDFs download on direct navigation and still work in canvas previews.
- Reject missing, short or placeholder session secrets and default-password bootstrap. New or changed passwords require 12–1024 characters; existing accounts and passwords are retained. Setup prompts for credentials and preserves literal password characters.
- Validate account roles, IDs, notice fields and structured details on the server. Ignore malformed legacy detail values on read. Omit account summaries and audit logs from editor responses.
- Retain session revocation and five-attempt/15-minute account throttling; clean expired sessions on successful login.
- Require the automatic Windows service installation at %SystemDrive%\JaamiMasjidBoard, reject linked paths, protect executable/configuration permissions and use LocalService instead of SYSTEM. Only designated runtime directories are writable by the service. Reject unsupported upgrade locations before stopping or copying.
- Exclude credential variants and unrelated/runtime files from Docker build context and update packages.
- Remove the unused shadcn CLI while preserving its CSS with its MIT license. Apply scoped fflate 0.7.5 and esbuild 0.25.12 overrides. A clean install reports zero known npm audit vulnerabilities on 30 October 2026; that is a point-in-time result, not proof of zero vulnerabilities.

## Verification and limits

All 116 automated tests, TypeScript and the production build passed. Build output retains framework sourcemap warnings; scoped lint retains existing React compiler warnings. Windows package/preserving-data upgrade smoke tests cover success, installer failure and missing configuration. Security policy tests inspect the intended ACL and reject unsupported paths without modifying an installation.

Real isolated Wrangler checks passed: HTTP login, authenticated administration, editor restrictions, logout revocation, login throttling, explorer 404, origin/MIME/size rejection, upload, private draft preview, publication and unpublication. A password containing a literal dollar sign, backslash and quote also passed through the real credential loader.

Docker Compose configuration validated; the Docker daemon was unavailable, so full container startup was not tested. Actual Windows LocalService startup and filesystem permission migration require an elevated server acceptance test; this review environment was not elevated.

## Retained risks

**LAN HTTP login remains enabled at the owner's explicit request.** Passwords and cookies are unencrypted in transit. Keep port 3000 off the public internet and restrict access to trusted devices. This release does not install HTTPS or change the existing login address.

Optional alternatives are a trusted HTTPS proxy, or private HTTPS access through [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). [Caddy's HTTPS documentation](https://caddyserver.com/docs/automatic-https) explains certificate management and local certificate trust. Neither is configured here. A proxy deployment must verify origin handling and Secure cookies end to end; do not trust arbitrary forwarded headers.

Before relying on this update, install it on the actual server and verify reboot, login, uploads, both displays and explorer denial from another device. Updating GitHub does not update the server. The app uses Wrangler's local runtime and a beta framework; keep it on a restricted network.

File signatures are not malware scanning. Previously downloaded or cached public files cannot be recalled. Account throttling can temporarily lock out a known username. Per-request limits do not cap concurrent connections or disk usage. Backups contain credentials and board data: restrict access and test restoration.

Automatic date mode contacts Jamiat KZN; external image URLs can also cause network traffic. Use manual date mode and local media for offline operation.

## Upgrade

Extract outside the existing C:\JaamiMasjidBoard installation and run UPGRADE-WINDOWS.cmd as administrator. Keep the verified rollback backup. Existing .env, .board-data and uploads are preserved. Custom locations require a separately reviewed relocation; do not delete the existing data.

Permissions and the task identity change. Use administrator PowerShell for maintenance. If startup fails, retain the backup and follow UPDATE-EXISTING-WINDOWS-SERVER.txt. Short or placeholder SESSION_SECRET values need operator correction before login works. Rotation invalidates sessions; legacy secret-salted password hashes may need recovery, so do not rotate blindly.

Advisories: [fflate ZIP64 parsing](https://github.com/advisories/GHSA-px8p-9vwx-vf98), [esbuild development-server CORS](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
