/**
 * Verdant — Data Model (frozen reference for the backend)
 *
 * These are the EXACT shapes the frontend produces and consumes.
 * Backend tables / JSON columns should mirror these. Do not rename fields,
 * do not change optionality, do not assign your own IDs.
 *
 * Conventions:
 *   - All `id` fields are client-generated strings (format: `<unix_ms>-<rand>`).
 *     The backend MUST accept the client's id on create. Never reassign.
 *   - All timestamps are ISO 8601 strings (e.g. "2026-06-07T14:23:00.000Z").
 *     Not unix millis, not Date objects.
 *   - `startedOn` is a date-only ISO string ("YYYY-MM-DD"). Everything else is full datetime.
 *   - Conflict resolution: last-write-wins by `updatedAt`.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ActionType =
  | "water"
  | "fertilize"
  | "repot"
  | "prune"
  | "bringHome"
  | "sow"
  | "sayGoodbye";

export type StateType = "newLeaf" | "blooming" | "sick" | "lookingBeautiful";

// ─── Plant ────────────────────────────────────────────────────────────────────

export interface Plant {
  id: string;
  name: string;
  nickname?: string;
  startedOn?: string;          // "YYYY-MM-DD"
  endedAt?: string;            // ISO 8601 — present means "past" (farewell'd)
  coverPhotoId?: string;       // references Photo.id
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}

// ─── TimelineEntry ────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  plantId: string;
  timestamp: string;           // ISO 8601 — INDEX THIS COLUMN (range queries)
  actions: ActionType[];       // store as JSON array
  states: StateType[];         // store as JSON array
  photoIds: string[];          // store as JSON array; references Photo.id
  note?: string;
}

// ─── Photo ────────────────────────────────────────────────────────────────────
//
// In the current local-only frontend, Photo.dataUrl holds the full base64
// image. On the server, store the binary on disk under /data/r00t/verdant/uploads/
// and serve via an authenticated endpoint. The client's view of a Photo over
// the wire should still match this interface — substitute `dataUrl` with a
// signed/authenticated URL the frontend can stick into <img src=...>.

export interface Photo {
  id: string;
  plantId: string;
  timestamp: string;           // ISO 8601 — INDEX THIS COLUMN
  dataUrl: string;             // on server: replaced with authenticated URL
  thumbnailUrl?: string;       // optional smaller variant
  isCover?: boolean;           // true = exists ONLY as plant avatar; exclude from default lists
}

// ─── GrowthMark ───────────────────────────────────────────────────────────────

export type MilestoneDays = 7 | 30 | 90 | 180 | 365;

export type GrowthMarkEventType =
  | "firstPhoto" | "lastPhoto"
  | "newLeaf" | "blooming" | "sick" | "lookingBeautiful"
  | "repot" | "fertilize" | "prune" | "bringHome";

export interface GrowthMarkEvent {
  timestamp: string;           // ISO 8601
  daysFromStart: number;
  photoId?: string;
  type: GrowthMarkEventType;
}

export interface GrowthMark {
  id: string;
  plantId: string;
  /** "milestone" = 7/30/90/180/365-day card.
   *  "farewell"  = auto-generated on Say goodbye, total lifespan.
   *  Omitted = treat as "milestone" (legacy compat). */
  kind?: "milestone" | "farewell";
  /** milestone: one of MilestoneDays (7/30/90/180/365).
   *  farewell:  total days cared for. */
  milestoneDays: number;
  generatedAt: string;         // ISO 8601
  milestoneDate: string;       // ISO 8601
  events: GrowthMarkEvent[];   // store as JSON
  stats: {
    water: number;
    newLeaf: number;
    blooming: number;
    maintenance: number;
  };                            // store as JSON
  captionKey: string;          // i18n key, resolved by frontend
}

// ─── Backup envelope (used by migration endpoint) ─────────────────────────────

export interface BackupFile {
  app: "verdant";
  version: 1;
  exportedAt: string;          // ISO 8601
  plants: Plant[];
  timeline: TimelineEntry[];
  marks: GrowthMark[];
  photos: Photo[];             // each photo's dataUrl is a full base64 string here
}
