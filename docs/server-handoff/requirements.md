# Verdant Server Deployment Requirements

## Goal

Deploy a small private backend for Verdant Cloud Mode.

Verdant frontend is already public on Vercel:

https://verdant-neon.vercel.app

This public demo must remain available to anyone.
Anonymous visitors must continue using local browser storage only.

The server backend is only for the owner's authenticated personal Cloud Mode.

Frontend source (public): see GitHub repo. The two files that matter for
backend design are `lib/dataStore.ts` and `lib/seedData.ts`. Everything else
is UI and out of scope for this deployment.

## Companion documents

These are in the same folder; read them before implementing:

- `data-model.ts` — frozen TypeScript types the backend must mirror.
- `api-contract.md` — endpoint list, auth, CORS, sample payloads, SQLite schema sketch.
- `sample-backup.json` — a real `exportBackup()` output, the exact JSON the
  `/import` endpoint must accept.

## Hard Requirements

### 1. Public demo behavior must not change
- Anyone can open the Vercel URL.
- No login is required for demo users.
- Anonymous visitors store data locally in their own browser.
- Anonymous visitor data must not be uploaded to this server.

### 2. Cloud Mode is only for the owner
- Single-owner backend. There is no user table, no sign-up, no multi-tenancy.
- All plant records, photos, and timeline data belong to one identity,
  authenticated by a single shared secret (`OWNER_TOKEN`, see §6).

### 3. Server path

Use:

```
/data/r00t/verdant/
```

Recommended structure:

```
/data/r00t/verdant/api        # Node.js app source
/data/r00t/verdant/data       # SQLite database file
/data/r00t/verdant/uploads    # uploaded image files
/data/r00t/verdant/backups    # backup archives
/data/r00t/verdant/docs       # this folder, copied from the frontend repo
```

The agent should only operate inside `/data/r00t/verdant/`. Do not install
global packages, do not modify system-wide nginx/firewall/sshd config, do not
disable SELinux/AppArmor.

### 4. Data storage
- Use SQLite for the first version.
- Database path: `/data/r00t/verdant/data/verdant.sqlite`
- Uploaded images path: `/data/r00t/verdant/uploads`
- Backups path: `/data/r00t/verdant/backups`
- **IDs are client-generated** — the backend stores them verbatim and never
  reassigns. See `data-model.ts` for the rule.
- **Timestamps are ISO 8601 strings** — not unix millis, not Date objects.
- **Conflict resolution: last-write-wins by `updatedAt`.** No merge logic.

### 5. Runtime
- **Node.js 20 LTS** (lock the version).
- Run under **systemd** as a unit named `verdant-api.service`.
- Logs go to **journald**; viewable via `journalctl -u verdant-api`.
- The service must restart automatically on crash and start on boot.

### 6. API
- Port: `3001`, bound to **`127.0.0.1` only** (Tailscale Serve fronts it; the
  port itself should never be reachable from the public internet or LAN).
- `GET /health` is public (no auth) for testing.
- **All other routes require `Authorization: Bearer <OWNER_TOKEN>`.**
- **Do not use cookies.** Tokens travel in the `Authorization` header only.
- `OWNER_TOKEN` is read from `.env`, never committed to source.
- Full endpoint list and shapes: see `api-contract.md`.

### 7. Access
- First-stage access is through **Tailscale only**.
- Do not expose the API as a public internet service.
- Use **Tailscale Serve** to expose `127.0.0.1:3001` as an HTTPS URL on the
  tailnet (e.g. `https://<host>.ts.net`). MagicDNS is already enabled.
- HTTPS certificates handled by Tailscale.

### 8. CORS
The API is on `<host>.ts.net`; the frontend is on `verdant-neon.vercel.app`.
This is cross-origin and must be configured explicitly:

- `Access-Control-Allow-Origin: https://verdant-neon.vercel.app`
  (exact match, do NOT use `*` — we send `Authorization`)
- `Access-Control-Allow-Headers: Authorization, Content-Type`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- Handle `OPTIONS` preflight on every protected route.
- Do **not** enable `Access-Control-Allow-Credentials` (no cookies).

### 9. Photo serving
Photos must NOT be served as anonymous static files. Random filenames are
not enough — without auth, anyone who guesses or scrapes a URL can fetch the
image. Pick one of:

- **Option A**: serve photos through an authenticated route (`GET /photos/:id`
  with `Authorization` header). Frontend pre-fetches and creates a blob URL.
- **Option B**: issue short-lived signed URLs (`?t=<sig>&exp=<unix>`) the
  frontend can drop directly into `<img src>`.

Choose one and document the choice. Default recommendation: **Option A**.

### 10. Backup
Create a simple cron backup script:
- Snapshot the SQLite database (use `sqlite3 .backup` or copy + WAL checkpoint).
- Snapshot the `uploads/` directory (tar.gz).
- Save archives to `/data/r00t/verdant/backups/<YYYY-MM-DD>/`.
- Keep the most recent 30 daily backups; prune older ones.

### 11. Security
- Reject any request without a valid `OWNER_TOKEN`.
- Limit upload file size (suggested 5 MB).
- Accept image MIME types only (`image/jpeg`, `image/png`, `image/webp`).
- Randomize stored filenames; keep the original extension only.
- Files in `uploads/` are never executed (no `+x`, served only via the API).
- All secrets in `.env`, never in source code, never logged.

## Migration

Owner has existing data in their browser's localStorage + IndexedDB. The path
to move it to the server:

1. Owner exports a backup from the frontend (Garden → gear menu → Export backup).
2. Owner uploads the JSON to `POST /import` (see `api-contract.md`).
3. Server validates `app === "verdant"`, `version === 1`, then inserts rows
   verbatim and decodes each photo's base64 `dataUrl` to disk.

The shape of this JSON is `BackupFile` in `data-model.ts`. A real example is
`sample-backup.json`.

## Product Boundary (Important)

Do not replace local storage for demo users. The frontend has two modes:

- **Local Mode** — default for all visitors. Uses browser localStorage +
  IndexedDB. Does not call the server.
- **Cloud Mode** — only after the owner enters the token at `/owner`. Uses
  this server API. Can migrate local data to cloud via the `/import` endpoint
  after explicit confirmation.

Mode detection on the frontend is silent: on app start it pings
`GET /health` on the configured Tailscale URL. Success → Cloud Mode.
Failure → stay in Local Mode. No login UI for demo users.

## Deliverables

When the deployment is done, report back:

1. Is the API running? (output of `systemctl status verdant-api`)
2. Tailscale Serve URL (the `https://<host>.ts.net` address)
3. `GET /health` test result from a Tailscale-connected device
4. Database path (should be `/data/r00t/verdant/data/verdant.sqlite`)
5. Uploads path (should be `/data/r00t/verdant/uploads`)
6. Backup script path + cron schedule
7. How to view logs (`journalctl -u verdant-api -f`)
8. How to restart the service (`sudo systemctl restart verdant-api`)
9. systemd unit file path (e.g. `/etc/systemd/system/verdant-api.service`)
10. Environment variables in use, with locations:
    - `OWNER_TOKEN` (where it lives, how to rotate)
    - `PORT`
    - `DB_PATH`
    - `UPLOADS_DIR`
    - the `.env` file path
11. Photo serving choice (Option A or B from §9)
