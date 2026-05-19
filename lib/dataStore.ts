/**
 * dataStore — single abstraction layer for all data access.
 *
 * Components NEVER call localStorage or indexedDB directly.
 * Swap this file's internals to migrate to a cloud backend.
 *
 * Storage split:
 *   - Plant metadata + timeline entries  → localStorage (JSON)
 *   - Photos (base64 data URLs)          → IndexedDB  (idb)
 *
 * IndexedDB schema:
 *   store "photos"  — keyPath: photoId (string), index on timestamp
 */

import { openDB, type IDBPDatabase } from "idb";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | "water"
  | "fertilize"
  | "repot"
  | "prune"
  | "bringHome"
  | "sow"
  | "sayGoodbye";
export type StateType = "newLeaf" | "blooming" | "sick" | "lookingBeautiful";

export interface Plant {
  id: string;
  name: string;
  nickname?: string;
  startedOn?: string; // ISO date string, e.g. "2025-01-15"
  /** Set when the plant has departed (annual died, gifted away, etc.).
      ISO 8601 string. When present, the plant is "past" — frozen at this
      point in time. Reconciled from sayGoodbye timeline entries; deleting
      the last sayGoodbye entry clears this and revives the plant. */
  endedAt?: string;
  coverPhotoId?: string; // references a photo in IndexedDB
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface TimelineEntry {
  id: string;
  plantId: string;
  timestamp: string; // ISO 8601 — indexed in IndexedDB, used for all range queries
  actions: ActionType[];
  states: StateType[];
  photoIds: string[]; // references photos in IndexedDB
  note?: string;
}

export interface Photo {
  id: string;
  plantId: string;
  timestamp: string; // ISO 8601
  dataUrl: string; // base64 data URL — use <img src={dataUrl}> not background-image
  thumbnailUrl?: string; // compressed version for list views
  /** True for photos that exist ONLY to serve as a plant cover (not part of
   *  the timeline). Excluded by default from getPhotosByPlant / getPhotoNearDate
   *  so Growth Compare "First Day" and Milestone firstPhoto events use real
   *  timeline photos, not the avatar.
   *  Photos that double as both cover AND a timeline entry (e.g. the user's
   *  first upload via Newcomer) leave this `undefined`. */
  isCover?: boolean;
}

// ─── GrowthMark types ─────────────────────────────────────────────────────────

export type MilestoneDays = 7 | 30 | 90 | 180 | 365;

export type GrowthMarkEventType =
  | "firstPhoto"
  | "lastPhoto"
  | "newLeaf"
  | "blooming"
  | "sick"
  | "lookingBeautiful"
  | "repot"
  | "fertilize"
  | "prune"
  | "bringHome";

export interface GrowthMarkEvent {
  timestamp: string; // ISO 8601
  daysFromStart: number;
  photoId?: string;
  type: GrowthMarkEventType;
}

export interface GrowthMark {
  id: string;
  plantId: string;
  milestoneDays: MilestoneDays;
  generatedAt: string;
  milestoneDate: string;
  events: GrowthMarkEvent[];
  stats: {
    water: number;
    newLeaf: number;
    blooming: number;
    maintenance: number;
  };
  captionKey: string;
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_PLANTS_KEY = "verdant:plants";
const LS_TIMELINE_KEY = "verdant:timeline";
const LS_MARKS_KEY = "verdant:marks";

// ─── IndexedDB setup ─────────────────────────────────────────────────────────

const DB_NAME = "verdant-photos";
const DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("photos")) {
        const store = db.createObjectStore("photos", { keyPath: "id" });
        store.createIndex("plantId", "plantId");
        store.createIndex("timestamp", "timestamp"); // for range queries (annual report etc.)
      }
    },
  });
  return _db;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function loadPlants(): Plant[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_PLANTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function savePlantsToLS(plants: Plant[]) {
  localStorage.setItem(LS_PLANTS_KEY, JSON.stringify(plants));
}

function loadTimeline(): TimelineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_TIMELINE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTimelineToLS(entries: TimelineEntry[]) {
  localStorage.setItem(LS_TIMELINE_KEY, JSON.stringify(entries));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Plant API ────────────────────────────────────────────────────────────────

export async function getAllPlants(): Promise<Plant[]> {
  return loadPlants().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getPlantById(id: string): Promise<Plant | null> {
  return loadPlants().find((p) => p.id === id) ?? null;
}

export async function savePlant(
  data: Omit<Plant, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<Plant> {
  const plants = loadPlants();
  const now = new Date().toISOString();

  if (data.id) {
    // update
    const idx = plants.findIndex((p) => p.id === data.id);
    if (idx === -1) throw new Error(`Plant ${data.id} not found`);
    const updated = { ...plants[idx], ...data, updatedAt: now };
    plants[idx] = updated;
    savePlantsToLS(plants);
    return updated;
  } else {
    // create
    const plant: Plant = { ...data, id: generateId(), createdAt: now, updatedAt: now };
    plants.push(plant);
    savePlantsToLS(plants);
    return plant;
  }
}

export async function deletePlant(id: string): Promise<void> {
  const plants = loadPlants().filter((p) => p.id !== id);
  savePlantsToLS(plants);
  // also clean up timeline + photos + marks
  const entries = loadTimeline().filter((e) => e.plantId !== id);
  saveTimelineToLS(entries);
  const marks = loadMarks().filter((m) => m.plantId !== id);
  saveMarksToLS(marks);
  const db = await getDB();
  const photoKeys = await db.getAllKeysFromIndex("photos", "plantId", id);
  await Promise.all(photoKeys.map((key) => db.delete("photos", key)));
}

// ─── Timeline API ─────────────────────────────────────────────────────────────

export async function getRecordsByPlant(plantId: string): Promise<TimelineEntry[]> {
  return loadTimeline()
    .filter((e) => e.plantId === plantId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getRecordsBetween(start: Date, end: Date): Promise<TimelineEntry[]> {
  return loadTimeline().filter((e) => {
    const ts = new Date(e.timestamp).getTime();
    return ts >= start.getTime() && ts <= end.getTime();
  });
}

export async function getRecordsByMonth(
  year: number,
  month: number // 0-indexed
): Promise<TimelineEntry[]> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return getRecordsBetween(start, end);
}

/** Recompute plant.endedAt from its sayGoodbye timeline entries.
 *  - If any sayGoodbye entries exist, endedAt = earliest one's timestamp
 *  - If none exist, endedAt is cleared (plant "revives")
 *  Idempotent. Called after any timeline mutation on a plant. */
function reconcilePlantEndedAt(plantId: string): void {
  const plants = loadPlants();
  const idx = plants.findIndex((p) => p.id === plantId);
  if (idx === -1) return;

  const goodbyes = loadTimeline()
    .filter((e) => e.plantId === plantId && e.actions.includes("sayGoodbye"))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const newEndedAt = goodbyes[0]?.timestamp;

  if (plants[idx].endedAt !== newEndedAt) {
    plants[idx] = {
      ...plants[idx],
      endedAt: newEndedAt,
      updatedAt: new Date().toISOString(),
    };
    savePlantsToLS(plants);
  }
}

export async function saveRecord(
  data: Omit<TimelineEntry, "id"> & { id?: string }
): Promise<TimelineEntry> {
  const entries = loadTimeline();
  const now = data.timestamp ?? new Date().toISOString();

  let saved: TimelineEntry;
  if (data.id) {
    const idx = entries.findIndex((e) => e.id === data.id);
    if (idx === -1) throw new Error(`Entry ${data.id} not found`);
    entries[idx] = { ...entries[idx], ...data };
    saveTimelineToLS(entries);
    saved = entries[idx];
  } else {
    saved = { ...data, id: generateId(), timestamp: now };
    entries.push(saved);
    saveTimelineToLS(entries);

    // bump plant updatedAt
    const plants = loadPlants();
    const idx = plants.findIndex((p) => p.id === data.plantId);
    if (idx !== -1) {
      plants[idx].updatedAt = now;
      savePlantsToLS(plants);
    }
  }

  // Lifecycle: keep plant.endedAt in sync with sayGoodbye entries.
  reconcilePlantEndedAt(saved.plantId);
  return saved;
}

export async function deleteRecord(id: string): Promise<void> {
  const allEntries = loadTimeline();
  const target = allEntries.find((e) => e.id === id);
  if (!target) return;
  if (target.photoIds.length > 0) {
    const db = await getDB();
    await Promise.all(target.photoIds.map((pid) => db.delete("photos", pid)));
  }
  saveTimelineToLS(allEntries.filter((e) => e.id !== id));
  // If a sayGoodbye entry just got removed, plant may revive.
  reconcilePlantEndedAt(target.plantId);
}

export async function updateRecord(entry: {
  id: string;
  timestamp: string;
  actions: ActionType[];
  states: StateType[];
  note?: string;
}): Promise<void> {
  const allEntries = loadTimeline();
  const idx = allEntries.findIndex((e) => e.id === entry.id);
  if (idx === -1) throw new Error(`Entry ${entry.id} not found`);
  allEntries[idx] = {
    ...allEntries[idx],
    timestamp: entry.timestamp,
    actions: entry.actions,
    states: entry.states,
    note: entry.note,
  };
  saveTimelineToLS(allEntries);
  // Action set or timestamp may have changed — reconcile.
  reconcilePlantEndedAt(allEntries[idx].plantId);
}

// ─── Plant lifecycle helpers ──────────────────────────────────────────────────

/** Is the plant "past" (departed / no longer being cared for)? */
export function isPast(plant: Plant): boolean {
  return !!plant.endedAt;
}

/** Days the user has spent with this plant.
 *  Active plants: today - startDate.
 *  Past plants: endedAt - startDate (frozen).
 *  Clamped to 0 if startDate is somehow after the end. */
export function getTogetherDays(plant: Plant, records: TimelineEntry[] = []): number {
  const start = getPlantStartDate(plant, records).getTime();
  const end = plant.endedAt ? new Date(plant.endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 86400000));
}

// ─── Photo API ────────────────────────────────────────────────────────────────

export async function getPhoto(id: string): Promise<Photo | null> {
  const db = await getDB();
  return db.get("photos", id) ?? null;
}

/** Get all photos for a plant, sorted newest-first.
 *  By default, photos flagged `isCover` are excluded — they live on the
 *  plant only as the avatar and shouldn't pollute timeline / "first day"
 *  queries. Pass `{ includeCover: true }` to see them (e.g. cover picker). */
export async function getPhotosByPlant(
  plantId: string,
  opts: { includeCover?: boolean } = {}
): Promise<Photo[]> {
  const db = await getDB();
  const photos: Photo[] = await db.getAllFromIndex("photos", "plantId", plantId);
  const filtered = opts.includeCover ? photos : photos.filter((p) => !p.isCover);
  return filtered.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function savePhoto(data: Omit<Photo, "id"> & { id?: string }): Promise<Photo> {
  const db = await getDB();
  const photo: Photo = {
    ...data,
    id: data.id ?? generateId(),
    timestamp: data.timestamp ?? new Date().toISOString(),
  };
  await db.put("photos", photo);
  return photo;
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("photos", id);
}

/**
 * Find the most recent photo for a plant taken on or before a given date.
 * Used by the photo comparison component.
 */
export async function getPhotoNearDate(
  plantId: string,
  targetDate: Date
): Promise<Photo | null> {
  const photos = await getPhotosByPlant(plantId);
  // photos is sorted newest-first
  const match = photos.find(
    (p) => new Date(p.timestamp).getTime() <= targetDate.getTime()
  );
  return match ?? null;
}

// ─── GrowthMark API ───────────────────────────────────────────────────────────

const MILESTONES: MilestoneDays[] = [7, 30, 90, 180, 365];

// Used for both same-day merge and >8 truncation.
const EVENT_PRIORITY: Record<GrowthMarkEventType, number> = {
  bringHome: 9,
  lastPhoto: 8,
  firstPhoto: 7,
  blooming: 6,
  newLeaf: 5,
  sick: 4,
  repot: 3,
  lookingBeautiful: 2,
  fertilize: 1,
  prune: 0,
};

function loadMarks(): GrowthMark[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_MARKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveMarksToLS(marks: GrowthMark[]) {
  localStorage.setItem(LS_MARKS_KEY, JSON.stringify(marks));
}

// Priority for startDate: plant.startedOn → earliest timeline entry → plant.createdAt
function getPlantStartDate(plant: Plant, records: TimelineEntry[]): Date {
  if (plant.startedOn) return new Date(plant.startedOn + "T00:00:00");
  if (records.length > 0) return new Date(records[records.length - 1].timestamp);
  return new Date(plant.createdAt);
}

function buildMark(
  plant: Plant,
  ms: MilestoneDays,
  startDate: Date,
  periodRecords: TimelineEntry[], // newest-first
  periodPhotos: Photo[] // newest-first
): GrowthMark {
  const startMs = startDate.getTime();
  const milestoneDate = new Date(startMs + ms * 86400000);

  const daysFromStart = (ts: string) =>
    Math.floor((new Date(ts).getTime() - startMs) / 86400000);

  const events: GrowthMarkEvent[] = [];

  // firstPhoto — earliest photo in period (newest-first → take last)
  const first = periodPhotos[periodPhotos.length - 1];
  events.push({
    timestamp: first.timestamp,
    daysFromStart: daysFromStart(first.timestamp),
    photoId: first.id,
    type: "firstPhoto",
  });

  // lastPhoto — most recent photo in period; skip if same as first
  const last = periodPhotos[0];
  if (last.id !== first.id) {
    events.push({
      timestamp: last.timestamp,
      daysFromStart: daysFromStart(last.timestamp),
      photoId: last.id,
      type: "lastPhoto",
    });
  }

  // For state/action picks: earliest occurrence (records are newest-first, so reverse).
  const stateTypes: StateType[] = ["newLeaf", "blooming", "sick", "lookingBeautiful"];
  for (const s of stateTypes) {
    const earliest = [...periodRecords].reverse().find((r) => r.states.includes(s));
    if (earliest) {
      events.push({
        timestamp: earliest.timestamp,
        daysFromStart: daysFromStart(earliest.timestamp),
        photoId: earliest.photoIds[0],
        type: s,
      });
    }
  }

  // water and bringHome deliberately excluded — only counted in stats.
  // `as const` narrows to literal types so `a` is both a valid ActionType (for
  // .includes) and a valid GrowthMarkEventType (for event.type assignment).
  const actionTypes = ["repot", "fertilize", "prune"] as const;
  for (const a of actionTypes) {
    const earliest = [...periodRecords].reverse().find((r) => r.actions.includes(a));
    if (earliest) {
      events.push({
        timestamp: earliest.timestamp,
        daysFromStart: daysFromStart(earliest.timestamp),
        photoId: earliest.photoIds[0],
        type: a,
      });
    }
  }

  // Merge same-day events: keep the one with the highest priority.
  const byDay = new Map<number, GrowthMarkEvent[]>();
  for (const e of events) {
    const list = byDay.get(e.daysFromStart) ?? [];
    list.push(e);
    byDay.set(e.daysFromStart, list);
  }
  let merged: GrowthMarkEvent[] = [];
  for (const list of byDay.values()) {
    list.sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]);
    merged.push(list[0]);
  }

  // Truncate to 8 by priority if needed.
  if (merged.length > 8) {
    merged.sort((a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]);
    merged = merged.slice(0, 8);
  }

  // Final display order: chronological.
  merged.sort((a, b) => a.daysFromStart - b.daysFromStart);

  const stats = {
    water: periodRecords.filter((r) => r.actions.includes("water")).length,
    newLeaf: periodRecords.filter((r) => r.states.includes("newLeaf")).length,
    blooming: periodRecords.filter((r) => r.states.includes("blooming")).length,
    maintenance: periodRecords.filter(
      (r) =>
        r.actions.includes("fertilize") ||
        r.actions.includes("repot") ||
        r.actions.includes("prune")
    ).length,
  };

  return {
    id: generateId(),
    plantId: plant.id,
    milestoneDays: ms,
    generatedAt: new Date().toISOString(),
    milestoneDate: milestoneDate.toISOString(),
    events: merged,
    stats,
    captionKey: `marks.caption.${ms}days`,
  };
}

export async function getAllMarks(): Promise<GrowthMark[]> {
  return loadMarks().sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

export async function getMarkById(id: string): Promise<GrowthMark | null> {
  return loadMarks().find((m) => m.id === id) ?? null;
}

/**
 * Scan all plants, generate any GrowthMark that should-exist-but-doesn't.
 * Existing marks are never modified (snapshots).
 * Skips milestones with zero photos in the period.
 */
export async function syncMarks(): Promise<GrowthMark[]> {
  if (typeof window === "undefined") return [];

  const plants = loadPlants();
  const existing = loadMarks();
  const newMarks: GrowthMark[] = [];

  for (const plant of plants) {
    const records = await getRecordsByPlant(plant.id);
    const photos = await getPhotosByPlant(plant.id);
    const startDate = getPlantStartDate(plant, records);
    const startMs = startDate.getTime();
    // Past plants freeze daysTogether at endedAt; new milestones can't trigger
    // beyond that point.
    const effectiveNow = plant.endedAt ? new Date(plant.endedAt).getTime() : Date.now();
    const daysTogether = Math.floor((effectiveNow - startMs) / 86400000);

    for (const ms of MILESTONES) {
      if (daysTogether < ms) continue;
      if (existing.some((m) => m.plantId === plant.id && m.milestoneDays === ms)) continue;

      const periodEndMs = startMs + ms * 86400000;
      const inPeriod = (ts: string) => {
        const t = new Date(ts).getTime();
        return t >= startMs && t <= periodEndMs;
      };

      const periodPhotos = photos.filter((p) => inPeriod(p.timestamp));
      if (periodPhotos.length === 0) continue; // no photos → skip

      const periodRecords = records.filter((r) => inPeriod(r.timestamp));
      newMarks.push(buildMark(plant, ms, startDate, periodRecords, periodPhotos));
    }
  }

  const combined = [...existing, ...newMarks];
  if (newMarks.length > 0) saveMarksToLS(combined);

  return combined.sort(
    (a, b) => new Date(b.milestoneDate).getTime() - new Date(a.milestoneDate).getTime()
  );
}

/**
 * Smallest positive (7 - daysTogether) across all plants.
 * Returns null when there are no plants, or when at least one plant already
 * passed 7 days (in which case empty state shouldn't show countdown).
 */
export async function getDaysUntilFirstMilestone(): Promise<number | null> {
  const plants = loadPlants();
  if (plants.length === 0) return null;

  let smallest: number | null = null;
  for (const plant of plants) {
    // Past plants no longer count toward "first milestone is N days away".
    if (plant.endedAt) continue;
    const records = await getRecordsByPlant(plant.id);
    const startDate = getPlantStartDate(plant, records);
    const daysTogether = Math.floor((Date.now() - startDate.getTime()) / 86400000);
    const remaining = 7 - daysTogether;
    if (remaining > 0 && (smallest === null || remaining < smallest)) {
      smallest = remaining;
    }
  }
  return smallest;
}

// ─── Seed / reset helpers ─────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  localStorage.removeItem(LS_PLANTS_KEY);
  localStorage.removeItem(LS_TIMELINE_KEY);
  localStorage.removeItem(LS_MARKS_KEY);
  const db = await getDB();
  await db.clear("photos");
}

export async function isDataSeeded(): Promise<boolean> {
  return loadPlants().length > 0;
}
