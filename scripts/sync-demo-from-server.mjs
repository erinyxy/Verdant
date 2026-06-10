#!/usr/bin/env node
/**
 * sync-demo-from-server.mjs
 *
 * Pulls the current Verdant Cloud Mode server contents and rewrites:
 *   - public/demo-photos/  (wiped + repopulated from the server)
 *   - lib/seedData.ts      (the PLANTS[] declaration only)
 *
 * Net effect: the public Vercel demo will, after the next deploy, seed each
 * anonymous visitor with whatever the owner currently has on the server.
 *
 * Usage (on a Mac connected to Tailscale):
 *
 *   # one-shot:
 *   VERDANT_BASE=https://117b-company.tailbb76ca.ts.net:8443 \
 *   VERDANT_TOKEN=<owner-token> \
 *   node scripts/sync-demo-from-server.mjs
 *
 *   # or put both in .env.local (gitignored) and just run:
 *   node scripts/sync-demo-from-server.mjs
 *
 * Always inspect `git diff` and `git status public/demo-photos/` before
 * committing — this script is destructive on those two paths.
 *
 * What gets mapped to what (best-effort, since the on-disk PlantSeed shape
 * is hand-curated and the server uses the flat data model):
 *   - Plant.coverPhotoId → seed.coverPhoto (only if photo is isCover=true)
 *   - A non-cover photo whose timestamp == startedOn AND is not referenced
 *     by any timeline entry → seed.dayOnePhoto
 *   - Each TimelineEntry → seed.records[N], picking its FIRST photoId (if
 *     any) as seed.records[N].photo (multi-photo entries lose photos 2..n)
 *   - Plant.endedAt naturally rides along via the sayGoodbye record, no
 *     special handling needed
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DEMO_PHOTOS_DIR = join(REPO_ROOT, "public", "demo-photos");
const SEED_FILE = join(REPO_ROOT, "lib", "seedData.ts");

// ─── .env.local loader (minimal; KEY=value, no exports, no quotes required) ──
function loadEnvLocal() {
  const envPath = join(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m || process.env[m[1]]) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
}
loadEnvLocal();

const BASE = process.env.VERDANT_BASE;
const TOKEN = process.env.VERDANT_TOKEN;
if (!BASE || !TOKEN) {
  console.error(
    "Missing VERDANT_BASE or VERDANT_TOKEN. Set them via env vars or in .env.local."
  );
  process.exit(1);
}

// ─── Small helpers ───────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchPhoto(id) {
  const res = await fetch(`${BASE}/photos/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`/photos/${id} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { buf, ext };
}

function slug(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "plant"
  );
}

const dateOnly = (iso) => iso.slice(0, 10);

// ─── Pull ────────────────────────────────────────────────────────────────────
console.log(`→ Fetching from ${BASE}`);
const plants = await api("/plants");
const allRecords = await api("/records");
console.log(`  ${plants.length} plants, ${allRecords.length} records`);

const nonCoverByPlant = {};
for (const p of plants) {
  nonCoverByPlant[p.id] = await api(
    `/photos?plantId=${encodeURIComponent(p.id)}`
  );
}

// ─── Reset photos dir ────────────────────────────────────────────────────────
console.log(`→ Resetting ${DEMO_PHOTOS_DIR}`);
rmSync(DEMO_PHOTOS_DIR, { recursive: true, force: true });
mkdirSync(DEMO_PHOTOS_DIR, { recursive: true });

// ─── Build PlantSeed[] ───────────────────────────────────────────────────────
const usedKeys = new Set();
function uniqueKey(base) {
  let k = base;
  let i = 2;
  while (usedKeys.has(k)) k = `${base}-${i++}`;
  usedKeys.add(k);
  return k;
}

const seeds = [];
for (const plant of plants) {
  const key = uniqueKey(slug(plant.nickname || plant.name));
  const records = allRecords
    .filter((r) => r.plantId === plant.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Track which photoIds belong to a record so we can detect orphans.
  const claimedPhotoIds = new Set();
  for (const r of records) for (const pid of r.photoIds) claimedPhotoIds.add(pid);

  // Cover photo (separate file, isCover=true).
  let coverPath;
  if (plant.coverPhotoId) {
    try {
      const { buf, ext } = await fetchPhoto(plant.coverPhotoId);
      const fn = `${key}-cover.${ext}`;
      writeFileSync(join(DEMO_PHOTOS_DIR, fn), buf);
      coverPath = `/demo-photos/${fn}`;
    } catch (err) {
      console.warn(`  ! cover for ${plant.name}: ${err.message}`);
    }
  }

  // Day-1 photo: a non-cover orphan at startedOn.
  let dayOnePath;
  const startedDate =
    plant.startedOn || (plant.createdAt && dateOnly(plant.createdAt));
  if (startedDate) {
    const candidate = (nonCoverByPlant[plant.id] || []).find(
      (p) =>
        dateOnly(p.timestamp) === startedDate && !claimedPhotoIds.has(p.id)
    );
    if (candidate) {
      try {
        const { buf, ext } = await fetchPhoto(candidate.id);
        const fn = `${key}-day1.${ext}`;
        writeFileSync(join(DEMO_PHOTOS_DIR, fn), buf);
        dayOnePath = `/demo-photos/${fn}`;
      } catch (err) {
        console.warn(`  ! day1 for ${plant.name}: ${err.message}`);
      }
    }
  }

  // Records (one photo each — the FIRST photoId if there are multiple).
  const recordSeeds = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const rec = { date: dateOnly(r.timestamp), actions: r.actions, states: r.states };
    if (r.note) rec.note = r.note;
    const pid = r.photoIds[0];
    if (pid) {
      try {
        const { buf, ext } = await fetchPhoto(pid);
        const fn = `${key}-r${i}-${dateOnly(r.timestamp)}.${ext}`;
        writeFileSync(join(DEMO_PHOTOS_DIR, fn), buf);
        rec.photo = `/demo-photos/${fn}`;
      } catch (err) {
        console.warn(`  ! record ${i} photo for ${plant.name}: ${err.message}`);
      }
    }
    recordSeeds.push(rec);
  }

  const seed = { key, name: plant.name };
  if (plant.nickname) seed.nickname = plant.nickname;
  if (plant.startedOn) seed.startedOn = plant.startedOn;
  if (dayOnePath) seed.dayOnePhoto = dayOnePath;
  if (coverPath) seed.coverPhoto = coverPath;
  seed.records = recordSeeds;
  seeds.push(seed);
}

// ─── Rewrite the PLANTS[] declaration in lib/seedData.ts ─────────────────────
const seedSrc = readFileSync(SEED_FILE, "utf8");
const startMarker = "const PLANTS: PlantSeed[] = [";
const startIdx = seedSrc.indexOf(startMarker);
if (startIdx < 0) {
  console.error("Could not find PLANTS[] declaration in seedData.ts");
  process.exit(1);
}
// Find the matching `];` for the array literal by tracking depth.
let depth = 0;
let endIdx = -1;
for (let i = startIdx + startMarker.length - 1; i < seedSrc.length; i++) {
  const ch = seedSrc[i];
  if (ch === "[") depth++;
  else if (ch === "]") {
    depth--;
    if (depth === 0) {
      const semi = seedSrc.indexOf(";", i);
      endIdx = semi < 0 ? i + 1 : semi + 1;
      break;
    }
  }
}
if (endIdx < 0) {
  console.error("Could not locate end of PLANTS[] array.");
  process.exit(1);
}

const newDecl = `const PLANTS: PlantSeed[] = ${JSON.stringify(seeds, null, 2)};`;
writeFileSync(SEED_FILE, seedSrc.slice(0, startIdx) + newDecl + seedSrc.slice(endIdx));

console.log(`✓ Wrote ${seeds.length} plants to lib/seedData.ts`);
console.log(`✓ Wrote demo photos to public/demo-photos/`);
console.log(`\nNext: 'git diff lib/seedData.ts', 'git status public/demo-photos/', commit, push.`);
