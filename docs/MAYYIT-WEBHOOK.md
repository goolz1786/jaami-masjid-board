# Mayyit notices: webhook integration

This document is the proposed interface for the masjid display board. The sending system has not supplied a payload or connection details, so its compatibility must be agreed and tested with its developers. Installing the source alone does not configure the connection.

## What it does

`POST /api/webhooks/mayyit` receives one notice and publishes it immediately to the existing Community Board Janazah panel. It uses the existing board schedule: absent an explicit end time, a Janazah notice expires six hours after the burial time, or after the Janazah time if there is no burial time. A new notice already beyond that limit is rejected. Existing notices and data are preserved.

The endpoint is disabled until `MAYYIT_WEBHOOK_SECRET` is configured. It accepts machine-to-machine requests; no admin login cookie is required.

## Security and installation

1. Update the server with the preserving-data Windows upgrade process. Retain the verified backup; do not delete or replace `.env`, `.board-data`, existing notices or uploads.
2. Choose an authenticated, encrypted network path between the sender and board: HTTPS with a trusted certificate, or a properly restricted Tailscale connection. The board currently serves HTTP on the LAN. **Do not expose its port directly to the public internet and do not send the secret over unencrypted LAN HTTP.** Neither HTTPS nor Tailscale is automatically configured by this change.
3. Generate a random secret on the server, for example in administrator PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
   $secret = [Convert]::ToBase64String($bytes)
   ```

4. Add `MAYYIT_WEBHOOK_SECRET="<generated-value>"` as a new line in the existing installation `.env`, without altering existing values. Use a unique secret of at least 32 characters, with no whitespace; it must differ from `SESSION_SECRET`. Treat it like a password. Do not commit it, paste it into a public issue, or put it in the URL. Give it to the sender through a secure channel.
5. Restart the board service using its existing service management procedure. Docker Compose reads the existing `.env` through its read-only mount; direct Docker deployments must pass `MAYYIT_WEBHOOK_SECRET` as an environment variable. Rotating or removing the value invalidates the previous secret; restart and update the sender.
6. Confirm the actual protected URL and port with the network administrator, and test end to end with a clearly labelled sample. Remove the sample through the admin interface afterwards. The update is not installed or verified on the live server by committing source code.

## Request

Send an HTTPS POST to `https://<protected-board-address>/api/webhooks/mayyit` (the address is a placeholder, not a configured service), with:

- `Authorization: Bearer <MAYYIT_WEBHOOK_SECRET>`
- `Content-Type: application/json`
- A JSON body of at most 16 KiB.

Example JSON (sample names and dates only):

```json
{
  "eventId": "mayyit-2030-0001",
  "deceasedName": "Example Person",
  "relationship": "Beloved member of the community",
  "janazahDateTime": "2030-06-01T14:00:00+02:00",
  "janazahLocation": "Example Masjid",
  "burialDateTime": "2030-06-01T15:30:00+02:00",
  "burialLocation": "Example Cemetery",
  "dua": "Please remember the family in your duas."
}
```

`eventId` and `deceasedName` are required, as is at least one of `janazahDateTime` or `burialDateTime`. Event IDs are 1–128 ASCII letters, numbers, dots, underscores, colons or hyphens. The other supported optional string fields are `arabicName`, `leavesFrom`, and `pickupDateTime`, in addition to the example fields. Unknown fields are rejected. Each string is limited to 200 characters, except `dua` (1,000). Dates must be ISO 8601 with seconds and an explicit timezone, for example `2030-06-01T14:00:00+02:00` or `2030-06-01T12:00:00Z`. Optional fractional seconds (1–9 digits) are accepted, such as `2030-06-01T12:00:00.123Z`. Do not assume the server timezone. Date and place details should be verified by the sender before sending because notices are published immediately.

## Responses and retries

- `201`: created, with `{ "noticeId": 123, "duplicate": false }`.
- `200`: exact retry already accepted, with the same ID and `duplicate: true`.
- `400`: invalid or expired notice. Correct the request before retrying.
- `401`: missing or incorrect secret.
- `409`: same `eventId` was previously accepted with different content. Do not reuse IDs for different notices; contact the operator for corrections. This endpoint does not edit or remove notices.
- `413`: request too large; `415`: JSON content type missing; `503`: secret missing or invalid; `500`: temporary server failure.

Persist one unique event ID for each notice and resend the same ID and exact content on a timeout or temporary failure. Successful retries do not create duplicate notices, including if the operator later deletes the notice; a retry does not recreate deleted notices. Keep event IDs stable across sender restarts. The receipt table stores IDs and content hashes, and grows as notices are accepted; manage storage and retention with the server operator.

Example using a shell with `curl`; obtain the URL and token securely, then set `BOARD_URL` and `MAYYIT_WEBHOOK_SECRET` in the sender's secret manager. Avoid shell history, process listings and logs that expose tokens or personal data:

```sh
curl --fail-with-body -X POST "$BOARD_URL/api/webhooks/mayyit" \
  -H "Authorization: Bearer $MAYYIT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @notice.json
```

For production, prefer an HTTP client that retrieves the token from a secret manager rather than putting it in command-line arguments. Retry with backoff; monitor failures without logging authorization headers. Restrict the source network, protect backups and apply ordinary operational monitoring. The webhook does not authenticate message accuracy: anyone with its secret can publish to the TV.
