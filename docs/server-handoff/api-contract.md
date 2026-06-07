# Verdant API Contract

Backend reference for the Cloud Mode backend. Field shapes are in
[`data-model.ts`](./data-model.ts) — this doc only specifies endpoints,
auth, and example payloads.

## Conventions

- **Base URL**: whatever Tailscale Serve exposes (e.g. `https://<host>.ts.net`).
- **Auth**: all routes except `GET /health` require
  `Authorization: Bearer <OWNER_TOKEN>`. Token lives in server `.env`.
  Reject missing/wrong token with `401`. **No cookies.**
- **CORS**: allow origin `https://verdant-neon.vercel.app`. Allow headers
  `Authorization, Content-Type`. Handle `OPTIONS` preflight. Do NOT enable
  `Allow-Credentials`.
- **IDs**: client-generated strings. Backend stores them as-is, never reassigns.
- **Timestamps**: ISO 8601 strings everywhere. `startedOn` is date-only `YYYY-MM-DD`.
- **Upsert semantics**: `PUT /<resource>/:id` creates if missing, updates if present.
  This makes retries idempotent and offline-friendly.
- **Errors**: JSON `{ "error": "<message>" }` with appropriate HTTP status.
- **Conflict policy**: last-write-wins by `updatedAt`. No merge logic.

---

## Endpoints

### `GET /health`
Public. No auth.
```json
{ "ok": true, "version": "1.0.0" }
```

### `POST /auth/verify`
Used by the `/owner` page on the frontend to confirm a freshly-entered token is valid.
The request itself carries the candidate token in the header — the body is empty.
```
200 → { "ok": true }
401 → { "error": "invalid token" }
```

### Plants

```
GET    /plants            → Plant[]
GET    /plants/:id        → Plant | 404
PUT    /plants/:id        → Plant       (body: Plant, upsert)
DELETE /plants/:id        → 204
```
Deleting a plant must also delete its timeline entries, marks, and photos
(cascade in SQL or in handler — either is fine).

### Timeline (records)

```
GET    /records?plantId=<id>             → TimelineEntry[]
GET    /records?from=<iso>&to=<iso>      → TimelineEntry[]   (optional, for reports)
PUT    /records/:id                      → TimelineEntry     (body: TimelineEntry, upsert)
DELETE /records/:id                      → 204
```

### Growth Marks

```
GET    /marks                            → GrowthMark[]
PUT    /marks/:id                        → GrowthMark        (body: GrowthMark, upsert)
DELETE /marks/:id                        → 204
```
Marks are snapshots — the frontend never edits them after creation, only
inserts new ones or deletes (e.g. revived plant clears farewell mark).

### Photos

Photo upload is the only multipart endpoint.

```
POST   /photos                           → Photo
  Content-Type: multipart/form-data
  fields:
    id         (string, required, client-generated)
    plantId    (string, required)
    timestamp  (ISO 8601 string, required)
    isCover    ("true" | "false", optional)
    file       (binary, image/* only, max 5 MB)
```
Server saves the file to `/data/r00t/verdant/uploads/<random>.<ext>`,
records the row in SQLite, returns the `Photo` JSON with `dataUrl` replaced
by the authenticated URL (see below).

```
GET    /photos?plantId=<id>              → Photo[]
GET    /photos/:id                       → image bytes (auth required, Content-Type: image/*)
DELETE /photos/:id                       → 204
```

The frontend uses `<img src="<base>/photos/:id">`. Because the route requires
`Authorization`, the frontend must either:
- pre-fetch + create a blob URL, or
- the backend issues a short-lived signed URL (`?t=<sig>&exp=<unix>`) the
  frontend can stick directly in `<img src>`.

**Pick one and document it.** Signed URLs are simpler for the frontend; pure
auth-header is simpler for the backend. Either works.

### Migration (one-shot)

```
POST   /import                           → { plants: N, records: N, marks: N, photos: N }
  Content-Type: application/json
  body: BackupFile   (see data-model.ts)
```
Accepts the exact JSON the frontend's `exportBackup()` produces. Server should:
1. Validate `app === "verdant"` and `version === 1`. Reject otherwise.
2. Wipe existing data (or refuse if non-empty — owner's call; recommend a `?wipe=1` flag).
3. Insert all rows verbatim.
4. For each photo, decode `dataUrl` base64 and write to `uploads/`.
5. Return counts.

This is the migration path for moving existing browser data to the server.

---

## Sample request

```http
PUT /plants/1717000000000-a1b2c3 HTTP/1.1
Host: <tailscale-host>.ts.net
Authorization: Bearer <OWNER_TOKEN>
Content-Type: application/json

{
  "id": "1717000000000-a1b2c3",
  "name": "チューリップ",
  "nickname": "tulip-1",
  "startedOn": "2026-03-15",
  "createdAt": "2026-03-15T08:00:00.000Z",
  "updatedAt": "2026-06-07T12:34:56.789Z"
}
```

---

## SQLite schema sketch (suggestion, non-binding)

```sql
CREATE TABLE plants (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  nickname     TEXT,
  started_on   TEXT,
  ended_at     TEXT,
  cover_photo_id TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE timeline (
  id         TEXT PRIMARY KEY,
  plant_id   TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  actions    TEXT NOT NULL,   -- JSON array
  states     TEXT NOT NULL,   -- JSON array
  photo_ids  TEXT NOT NULL,   -- JSON array
  note       TEXT
);
CREATE INDEX idx_timeline_plant ON timeline(plant_id);
CREATE INDEX idx_timeline_ts    ON timeline(timestamp);

CREATE TABLE marks (
  id              TEXT PRIMARY KEY,
  plant_id        TEXT NOT NULL,
  kind            TEXT,
  milestone_days  INTEGER NOT NULL,
  generated_at    TEXT NOT NULL,
  milestone_date  TEXT NOT NULL,
  events          TEXT NOT NULL,   -- JSON
  stats           TEXT NOT NULL,   -- JSON
  caption_key     TEXT NOT NULL
);

CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  plant_id     TEXT NOT NULL,
  timestamp    TEXT NOT NULL,
  filename     TEXT NOT NULL,   -- on-disk file under uploads/
  mime_type    TEXT NOT NULL,
  is_cover     INTEGER DEFAULT 0
);
CREATE INDEX idx_photos_plant ON photos(plant_id);
CREATE INDEX idx_photos_ts    ON photos(timestamp);
```

---

## Out of scope for v1

- Multi-user accounts
- Public sign-up
- Realtime sync / websockets
- Server-side image processing (thumbnails are optional; frontend already compresses)
- Conflict-free merge — last-write-wins is enough for single-owner usage
