# Changelog

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
