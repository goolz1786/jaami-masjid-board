# Security review — 29 October 2026

This review covers the source checkout and isolated local tests. It is not an independent penetration test, a network assessment, or evidence that an existing installation has received the changes.

## Changes prepared

- Windows and Docker startup disable Wrangler's local explorer and local observability. Before the change an isolated server returned an unauthenticated database listing; with the setting enabled, the explorer returned 404. The board and authenticated admin API continued to respond in that test.
- Sign-in attempts are limited per account to five per 15-minute window. The limit can be used to temporarily deny sign-in to a known account, so restrict network access as well. A successful sign-in resets the counter; after a lockout wait for the window to expire.
- Uploads must have a matching PNG, JPEG, WebP or PDF signature. The upload route rejects browser requests with a different Origin, and served media includes `X-Content-Type-Options: nosniff`. File signatures do not prove that an entire file is safe.
- The Windows package excludes runtime data and unrelated workspace folders. The updater retains existing data and creates a rollback backup.
- Dependencies were updated. An npm audit on 29 October reported 11 findings: 2 high, 8 moderate and 1 low; no critical findings. The remaining findings include build and development dependencies. Applicability to the running board has not been established for every advisory.

## Remaining risks and operating requirements

- The Windows service listens on the local network and its firewall rule permits the local subnet and Tailscale. HTTP administration sends passwords and cookies without transport encryption. Use a trusted network, restrict access with the firewall, and arrange a properly configured HTTPS endpoint for remote administration. This update does not add HTTPS.
- Media URLs are accessible without login, including files that are not currently displayed. Only upload material suitable for disclosure to anyone who has the link.
- The installed version may expose the local explorer. Until this update is installed and verified on the server, restrict access to port 3000 to trusted devices or stop the board. Do not assume the server is protected merely because the source has been changed.
- Existing backups contain credentials, database contents and uploaded media. Store backups with restricted access and test restoration securely.
- Initial administrator credentials and a random session secret are created by the Windows installer. Other deployment methods must supply strong unique credentials and a secret; do not use development defaults.
- A file size check occurs after the server parses the multipart request; it is not a network-level request size limit. Use network controls or a reverse proxy to limit request sizes.

## Updating an existing Windows installation

Use the supplied preserving-data upgrade procedure: extract the update outside `C:\JaamiMasjidBoard`, run `UPGRADE-WINDOWS.cmd` as administrator, and retain the verified rollback backup. The updater preserves `.env`, `.board-data` and uploads. After installation, check that the displays and administrator login work and that `/cdn-cgi/local/explorer/api/d1/database` is unavailable from another device. Do not delete the existing installation or its data.
