"use client";

/**
 * Plant Detail page — /[locale]/plant/[id]
 *
 * Shows:
 *  - Hero cover photo (full-width)
 *  - Plant name / nickname / startedOn
 *  - Growth Compare module (PhotoCompare + 3 preset tabs)
 *  - Timeline (entries sorted newest-first, each card supports edit & delete)
 *  - FAB → /record?plantId=...
 */

import { use, useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { usePlant, useTimeline } from "@/hooks/useDataStore";
import PhotoFromStore from "@/components/PhotoFromStore";
import PhotoCompare from "@/components/PhotoCompare";
import CoverPhotoPicker from "@/components/CoverPhotoPicker";
import {
  type TimelineEntry,
  type ActionType,
  type StateType,
  deleteRecord,
  updateRecord,
  saveRecord,
  getPhotosByPlant,
  getPhotoNearDate,
  getTogetherDays,
} from "@/lib/dataStore";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type ComparePreset = "7d" | "30d" | "first";

const ACTION_EMOJI: Record<ActionType, string> = {
  water: "💧",
  fertilize: "🌱",
  repot: "🪴",
  prune: "✂️",
  bringHome: "🏠",
  sow: "🌾",
  sayGoodbye: "🍂",
};
const STATE_EMOJI: Record<StateType, string> = {
  newLeaf: "🌿",
  blooming: "🌸",
  sick: "⚠️",
  lookingBeautiful: "💚",
};

const ALL_ACTIONS: ActionType[] = ["water", "fertilize", "repot", "prune", "bringHome", "sow"];
const ALL_STATES: StateType[] = ["newLeaf", "blooming", "sick", "lookingBeautiful"];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Compact "MMM d" (or with year if not the current year). Used in timeline cards. */
function formatPrimaryDate(iso: string, locale: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** YYYY-MM-DD → ISO timestamp at local noon (avoids timezone date-shift). */
function dateStrToTimestamp(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

/** ISO → YYYY-MM-DD for <input type="date"> */
function timestampToDateStr(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Growth Compare sub-component ─────────────────────────────────────────────

function GrowthCompareModule({ plantId }: { plantId: string }) {
  const t = useTranslations("plantDetail");
  const tHome = useTranslations("home");
  const [preset, setPreset] = useState<ComparePreset>("7d");
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [resolvedRight, setResolvedRight] = useState<ComparePreset | null>(null);

  const presets: { key: ComparePreset; label: string }[] = [
    { key: "7d", label: tHome("sevenDaysAgo") },
    { key: "30d", label: tHome("thirtyDaysAgo") },
    { key: "first", label: tHome("firstDay") },
  ];

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const photos = await getPhotosByPlant(plantId);
      if (!photos.length || cancelled) return;
      const left = photos[0];
      if (!cancelled) setLeftId(left.id);

      // For user-selected preset, resolve directly (no auto-fallback when user switches)
      const getTarget = (p: ComparePreset): Date => {
        if (p === "first") return new Date(photos[photos.length - 1].timestamp);
        const d = new Date();
        d.setDate(d.getDate() - (p === "7d" ? 7 : 30));
        return d;
      };

      // Try selected preset first; if no photo, auto-fall through to find best
      const presetsToTry: ComparePreset[] = preset === "7d"
        ? ["7d", "30d", "first"]
        : [preset];  // if user explicitly picked 30d or first, respect it

      for (const p of presetsToTry) {
        const right = await getPhotoNearDate(plantId, getTarget(p));
        if (cancelled) return;
        if (right && right.id !== left.id) {
          setRightId(right.id);
          setResolvedRight(p);
          return;
        }
      }
      if (!cancelled) { setRightId(null); setResolvedRight(null); }
    }
    resolve();
    return () => { cancelled = true; };
  }, [plantId, preset]);

  const rightLabel = resolvedRight ? presets.find((p) => p.key === resolvedRight)?.label : undefined;
  const summaryText = rightId ? t("growthSummary") : t("memoryAccumulating");

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: "#9a948e" }}>
        {t("growthCompare")}
      </h2>

      {/* Preset selector */}
      <div className="flex gap-2 mb-4">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className="text-xs px-3 py-1 rounded-full transition-all"
            style={{
              background: preset === p.key ? "#8fad8f" : "#f0ebe3",
              color: preset === p.key ? "#fff" : "#7a7570",
              fontWeight: preset === p.key ? 600 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl p-4"
        style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      >
        <PhotoCompare
          leftPhotoId={leftId}
          rightPhotoId={rightId}
          leftLabel={tHome("today")}
          rightLabel={rightId ? rightLabel : undefined}
          summaryText={summaryText}
        />
      </div>
    </section>
  );
}

// ─── Timeline entry card ──────────────────────────────────────────────────────

function TimelineCard({
  entry,
  locale,
  onDeleted,
  onUpdated,
  plantStartedOn,
}: {
  entry: TimelineEntry;
  locale: string;
  onDeleted: () => void;
  onUpdated: () => void;
  /** Plant's startedOn (or createdAt fallback). Used to render the
   *  "X days together" caption on sayGoodbye entries. */
  plantStartedOn?: string;
}) {
  const tActions = useTranslations("actions");
  const tStates = useTranslations("states");
  const tPlantDetail = useTranslations("plantDetail");

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState(timestampToDateStr(entry.timestamp));
  const [editActions, setEditActions] = useState<Set<ActionType>>(new Set(entry.actions));
  const [editStates, setEditStates] = useState<Set<StateType>>(new Set(entry.states));
  const [editNote, setEditNote] = useState(entry.note ?? "");

  // 3-dot action menu (Edit / Delete). Persistent text buttons are noisy;
  // these are low-frequency actions, so they live in a popover instead.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleAction(a: ActionType) {
    setEditActions((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  }

  function toggleState(s: StateType) {
    setEditStates((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditDate(timestampToDateStr(entry.timestamp));
    setEditActions(new Set(entry.actions));
    setEditStates(new Set(entry.states));
    setEditNote(entry.note ?? "");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateRecord({
        id: entry.id,
        timestamp: dateStrToTimestamp(editDate),
        actions: Array.from(editActions),
        states: Array.from(editStates),
        note: editNote.trim() || undefined,
      });
      setIsEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(tPlantDetail("deleteRecordConfirm"))) return;
    await deleteRecord(entry.id);
    onDeleted();
  }

  // View mode chips (i18n)
  const chips = [
    ...entry.actions.map((a) => tActions(a)),
    ...entry.states.map((s) => tStates(s)),
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      {isEditing ? (
        /* ── Edit mode ── */
        <div className="space-y-3">
          {/* Date */}
          <input
            type="date"
            value={editDate}
            max={todayStr()}
            onChange={(e) => setEditDate(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl outline-none"
            style={{ background: "#f2ece3", color: "#4a4540", border: "none" }}
          />

          {/* Actions */}
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#9a948e" }}>
              {tPlantDetail("editRecord")} — Actions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ACTIONS.map((a) => {
                const selected = editActions.has(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAction(a)}
                    className="text-xs px-2.5 py-1 rounded-full transition-all"
                    style={{
                      background: selected ? "#8fad8f" : "#e8f0e8",
                      color: selected ? "#fff" : "#5a8a5a",
                    }}
                  >
                    {ACTION_EMOJI[a]} {tActions(a).replace(/^[^\s]+\s/, "")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* States */}
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#9a948e" }}>
              States
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATES.map((s) => {
                const selected = editStates.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleState(s)}
                    className="text-xs px-2.5 py-1 rounded-full transition-all"
                    style={{
                      background: selected ? "#c9a97a" : "#f2ece3",
                      color: selected ? "#fff" : "#8a7a5a",
                    }}
                  >
                    {STATE_EMOJI[s]} {tStates(s).replace(/^[^\s]+\s/, "")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            rows={2}
            placeholder="Optional note..."
            className="w-full text-sm px-3 py-2 rounded-xl outline-none resize-none"
            style={{ background: "#f2ece3", color: "#4a4540", border: "none" }}
          />

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancelEdit}
              className="flex-1 text-xs py-2 rounded-xl"
              style={{ background: "#ede8e0", color: "#7a7570" }}
            >
              {tPlantDetail("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-xs py-2 rounded-xl font-medium"
              style={{ background: "#8fad8f", color: "#fff", opacity: saving ? 0.7 : 1 }}
            >
              {tPlantDetail("save")}
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <>
          {/* Header: chips on the left, primary date + 3-dot menu in the upper-right.
              Edit/Delete live inside the menu; no persistent action row at the bottom. */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {chips.map((c, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "#e8f0e8", color: "#5a8a5a" }}
                >
                  {c}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0 -mt-0.5">
              <span className="text-[11px] whitespace-nowrap" style={{ color: "#b0aba5" }}>
                {formatPrimaryDate(entry.timestamp, locale)}
              </span>

              {/* Action menu — popover wrapper for outside-click handling */}
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={tPlantDetail("recordActionsLabel")}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-opacity active:opacity-50"
                  style={{ color: "#9a948e" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 z-20 rounded-xl overflow-hidden"
                    style={{
                      background: "#fdfaf6",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      minWidth: 120,
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setIsEditing(true); }}
                      className="block w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/[0.03]"
                      style={{ color: "#3a3530" }}
                    >
                      {tPlantDetail("editRecord")}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); handleDelete(); }}
                      className="block w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/[0.03]"
                      style={{ color: "#b85450" }}
                    >
                      {tPlantDetail("deleteRecord")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* "X days together" caption on a sayGoodbye entry — soft, italic,
              like a quiet closing line in a diary. */}
          {entry.actions.includes("sayGoodbye") && plantStartedOn && (() => {
            const start = new Date(plantStartedOn + "T00:00:00").getTime();
            const days = Math.max(0, Math.floor((new Date(entry.timestamp).getTime() - start) / 86400000));
            return (
              <p
                className={[
                  "text-xs mb-1.5",
                  locale === "zh" ? "" : "italic",
                ].join(" ")}
                style={{ color: "#7a7570" }}
              >
                {tPlantDetail("daysTogether", { n: days })}
              </p>
            );
          })()}

          {/* Note */}
          {entry.note && (
            <p className="text-xs italic mb-1.5" style={{ color: "#7a7570" }}>
              &ldquo;{entry.note}&rdquo;
            </p>
          )}

          {/* Photo (first one only for timeline view) */}
          {entry.photoIds[0] && (
            <PhotoFromStore
              photoId={entry.photoIds[0]}
              alt=""
              className="w-full rounded-xl mt-1.5 object-cover"
              style={{ maxHeight: 200 }}
              objectFit="cover"
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("plantDetail");

  const { plant, loading: plantLoading, reload: reloadPlant } = usePlant(id);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [plantMenuOpen, setPlantMenuOpen] = useState(false);
  const [endingPlant, setEndingPlant] = useState(false);
  const plantMenuRef = useRef<HTMLDivElement>(null);

  // Outside-click / Escape closes the plant 3-dot menu.
  useEffect(() => {
    if (!plantMenuOpen) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (plantMenuRef.current && !plantMenuRef.current.contains(e.target as Node)) {
        setPlantMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPlantMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [plantMenuOpen]);
  const { entries, loading: timelineLoading, reload: reloadTimeline } = useTimeline(id);

  if (plantLoading) {
    return (
      <div className="pb-6 animate-pulse">
        <div className="w-full h-64" style={{ background: "#e8f0e8" }} />
        <div className="px-5 pt-5">
          <div className="h-7 w-40 rounded-lg mb-2" style={{ background: "#e8f0e8" }} />
          <div className="h-4 w-24 rounded" style={{ background: "#f2ece3" }} />
        </div>
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="px-5 pt-14 text-center">
        <p style={{ color: "#b0aba5" }}>Plant not found.</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Hero cover photo + camera button to change avatar.
          Note: changing coverPhotoId only swaps the avatar — Growth Compare and
          Milestone marks look up the "first day" photo by timestamp, so this
          edit has no semantic effect there. */}
      <div className="relative">
        <PhotoFromStore
          photoId={plant.coverPhotoId}
          alt={plant.name}
          className="w-full object-cover"
          style={{ height: 260 }}
          objectFit="cover"
        />
        <button
          type="button"
          onClick={() => setCoverPickerOpen(true)}
          aria-label={t("editCover")}
          className="absolute flex items-center justify-center rounded-full transition-opacity active:opacity-70"
          style={{
            bottom: 12,
            right: 12,
            width: 36,
            height: 36,
            background: "rgba(253, 250, 246, 0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            color: "#3a3530",
            boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>
      </div>

      {coverPickerOpen && (
        <CoverPhotoPicker
          plant={plant}
          onClose={() => setCoverPickerOpen(false)}
          onPicked={reloadPlant}
        />
      )}

      <div className="px-5 pt-5">
        {/* Plant name + 3-dot menu (active plants only).
            Past plants are read-only and have no actions; the only way to
            revive them is to delete the sayGoodbye timeline entry. */}
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <h1
            className="text-2xl flex-1 min-w-0"
            style={{
              color: "#2c2c2c",
              fontFamily: "var(--font-manrope), sans-serif",
              fontWeight: 500,
            }}
          >
            {plant.name}
            {plant.nickname && (
              <span className="ml-2 text-base font-normal" style={{ color: "#8fad8f" }}>
                {plant.nickname}
              </span>
            )}
          </h1>

          {!plant.endedAt && (
            <div ref={plantMenuRef} className="relative flex-shrink-0 -mr-1 mt-1">
              <button
                type="button"
                onClick={() => setPlantMenuOpen((v) => !v)}
                aria-label={t("plantActionsLabel")}
                aria-haspopup="menu"
                aria-expanded={plantMenuOpen}
                disabled={endingPlant}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity active:opacity-50"
                style={{ color: "#9a948e" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>

              {plantMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 z-20 rounded-xl overflow-hidden"
                  style={{
                    background: "#fdfaf6",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    minWidth: 160,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setPlantMenuOpen(false);
                      const msg = t("sayGoodbyeConfirm", { name: plant.nickname || plant.name });
                      if (!window.confirm(msg)) return;
                      setEndingPlant(true);
                      try {
                        // Today's date at local noon (matches dateStrToTimestamp).
                        const today = todayStr();
                        await saveRecord({
                          plantId: plant.id,
                          timestamp: dateStrToTimestamp(today),
                          actions: ["sayGoodbye"],
                          states: [],
                          photoIds: [],
                        });
                        await Promise.all([reloadTimeline(), reloadPlant()]);
                      } finally {
                        setEndingPlant(false);
                      }
                    }}
                    className="block w-full text-left px-3 py-2 text-xs transition-colors hover:bg-black/[0.03]"
                    style={{ color: "#3a3530" }}
                  >
                    🍂 {t("sayGoodbye")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Started on + (if past) frozen days-together */}
        {plant.startedOn && (
          <p className="text-sm mb-6" style={{ color: "#b0aba5" }}>
            {t("startedOn")} {formatDate(plant.startedOn, locale)}
            {plant.endedAt && (
              <span>
                {" · "}
                {t("daysTogether", { n: getTogetherDays(plant) })}
                {" 🍂"}
              </span>
            )}
          </p>
        )}

        {/* Growth Compare */}
        <GrowthCompareModule plantId={plant.id} />

        {/* Timeline */}
        <section>
          <h2 className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9a948e" }}>
            {t("timeline")}
          </h2>

          {timelineLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl animate-pulse" style={{ background: "#f5f1eb", height: 80 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm" style={{ color: "#b0aba5" }}>{t("noRecords")}</p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <TimelineCard
                  key={entry.id}
                  entry={entry}
                  locale={locale}
                  onDeleted={() => { reloadTimeline(); reloadPlant(); }}
                  onUpdated={() => { reloadTimeline(); reloadPlant(); }}
                  plantStartedOn={plant.startedOn ?? plant.createdAt.slice(0, 10)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* FAB → Record page (hidden for past plants — they are read-only) */}
      {!plant.endedAt && (
        <button
          onClick={() => router.push(`/${locale}/record?plantId=${plant.id}`)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40 transition-transform active:scale-95"
          style={{ background: "#8fad8f" }}
          aria-label={t("recordButton")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
