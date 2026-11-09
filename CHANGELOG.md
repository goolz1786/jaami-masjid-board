# Changelog

## 2026-11-09 — Windows upgrade warning

- Mark both 8 November recovery previews as unsuitable for installation. The masjid server created a verified backup but the later preview failed in the production build with Windows status `0xC0000374`; the previous application was restored. The component and underlying cause remain unconfirmed.
- Correct the upgrade documentation: automatic service setup rejects locations other than `%SystemDrive%\JaamiMasjidBoard`, even if an `-InstallPath` argument is supplied.
- Document an unresolved watchdog limitation: a detached board worker without a recorded runner or port 3000 listener may go undetected, and the watchdog can still request a restart. This does not establish that recovery will succeed.

## 2026-11-08 — Upgrade shutdown correction

- Check for unexpected board processes before stopping the existing service. Stop a verified runner's process tree and wait for its children to exit before taking the rollback backup; leave unverified processes untouched.
- The earlier recovery preview failed to back up a database locked by a separate board worker on the masjid PC. The update stopped before copying files, but the previous service required manual recovery. The worker's original detachment cause remains unconfirmed.
- Tested with an actual exclusively locked test database, a disposable board runtime and simulated upgrade failures. Scheduled-task shutdown, installation ACL changes and recovery still require verification on the target server.

## 2026-11-08 — Windows service recovery

- Prevent old locked log files and ordinary native warning output from stopping a new board launch. Give each run separate logs, reduce routine request logging and treat any unexpected worker exit as a failure for the scheduled-task retry policy.
- Add a watchdog that checks the board, verifies the scheduled task and process ownership, and attempts bounded recovery after repeated failures. Unknown processes and task definitions are left untouched.
- Coordinate the watchdog with manual stops, backups, upgrades and uninstall; retain existing data and rollback backups. Extend diagnostics and add a [Windows recovery guide](docs/WINDOWS-RECOVERY.md).
- Verify with isolated Windows failure simulations, a real disposable Wrangler process, preservation tests, the application suite, TypeScript and build. Actual scheduled-task registration, ACL migration and reboot on the masjid server still require a controlled acceptance test.

## 2026-11-02 — Webhook timestamp compatibility

- Accept ISO 8601 timestamps with optional fractional seconds and an explicit timezone, including JavaScript's standard millisecond format. Malformed timestamps remain rejected.

## 2026-11-02 — Mayyit notice webhook

- Add an optional, authenticated webhook for external systems to send Janazah notices to the Community Board immediately.
- Validate notice fields and timestamps, reject expired notices, and prevent duplicate notices when deliveries are retried.
- Add an additive database migration and a [setup and integration guide](docs/MAYYIT-WEBHOOK.md) covering authentication, example requests, responses and deployment requirements.
- Keep the endpoint disabled until a separate secret is configured. A secure HTTPS or private Tailscale connection must be arranged and tested for the actual installation.
- Verify with 120 automated tests, a TypeScript check, a production build and isolated local webhook tests. Existing board data is preserved during the schema upgrade.

## 2026-10-30 — Access controls and deployment hardening

- Make unpublished uploads private while keeping published TV images/PDFs accessible, including existing same-origin absolute links.
- Add origin checks, streamed request limits, JSON content-type enforcement and server-side account/content validation. Hide account/audit records from editors.
- Remove default-password bootstrap and session-secret fallbacks. Preserve existing accounts and require stronger new passwords.
- Protect all startup paths, fix npm/Docker credential loading and preserve literal password characters. Restrict Windows permissions and use LocalService; reject unsupported upgrade locations before replacement.
- Remove unused CLI dependencies and apply targeted patches. Clean installation and npm audit report zero known vulnerabilities.
- Retain LAN HTTP login by owner request. HTTPS, actual Windows service acceptance and full Docker startup remain deployment work. See the [security review](docs/SECURITY-REVIEW.md) for verification and limitations.

Earlier entries describe their respective release dates. The current security review supersedes their outstanding-finding lists.

## 2026-10-29 — Security hardening

- Disable Wrangler's local data explorer and observability interface in the Windows and Docker startup paths. A local-server test confirmed the explorer was available without application login before the change and returned 404 after it.
- Limit sign-in attempts per account to five in a 15-minute window. Successful sign-in clears the counter; an account that reaches the limit must wait for the window to expire.
- Reject uploads whose file signature does not match the declared image or PDF type, reject cross-origin browser uploads, and prevent browsers from sniffing served media types.
- Exclude unrelated `output` and `sites` folders from Windows update packages and upgrade copies.
- Update dependencies to address several reported advisories. See [security review](docs/SECURITY-REVIEW.md) for remaining risks and deployment limits.

## 2026-10-29 — Notice previews and Windows update guide

### Added

- Preview notices in their TV layout before saving or publishing them.
- Show poster thumbnails and explanations for administration actions.
- Include a Windows update guide with backup, verification and recovery steps.

### Improved

- Share display state handling between the main and community boards and their previews.
- Update Windows upgrade instructions to keep existing configuration and board data.
- Expand automated coverage for previews and Windows upgrade contracts.

### Verification and security review

- Automated tests: 95 passed. TypeScript check and production build passed.
- Existing security regression tests cover session revocation and public-state filtering.
- A dependency audit on 29 October 2026 reported outstanding advisories, including packages used by development tooling. Their presence does not by itself establish that the running board is exploitable; dependency upgrades and applicability require further review.
- The Windows installer permits access from the local subnet and Tailscale. Network access to the admin page uses HTTP by default, so credentials and session cookies are not encrypted in transit. Restrict access to trusted networks and use an appropriately configured HTTPS endpoint if remote administration is needed.
- The login route has no application-level rate limiting. Uploaded media URLs are accessible without signing in; avoid uploading confidential material.
- The supplied Windows installer asks for an administrator password and creates a random session secret. Other deployment methods must also configure strong, unique values rather than relying on example or development defaults.

This review is not an independent penetration test and does not verify the security of a particular installation, its network, or its backups.
