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

import { use, useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { usePlant, useTimeline } from "@/hooks/useDataStore";
import PhotoFromStore from "@/components/PhotoFromStore";
import PhotoCompare from "@/components/PhotoCompare";
import {
  type TimelineEntry,
  type ActionType,
  type StateType,
  deleteRecord,
  updateRecord,
  getPhotosByPlant,
  getPhotoNearDate,
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
}: {
  entry: TimelineEntry;
  locale: string;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const tActions = useTranslations("actions");
  const tStates = useTranslations("states");
  const tHome = useTranslations("home");
  const tPlantDetail = useTranslations("plantDetail");

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState(timestampToDateStr(entry.timestamp));
  const [editActions, setEditActions] = useState<Set<ActionType>>(new Set(entry.actions));
  const [editStates, setEditStates] = useState<Set<StateType>>(new Set(entry.states));
  const [editNote, setEditNote] = useState(entry.note ?? "");

  function formatRelative(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (diff === 0) return tHome("today");
    if (diff === 1) return tHome("yesterday");
    return tHome("daysAgo", { days: diff });
  }

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
          {/* Row 1: chips + timestamp (no buttons here) */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex flex-wrap gap-1.5 flex-1">
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
            <div className="flex flex-col items-end flex-shrink-0">
              <p className="text-[10px] whitespace-nowrap" style={{ color: "#b0aba5" }}>{formatRelative(entry.timestamp)}</p>
              <p className="text-[10px] whitespace-nowrap" style={{ color: "#d0cbc3" }}>{formatDate(entry.timestamp, locale)}</p>
            </div>
          </div>

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

          {/* Edit / Delete — subtle text row at bottom, doesn't inflate card height */}
          <div className="flex items-center justify-end gap-3 mt-2 pt-1.5" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            <button
              onClick={() => setIsEditing(true)}
              className="text-[11px] transition-opacity active:opacity-60"
              style={{ color: "#c0b8b0" }}
              aria-label={tPlantDetail("editRecord")}
            >
              {tPlantDetail("editRecord")}
            </button>
            <button
              onClick={handleDelete}
              className="text-[11px] transition-opacity active:opacity-60"
              style={{ color: "#c0b8b0" }}
              aria-label={tPlantDetail("deleteRecord")}
            >
              {tPlantDetail("deleteRecord")}
            </button>
          </div>
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

  const { plant, loading: plantLoading } = usePlant(id);
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
      {/* Hero cover photo */}
      <PhotoFromStore
        photoId={plant.coverPhotoId}
        alt={plant.name}
        className="w-full object-cover"
        style={{ height: 260 }}
        objectFit="cover"
      />

      <div className="px-5 pt-5">
        {/* Plant name + nickname */}
        <h1 className="text-2xl mb-0.5" style={{ color: "#2c2c2c", fontFamily: "var(--font-manrope), sans-serif", fontWeight: 500 }}>
          {plant.name}
          {plant.nickname && (
            <span className="ml-2 text-base font-normal" style={{ color: "#8fad8f" }}>
              {plant.nickname}
            </span>
          )}
        </h1>

        {/* Started on */}
        {plant.startedOn && (
          <p className="text-sm mb-6" style={{ color: "#b0aba5" }}>
            {t("startedOn")} {formatDate(plant.startedOn, locale)}
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
                  onDeleted={reloadTimeline}
                  onUpdated={reloadTimeline}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* FAB → Record page (with pre-selected plant) */}
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
    </div>
  );
}
