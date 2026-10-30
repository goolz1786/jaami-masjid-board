# Changelog

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
