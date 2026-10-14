# Smart Board Implementation Plan and Delivery Record

## Existing system retained

- Keep the current Vinext/React application, D1 database, R2 media storage, authentication, admin shell, live display renderer, Docker deployment, and Jaami' Masjid branding.
- Add only forward database migrations. Existing programme, announcement, media, user, setting, session, donation, schedule, and change-log data remains intact.
- Keep `/display` as a compatible alias, retain `/display/main` as the landscape board, and add `/display/community` as a separate portrait board.

## Implementation

1. Add explicit `MAIN` and `COMMUNITY` display profiles to reusable content items without duplicating the application or admin system.
2. Add structured Community Board types and zones for Janazah, Nikah, Sick/Dua, Ladies Taleem, external posters, and WhatsApp QR content.
3. Build the portrait renderer with fixed section positions, independent in-section rotation, permanent empty states, and last-valid-state polling.
4. Keep Janazah visually dominant, place Nikah and Sick/Dua side by side, add a fixed Ladies Taleem band, then use the lower area for one to three posters plus a permanent WhatsApp panel.
5. Keep one and two poster layouts large; show three posters together; paginate only when more than three are active, using a configurable 15–20 second interval.
6. Accept JPG, JPEG, PNG, WEBP, and source PDF poster uploads. Preserve original uploads in the existing R2-compatible media store.
7. Extend the existing admin with display targeting, Community Board CRUD sections, status badges, poster reordering, WhatsApp QR generation, and real-route previews for both aspect ratios.
8. Simplify the Main Board bottom strip to Important Notice, Community Announcement, and Donation. Hide the Upcoming section entirely when empty so the programme area expands cleanly.
9. Extend the Windows display-client installer so each display PC can be assigned to the landscape Main route or portrait Community route.
10. Validate scheduling, migration shape, display targeting, poster layout/pagination, TypeScript, production build, and rendered output at Full HD and 4K-equivalent resolutions.

## Safety and compatibility

- Migration `0004_community_display.sql` is additive. It adds the display-profile column and targets existing Janazah, Nikah, and Sick/Dua items to the Community Board while leaving all records and media intact.
- Xibo is not present in the inspected project, so no Xibo code is changed; the direct Chromium display remains independent of it.
- Uploaded files stay in R2-compatible storage and local Docker data stays in its named volume.
- Secrets remain in `.env`, which is ignored by Git.
