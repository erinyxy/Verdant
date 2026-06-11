/**
 * cloudSync — push local mutations to the Verdant API in the background.
 *
 * Architecture: see lib/storeMode.ts. We are "local-first": dataStore writes
 * to IndexedDB synchronously, then enqueues a sync task here. The UI is never
 * blocked on the network.
 *
 * Strategy (deliberately simple for a single-owner, single-device app):
 *   - Each mutation enqueues a "sync everything" job (debounced 500 ms).
 *   - The job runs exportBackup() and POSTs to /import?wipe=1 — the same
 *     lossless envelope the server already accepts. No per-entity diffing.
 *   - Failures are logged + retried with backoff; the user is unaware.
 *
 * Why "push the whole thing" instead of per-entity PUT/DELETE?
 *   - The frontend mutation surface is large (savePlant / saveRecord /
 *     deletePlant / reconcilePlantEndedAt / createFarewellMark / ...).
 *     Wiring each one to a matching network call would double the surface
 *     and quickly drift from local logic.
 *   - For a single owner with hundreds of records, an export is well under
 *     a megabyte (compressed during transit).
 *   - When the dataset gets big enough that this hurts, we'll switch to
 *     per-resource PUTs. For now: simple is correct.
 *
 * Pull side (boot-time hydrate) lives in pullFromServer() — fetches plants /
 * records / marks / photos and writes them into the local stores, replacing
 * existing data. Called by SeedInit after detectMode() returns "cloud".
 */

import {
  exportBackup,
  importBackup,
  withSuppressedMutationEvents,
  type BackupFile,
} from "./dataStore";
import { getBaseUrl, getToken, isCloudMode } from "./storeMode";

let _pending: ReturnType<typeof setTimeout> | null = null;
let _inFlight = false;
let _redo = false;
const DEBOUNCE_MS = 500;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Call after any local mutation. No-op in Local Mode. */
export function scheduleSync(): void {
  if (!isCloudMode()) return;
  if (_pending) clearTimeout(_pending);
  _pending = setTimeout(runSync, DEBOUNCE_MS);
}

/** Force-flush any pending sync (used before tab close, manual "Sync now"). */
export async function flushSync(): Promise<void> {
  if (_pending) {
    clearTimeout(_pending);
    _pending = null;
  }
  await runSync();
}

/** One-time hydrate from server → overwrite local. Called on Cloud Mode boot. */
export async function pullFromServer(): Promise<void> {
  const base = getBaseUrl();
  const token = getToken();
  if (!base || !token) throw new Error("Cloud Mode credentials missing");

  type PlantLite = { id: string; coverPhotoId?: string; createdAt: string };
  type PhotoMeta = Record<string, unknown> & { id: string; dataUrl: string };

  const [plants, records, marks] = await Promise.all([
    apiJson<PlantLite[]>("GET", "/plants"),
    apiJson<unknown[]>("GET", "/records"),
    apiJson<unknown[]>("GET", "/marks"),
  ]);

  // Backend requires plantId on GET /photos (no global listing). Iterate
  // per plant in parallel and flatten. This list excludes isCover photos
  // by design (covers are fetched by id below).
  const photoLists = await Promise.all(
    plants.map((p) =>
      apiJson<PhotoMeta[]>("GET", `/photos?plantId=${encodeURIComponent(p.id)}`)
    )
  );
  const photoMetas = photoLists.flat();

  // Decode each signed/authed photo URL to base64 so the local IndexedDB
  // store keeps holding self-contained data URLs (architecture rule §2:
  // <img src={dataUrl}>).
  const photos = await Promise.all(
    photoMetas.map(async (p) => ({
      ...p,
      dataUrl: await fetchAsDataUrl(p.dataUrl),
    }))
  );

  // Cover photos: not returned by /photos?plantId. Fetch by id from
  // /photos/:id (which serves image bytes, not metadata) and synthesize
  // the metadata locally. Timestamp falls back to plant.createdAt — the
  // server has no other anchor for cover-only photos.
  const seen = new Set(photos.map((p) => p.id));
  const covers = (
    await Promise.all(
      plants.map(async (p) => {
        if (!p.coverPhotoId || seen.has(p.coverPhotoId)) return null;
        try {
          const dataUrl = await fetchAsDataUrl(
            `${base}/photos/${encodeURIComponent(p.coverPhotoId)}`
          );
          return {
            id: p.coverPhotoId,
            plantId: p.id,
            timestamp: p.createdAt,
            isCover: true,
            dataUrl,
          };
        } catch {
          // Cover may be missing on server (e.g. coverPhotoId points at a
          // since-deleted photo). Skip; the frontend handles missing covers.
          return null;
        }
      })
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  const backup: BackupFile = {
    app: "verdant",
    version: 1,
    exportedAt: new Date().toISOString(),
    plants: plants as BackupFile["plants"],
    timeline: records as BackupFile["timeline"],
    marks: marks as BackupFile["marks"],
    photos: [...photos, ...covers] as BackupFile["photos"],
  };

  // Suppress mutation events so the pull doesn't immediately schedule a push.
  await withSuppressedMutationEvents(() => importBackup(backup));
}

/** One-time push of current local state to a fresh server. Used by the
 *  "Migrate local data to cloud" button on /owner. */
export async function pushAllToServer(): Promise<{
  plants: number;
  records: number;
  marks: number;
  photos: number;
}> {
  const backup = await exportBackup();
  return apiJson("POST", "/import?wipe=1", backup);
}

// ─── Internals ────────────────────────────────────────────────────────────────

async function runSync(): Promise<void> {
  if (!isCloudMode()) return;
  if (_inFlight) {
    _redo = true;
    return;
  }
  _inFlight = true;
  try {
    const backup = await exportBackup();
    await apiJson("POST", "/import?wipe=1", backup);
  } catch (err) {
    // Network blip, Tailscale dropped, server restart — log and retry once
    // after a short delay. Beyond that we give up; next mutation re-arms us.
    console.warn("[verdant] cloud sync failed, will retry:", err);
    setTimeout(() => {
      _inFlight = false;
      if (isCloudMode()) scheduleSync();
    }, 3000);
    return;
  } finally {
    _inFlight = false;
  }
  if (_redo) {
    _redo = false;
    scheduleSync();
  }
}

async function apiJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = getBaseUrl();
  const token = getToken();
  if (!base || !token) throw new Error("Cloud Mode credentials missing");

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function fetchAsDataUrl(url: string): Promise<string> {
  // Signed URLs accept no header; bearer-protected ones need Authorization.
  // Try plain first (signed); if 401, retry with header.
  const token = getToken();
  let res = await fetch(url);
  if (res.status === 401 && token) {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) throw new Error(`fetch photo ${url} → ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ─── Mutation hook: wire to dataStore writes ──────────────────────────────────
//
// All mutation paths in dataStore.ts already touch localStorage or IndexedDB.
// One listener fans out to a debounced push. Called explicitly from SeedInit
// so it can't be tree-shaken away as an unused module side-effect, and so we
// can attach extra resilience hooks (visibility, pagehide) at boot time.
//
// iOS-specific resilience:
//   - iOS Chrome/Safari can suspend setTimeout in backgrounded tabs, so a
//     pending debounce may never fire. We force a flush whenever the tab
//     becomes visible again.
//   - On pagehide we also flush, but iOS will frequently kill the page
//     before the POST completes — that's why the visibility-based flush
//     above matters more in practice.

export function installSyncListener(): void {
  if (typeof window === "undefined") return;
  // Idempotent: a second call (e.g. React StrictMode double-effect) is a no-op.
  const w = window as unknown as { __verdantSyncInstalled?: boolean };
  if (w.__verdantSyncInstalled) return;
  w.__verdantSyncInstalled = true;

  window.addEventListener("verdant:mutated", () => scheduleSync());

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isCloudMode()) {
      // Tab regained focus — if the previous session debounced or was
      // suspended mid-flight, push now so the server isn't stale.
      void flushSync();
    }
  });

  window.addEventListener("pagehide", () => {
    if (isCloudMode()) void flushSync();
  });
}
