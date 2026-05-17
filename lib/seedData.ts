/**
 * seedData — one-time mock data initializer.
 *
 * Sits ON TOP of dataStore (never touches localStorage / IndexedDB directly).
 * Call seedIfEmpty(locale) on first client mount; it's a no-op if data exists.
 *
 * Photos are fetched from picsum.photos (stable seed → same image every time),
 * converted to base64 data URLs, and persisted to IndexedDB via dataStore.savePhoto.
 * This satisfies the "screenshot-friendly, same-origin" constraint in CLAUDE.md.
 */

import {
  isDataSeeded,
  savePlant,
  saveRecord,
  savePhoto,
  type ActionType,
  type StateType,
  type Plant,
} from "./dataStore";

type Locale = "en" | "ja" | "zh";

interface PlantSeed {
  key: "pansy" | "rubber" | "daisy";
  names: Record<Locale, string>;
  daysAgo: number; // when caring started
  photoSeeds: string[]; // picsum.photos seeds (one per photo, stable across loads)
  records: Array<{
    dayOffset: number; // 0 = startedOn, increasing toward today
    actions: ActionType[];
    states: StateType[];
    note?: Record<Locale, string>;
    attachPhotoIndex?: number; // index into photoSeeds
  }>;
}

const PLANTS: PlantSeed[] = [
  {
    key: "pansy",
    names: { en: "Pansy", ja: "パンジー", zh: "三色堇" },
    daysAgo: 90,
    photoSeeds: ["verdant-pansy-1", "verdant-pansy-2", "verdant-pansy-3", "verdant-pansy-4", "verdant-pansy-5"],
    records: [
      { dayOffset: 0, actions: ["repot"], states: ["lookingBeautiful"], attachPhotoIndex: 0,
        note: { en: "Welcome home 🌿", ja: "おうちへようこそ 🌿", zh: "欢迎回家 🌿" } },
      { dayOffset: 14, actions: ["water"], states: [], attachPhotoIndex: 1 },
      { dayOffset: 35, actions: ["water", "fertilize"], states: ["newLeaf"], attachPhotoIndex: 2,
        note: { en: "Tiny new leaf today!", ja: "今日、小さな新葉が出た！", zh: "今天长出小新叶了！" } },
      { dayOffset: 58, actions: ["water"], states: ["blooming"], attachPhotoIndex: 3,
        note: { en: "First flower 🌸", ja: "初めての花 🌸", zh: "第一朵花 🌸" } },
      { dayOffset: 75, actions: ["prune"], states: ["lookingBeautiful"], attachPhotoIndex: 4 },
      { dayOffset: 88, actions: ["water"], states: [] },
    ],
  },
  {
    key: "rubber",
    names: { en: "Rubber Tree", ja: "ゴムの木", zh: "橡皮树" },
    daysAgo: 60,
    photoSeeds: ["verdant-rubber-1", "verdant-rubber-2", "verdant-rubber-3", "verdant-rubber-4", "verdant-rubber-5"],
    records: [
      { dayOffset: 0, actions: ["repot"], states: ["lookingBeautiful"], attachPhotoIndex: 0,
        note: { en: "Just got home from the shop", ja: "お店から連れて帰った日", zh: "刚从花店带回家" } },
      { dayOffset: 12, actions: ["water"], states: [], attachPhotoIndex: 1 },
      { dayOffset: 28, actions: ["water", "fertilize"], states: ["newLeaf"], attachPhotoIndex: 2,
        note: { en: "Two new leaves unfurled 🌿", ja: "新葉が二枚開いた 🌿", zh: "两片新叶展开了 🌿" } },
      { dayOffset: 42, actions: ["water"], states: ["lookingBeautiful"], attachPhotoIndex: 3 },
      { dayOffset: 58, actions: ["water"], states: ["newLeaf"], attachPhotoIndex: 4 },
    ],
  },
  {
    key: "daisy",
    names: { en: "Blue-Eyed Daisy", ja: "オステオスペルマム", zh: "蓝眼菊" },
    daysAgo: 30,
    photoSeeds: ["verdant-daisy-1", "verdant-daisy-2", "verdant-daisy-3", "verdant-daisy-4"],
    records: [
      { dayOffset: 0, actions: ["repot"], states: ["lookingBeautiful"], attachPhotoIndex: 0,
        note: { en: "First day together", ja: "初めての一日", zh: "在一起的第一天" } },
      { dayOffset: 8, actions: ["water"], states: [], attachPhotoIndex: 1 },
      { dayOffset: 18, actions: ["water", "fertilize"], states: ["blooming"], attachPhotoIndex: 2,
        note: { en: "Buds appeared 🌸", ja: "蕾が出てきた 🌸", zh: "冒花苞了 🌸" } },
      { dayOffset: 28, actions: ["water"], states: ["blooming", "lookingBeautiful"], attachPhotoIndex: 3 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function picsumUrl(seed: string, size = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── Double-seed protection ───────────────────────────────────────────────────
//
// Two guards layered together:
//
// 1. Module-level promise — blocks concurrent calls within the same JS module
//    instance (React StrictMode double-effect in the same render cycle).
//
// 2. localStorage flag "verdant:seeding" — survives HMR hot-reloads that reset
//    the module-level variable.  Set before any async work; cleared on finish.
//    A stale flag (e.g. from a crash) auto-expires after 30 s.
//
const LS_SEEDING_KEY = "verdant:seeding";
const SEED_TIMEOUT_MS = 30_000;

let _seedInFlight: Promise<void> | null = null;

/**
 * seedIfEmpty — seeds mock data if the store is empty.
 * Returns true if seeding actually ran, false if data already existed.
 * Dispatches "verdant:seeded" on window when new data is ready,
 * so any mounted hooks can re-fetch without a full page reload.
 */
export async function seedIfEmpty(locale: Locale): Promise<boolean> {
  if (typeof window === "undefined") return false; // never seed during SSR

  // 1. Module-level guard (same JS instance, e.g. StrictMode double-effect)
  if (_seedInFlight) { await _seedInFlight; return false; }

  // 2. localStorage guard (survives HMR; also handles concurrent tabs)
  const existing = localStorage.getItem(LS_SEEDING_KEY);
  if (existing) {
    const startedAt = Number(existing);
    if (Date.now() - startedAt < SEED_TIMEOUT_MS) return false; // another run is in progress
    // stale flag — remove and continue
    localStorage.removeItem(LS_SEEDING_KEY);
  }

  // Already seeded?
  if (await isDataSeeded()) return false;

  // Claim the lock
  localStorage.setItem(LS_SEEDING_KEY, String(Date.now()));

  _seedInFlight = runSeed(locale).finally(() => {
    localStorage.removeItem(LS_SEEDING_KEY);
  });

  await _seedInFlight;

  // Notify all mounted hooks that fresh data is available
  window.dispatchEvent(new Event("verdant:seeded"));
  return true;
}

async function runSeed(locale: Locale): Promise<void> {
  for (const seed of PLANTS) {
    const startedAt = isoDaysAgo(seed.daysAgo);

    // 1. create plant (no coverPhotoId yet — need to save photos first)
    const plant: Plant = await savePlant({
      name: seed.names[locale],
      startedOn: startedAt.slice(0, 10), // YYYY-MM-DD
    });

    // 2. save all photos for this plant
    const photoIds: string[] = [];
    for (let i = 0; i < seed.photoSeeds.length; i++) {
      // distribute photo timestamps across the caring period
      const photoDayOffset = Math.round((i * seed.daysAgo) / Math.max(seed.photoSeeds.length - 1, 1));
      const photoTimestamp = isoDaysAgo(seed.daysAgo - photoDayOffset);
      const dataUrl = await fetchAsDataUrl(picsumUrl(seed.photoSeeds[i]));
      const photo = await savePhoto({
        plantId: plant.id,
        timestamp: photoTimestamp,
        dataUrl,
      });
      photoIds.push(photo.id);
    }

    // 3. update plant with coverPhotoId = first (oldest) photo
    await savePlant({
      id: plant.id,
      name: plant.name,
      startedOn: plant.startedOn,
      coverPhotoId: photoIds[0],
    });

    // 4. create timeline records
    for (const r of seed.records) {
      const recordTimestamp = isoDaysAgo(seed.daysAgo - r.dayOffset);
      await saveRecord({
        plantId: plant.id,
        timestamp: recordTimestamp,
        actions: r.actions,
        states: r.states,
        photoIds: r.attachPhotoIndex !== undefined ? [photoIds[r.attachPhotoIndex]] : [],
        note: r.note?.[locale],
      });
    }
  }
}
