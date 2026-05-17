/**
 * seedData — one-time real data initializer.
 *
 * Sits ON TOP of dataStore (never touches localStorage / IndexedDB directly).
 * Call seedIfEmpty(locale) on first client mount; it's a no-op if data exists.
 *
 * Photos are fetched from /demo-photos/ (static assets bundled in /public),
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
  key: string;
  names: Record<Locale, string>;
  nickname?: string;
  startedOn: string; // YYYY-MM-DD
  coverPhoto: string; // path under /demo-photos/
  records: Array<{
    date: string; // YYYY-MM-DD
    actions: ActionType[];
    states: StateType[];
    note?: Record<Locale, string>;
    photo?: string; // path under /demo-photos/
  }>;
}

const PLANTS: PlantSeed[] = [
  {
    key: "rubber",
    names: { en: "Rubber Tree", ja: "ゴムノキ", zh: "橡皮树" },
    nickname: "gogo",
    startedOn: "2025-11-27",
    coverPhoto: "/demo-photos/rubber-cover.jpg",
    records: [
      {
        date: "2025-12-01",
        actions: ["repot"],
        states: [],
      },
      {
        date: "2025-12-15",
        actions: [],
        states: ["newLeaf", "lookingBeautiful"],
        photo: "/demo-photos/rubber-rec1-photo0.jpg",
      },
      {
        date: "2026-04-14",
        actions: [],
        states: ["sick"],
      },
      {
        date: "2026-05-13",
        actions: [],
        states: ["newLeaf", "lookingBeautiful"],
      },
      {
        date: "2026-05-14",
        actions: ["fertilize"],
        states: [],
      },
      {
        date: "2026-05-17",
        actions: [],
        states: ["lookingBeautiful"],
        note: {
          en: "Grew to 40cm!",
          ja: "40cmになった",
          zh: "长到40cm了！",
        },
        photo: "/demo-photos/rubber-rec5-photo0.jpg",
      },
    ],
  },
  {
    key: "daisy",
    names: { en: "Osteospermum", ja: "オステオスペルマム", zh: "蓝眼菊" },
    nickname: "Fay",
    startedOn: "2026-02-14",
    coverPhoto: "/demo-photos/daisy-cover.jpg",
    records: [
      {
        date: "2026-02-15",
        actions: [],
        states: ["lookingBeautiful"],
        note: {
          en: "Happy new year! 🌸",
          ja: "happy new year!",
          zh: "新年快乐！🌸",
        },
        photo: "/demo-photos/daisy-rec0-photo0.jpg",
      },
      {
        date: "2026-02-15",
        actions: ["repot"],
        states: [],
      },
      {
        date: "2026-03-27",
        actions: [],
        states: ["sick"],
        photo: "/demo-photos/daisy-rec2-photo0.jpg",
      },
      {
        date: "2026-04-16",
        actions: [],
        states: ["blooming"],
        photo: "/demo-photos/daisy-rec3-photo0.jpg",
      },
      {
        date: "2026-04-22",
        actions: ["repot"],
        states: [],
      },
    ],
  },
  {
    key: "tulip",
    names: { en: "Tulip", ja: "チューリップ", zh: "郁金香" },
    startedOn: "2025-12-25",
    coverPhoto: "/demo-photos/tulip-cover.jpg",
    records: [
      {
        date: "2026-02-28",
        actions: ["repot"],
        states: [],
      },
      {
        date: "2026-03-17",
        actions: [],
        states: ["newLeaf"],
        photo: "/demo-photos/tulip-rec1-photo0.jpg",
      },
      {
        date: "2026-04-07",
        actions: [],
        states: ["lookingBeautiful", "blooming"],
        photo: "/demo-photos/tulip-rec2-photo0.jpg",
      },
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
 * seedIfEmpty — seeds real demo data if the store is empty.
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
    if (Date.now() - startedAt < SEED_TIMEOUT_MS) return false;
    localStorage.removeItem(LS_SEEDING_KEY);
  }

  // Already seeded?
  if (await isDataSeeded()) return false;

  // Claim the lock
  localStorage.setItem(LS_SEEDING_KEY, String(Date.now()));

  _seedInFlight = runSeed(locale).finally(() => {
    localStorage.removeItem(LS_SEEDING_KEY);
    _seedInFlight = null;
  });

  await _seedInFlight;

  // Notify all mounted hooks that fresh data is available
  window.dispatchEvent(new Event("verdant:seeded"));
  return true;
}

async function runSeed(locale: Locale): Promise<void> {
  for (const seed of PLANTS) {
    // 1. Create plant (no coverPhotoId yet)
    const plant: Plant = await savePlant({
      name: seed.names[locale],
      nickname: seed.nickname,
      startedOn: seed.startedOn,
    });

    // 2. Fetch and save cover photo
    const coverDataUrl = await fetchAsDataUrl(seed.coverPhoto);
    const coverPhoto = await savePhoto({
      plantId: plant.id,
      timestamp: new Date(seed.startedOn).toISOString(),
      dataUrl: coverDataUrl,
    });

    // 3. Update plant with coverPhotoId
    await savePlant({
      id: plant.id,
      name: plant.name,
      nickname: plant.nickname,
      startedOn: plant.startedOn,
      coverPhotoId: coverPhoto.id,
    });

    // 4. Create timeline records
    for (const r of seed.records) {
      const timestamp = new Date(r.date).toISOString();
      let photoIds: string[] = [];

      if (r.photo) {
        const dataUrl = await fetchAsDataUrl(r.photo);
        const photo = await savePhoto({
          plantId: plant.id,
          timestamp,
          dataUrl,
        });
        photoIds = [photo.id];
      }

      await saveRecord({
        plantId: plant.id,
        timestamp,
        actions: r.actions,
        states: r.states,
        photoIds,
        note: r.note?.[locale],
      });
    }
  }
}
