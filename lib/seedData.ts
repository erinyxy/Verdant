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
  hasUserCleared,
  markSampleData,
  savePlant,
  saveRecord,
  savePhoto,
  type ActionType,
  type StateType,
  type Plant,
} from "./dataStore";

interface PlantSeed {
  key: string;
  name: string; // stored as-is, no locale translation (user-submitted content)
  nickname?: string;
  startedOn: string; // YYYY-MM-DD
  /** Representative "day 1" photo (the plant at its start). Stored as a normal
   *  timeline photo at startedOn (NOT isCover), so it surfaces as Growth Compare
   *  "First Day" and the Milestone firstPhoto event. Inserted before records so
   *  it wins same-day timestamp ties.
   *  If coverPhoto is absent, this photo also becomes the avatar. */
  dayOnePhoto?: string; // path under /demo-photos/
  coverPhoto?: string; // avatar override (isCover=true); path under /demo-photos/
  records: Array<{
    date: string; // YYYY-MM-DD
    actions: ActionType[];
    states: StateType[];
    note?: string; // stored as-is
    photo?: string; // path under /demo-photos/
  }>;
}

const PLANTS: PlantSeed[] = [
  {
    "key": "ゴムノキ",
    "name": "ゴムノキ",
    "startedOn": "2025-11-18",
    "coverPhoto": "/demo-photos/ゴムノキ-cover.jpg",
    "records": [
      {
        "date": "2025-11-23",
        "actions": [
          "water"
        ],
        "states": [
          "lookingBeautiful"
        ],
        "photo": "/demo-photos/ゴムノキ-r0-2025-11-23.jpg"
      },
      {
        "date": "2025-11-27",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "photo": "/demo-photos/ゴムノキ-r1-2025-11-27.jpg"
      },
      {
        "date": "2025-12-01",
        "actions": [
          "repot"
        ],
        "states": []
      },
      {
        "date": "2025-12-30",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "photo": "/demo-photos/ゴムノキ-r3-2025-12-30.jpg"
      },
      {
        "date": "2026-03-30",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "photo": "/demo-photos/ゴムノキ-r4-2026-03-30.jpg"
      },
      {
        "date": "2026-04-18",
        "actions": [
          "fertilize"
        ],
        "states": []
      },
      {
        "date": "2026-04-23",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "photo": "/demo-photos/ゴムノキ-r6-2026-04-23.jpg"
      },
      {
        "date": "2026-04-26",
        "actions": [],
        "states": [
          "sick"
        ],
        "photo": "/demo-photos/ゴムノキ-r7-2026-04-26.jpg"
      },
      {
        "date": "2026-05-13",
        "actions": [],
        "states": [
          "newLeaf"
        ]
      },
      {
        "date": "2026-05-15",
        "actions": [
          "fertilize"
        ],
        "states": []
      },
      {
        "date": "2026-05-17",
        "actions": [
          "water"
        ],
        "states": [
          "lookingBeautiful"
        ],
        "note": "40cmになった",
        "photo": "/demo-photos/ゴムノキ-r10-2026-05-17.jpg"
      }
    ]
  },
  {
    "key": "チューリップ",
    "name": "チューリップ",
    "startedOn": "2025-12-01",
    "dayOnePhoto": "/demo-photos/チューリップ-day1.jpg",
    "coverPhoto": "/demo-photos/チューリップ-cover.jpg",
    "records": [
      {
        "date": "2026-01-15",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "note": "芽が出た",
        "photo": "/demo-photos/チューリップ-r0-2026-01-15.jpg"
      },
      {
        "date": "2026-02-28",
        "actions": [
          "repot",
          "water"
        ],
        "states": [],
        "photo": "/demo-photos/チューリップ-r1-2026-02-28.jpg"
      },
      {
        "date": "2026-04-04",
        "actions": [
          "fertilize"
        ],
        "states": [],
        "photo": "/demo-photos/チューリップ-r2-2026-04-04.jpg"
      },
      {
        "date": "2026-04-07",
        "actions": [
          "water"
        ],
        "states": [
          "blooming",
          "lookingBeautiful"
        ],
        "photo": "/demo-photos/チューリップ-r3-2026-04-07.jpg"
      },
      {
        "date": "2026-04-14",
        "actions": [],
        "states": [
          "lookingBeautiful"
        ],
        "photo": "/demo-photos/チューリップ-r4-2026-04-14.jpg"
      },
      {
        "date": "2026-04-20",
        "actions": [],
        "states": [],
        "note": "花が散った",
        "photo": "/demo-photos/チューリップ-r5-2026-04-20.jpg"
      },
      {
        "date": "2026-05-03",
        "actions": [
          "sayGoodbye"
        ],
        "states": [],
        "note": "ありがとう！さよなら💚",
        "photo": "/demo-photos/チューリップ-r6-2026-05-03.jpg"
      }
    ]
  },
  {
    "key": "オステオスペルマム",
    "name": "オステオスペルマム",
    "startedOn": "2026-02-15",
    "dayOnePhoto": "/demo-photos/オステオスペルマム-day1.jpg",
    "coverPhoto": "/demo-photos/オステオスペルマム-cover.jpg",
    "records": [
      {
        "date": "2026-02-15",
        "actions": [],
        "states": [
          "lookingBeautiful"
        ],
        "note": "Happy new year🥳",
        "photo": "/demo-photos/オステオスペルマム-r0-2026-02-15.jpg"
      },
      {
        "date": "2026-03-27",
        "actions": [],
        "states": [
          "sick"
        ],
        "note": "土替わり",
        "photo": "/demo-photos/オステオスペルマム-r1-2026-03-27.jpg"
      },
      {
        "date": "2026-04-16",
        "actions": [
          "water"
        ],
        "states": [
          "blooming"
        ],
        "photo": "/demo-photos/オステオスペルマム-r2-2026-04-16.jpg"
      },
      {
        "date": "2026-04-22",
        "actions": [
          "repot"
        ],
        "states": []
      },
      {
        "date": "2026-05-06",
        "actions": [],
        "states": [
          "sick"
        ],
        "note": "日差しでぐったりしちゃった",
        "photo": "/demo-photos/オステオスペルマム-r4-2026-05-06.jpg"
      },
      {
        "date": "2026-05-13",
        "actions": [
          "fertilize"
        ],
        "states": []
      }
    ]
  },
  {
    "key": "パンジー・ビオラ",
    "name": "パンジー・ビオラ",
    "startedOn": "2025-10-19",
    "dayOnePhoto": "/demo-photos/パンジー・ビオラ-day1.jpg",
    "coverPhoto": "/demo-photos/パンジー・ビオラ-cover.jpg",
    "records": [
      {
        "date": "2025-10-26",
        "actions": [],
        "states": [
          "newLeaf"
        ],
        "note": "芽が出た",
        "photo": "/demo-photos/パンジー・ビオラ-r0-2025-10-26.jpg"
      },
      {
        "date": "2026-02-17",
        "actions": [
          "water"
        ],
        "states": [
          "blooming"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r1-2026-02-17.jpg"
      },
      {
        "date": "2026-02-28",
        "actions": [
          "repot"
        ],
        "states": [],
        "photo": "/demo-photos/パンジー・ビオラ-r2-2026-02-28.jpg"
      },
      {
        "date": "2026-04-11",
        "actions": [
          "fertilize"
        ],
        "states": [],
        "photo": "/demo-photos/パンジー・ビオラ-r3-2026-04-11.jpg"
      },
      {
        "date": "2026-05-04",
        "actions": [],
        "states": [
          "lookingBeautiful",
          "blooming"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r4-2026-05-04.jpg"
      },
      {
        "date": "2026-05-18",
        "actions": [
          "water"
        ],
        "states": [
          "blooming"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r5-2026-05-18.jpg"
      },
      {
        "date": "2026-05-21",
        "actions": [
          "sow",
          "water"
        ],
        "states": [
          "lookingBeautiful",
          "blooming"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r6-2026-05-21.jpg"
      },
      {
        "date": "2026-05-25",
        "actions": [
          "water"
        ],
        "states": [
          "lookingBeautiful",
          "blooming"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r7-2026-05-25.jpg"
      },
      {
        "date": "2026-05-31",
        "actions": [],
        "states": [
          "lookingBeautiful"
        ],
        "note": "bye bye💚😭",
        "photo": "/demo-photos/パンジー・ビオラ-r8-2026-05-31.jpg"
      },
      {
        "date": "2026-06-10",
        "actions": [],
        "states": [
          "sick"
        ],
        "note": "アブラムシ"
      },
      {
        "date": "2026-06-10",
        "actions": [
          "prune"
        ],
        "states": [
          "sick"
        ],
        "photo": "/demo-photos/パンジー・ビオラ-r10-2026-06-10.jpg"
      }
    ]
  },
  {
    "key": "basil",
    "name": "Basil",
    "startedOn": "2026-04-24",
    "coverPhoto": "/demo-photos/basil-cover.jpg",
    "records": [
      {
        "date": "2026-04-24",
        "actions": [
          "sow"
        ],
        "states": [],
        "note": "水栽培",
        "photo": "/demo-photos/basil-r0-2026-04-24.jpg"
      },
      {
        "date": "2026-04-30",
        "actions": [],
        "states": [
          "lookingBeautiful"
        ],
        "note": "細根が出た"
      },
      {
        "date": "2026-05-06",
        "actions": [
          "repot"
        ],
        "states": [],
        "note": "土に入れた"
      },
      {
        "date": "2026-05-16",
        "actions": [
          "water"
        ],
        "states": []
      },
      {
        "date": "2026-05-18",
        "actions": [],
        "states": [
          "lookingBeautiful"
        ],
        "photo": "/demo-photos/basil-r4-2026-05-18.jpg"
      }
    ]
  }
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
export async function seedIfEmpty(): Promise<boolean> {
  if (typeof window === "undefined") return false; // never seed during SSR

  // 0. The user cleared the sample data — respect that and stay empty.
  if (hasUserCleared()) return false;

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

  _seedInFlight = runSeed().finally(() => {
    localStorage.removeItem(LS_SEEDING_KEY);
    _seedInFlight = null;
  });

  await _seedInFlight;

  // Mark this dataset as sample data so the UI can show the sample banner.
  markSampleData();

  // Notify all mounted hooks that fresh data is available
  window.dispatchEvent(new Event("verdant:seeded"));
  return true;
}

async function runSeed(): Promise<void> {
  for (const seed of PLANTS) {
    // 1. Create plant (no coverPhotoId yet)
    const plant: Plant = await savePlant({
      name: seed.name,
      nickname: seed.nickname,
      startedOn: seed.startedOn,
    });

    // 2a. Day-1 photo (inserted FIRST so it wins same-day timestamp ties and
    //     becomes Growth Compare "First Day" / Milestone firstPhoto).
    //     Stored as a normal (non-cover) photo at startedOn.
    let dayOnePhotoId: string | undefined;
    if (seed.dayOnePhoto) {
      const dataUrl = await fetchAsDataUrl(seed.dayOnePhoto);
      const photo = await savePhoto({
        plantId: plant.id,
        timestamp: new Date(seed.startedOn).toISOString(),
        dataUrl,
      });
      dayOnePhotoId = photo.id;
    }

    // 2b. Create timeline records; track first saved photo for auto-cover
    let firstPhotoId: string | undefined = dayOnePhotoId;

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
        if (!firstPhotoId) firstPhotoId = photo.id;
      }

      const note = r.note;

      await saveRecord({
        plantId: plant.id,
        timestamp,
        actions: r.actions,
        states: r.states,
        photoIds,
        note,
      });
    }

    // 3. Set cover photo: explicit coverPhoto field takes priority,
    //    otherwise fall back to the first timeline photo.
    const coverPath = seed.coverPhoto;
    if (coverPath || firstPhotoId) {
      let coverPhotoId = firstPhotoId;
      if (coverPath) {
        const coverDataUrl = await fetchAsDataUrl(coverPath);
        const coverPhoto = await savePhoto({
          plantId: plant.id,
          timestamp: new Date(seed.startedOn).toISOString(),
          dataUrl: coverDataUrl,
          // Mark as cover-only so it doesn't pollute Growth Compare "First Day"
          // or Milestone firstPhoto queries (those use getPhotosByPlant's
          // default behavior which excludes isCover photos).
          isCover: true,
        });
        coverPhotoId = coverPhoto.id;
      }
      await savePlant({
        id: plant.id,
        name: plant.name,
        nickname: plant.nickname,
        startedOn: plant.startedOn,
        coverPhotoId,
      });
    }
  }
}
