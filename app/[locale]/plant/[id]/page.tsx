"use client";

/**
 * Plant Detail page — /[locale]/plant/[id]
 *
 * Shows:
 *  - Hero cover photo (full-width)
 *  - Plant name / nickname / startedOn
 *  - Growth Compare module (PhotoCompare + 3 preset tabs)
 *  - Timeline (entries sorted newest-first)
 *  - FAB → /record?plantId=...
 */

import { use, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { usePlant, useTimeline, useComparePhotoIds } from "@/hooks/useDataStore";
import PhotoFromStore from "@/components/PhotoFromStore";
import PhotoCompare from "@/components/PhotoCompare";
import { type TimelineEntry, type ActionType, type StateType } from "@/lib/dataStore";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type ComparePreset = "7d" | "30d" | "first";

const ACTION_EMOJI: Record<ActionType, string> = {
  water: "💧",
  fertilize: "🌱",
  repot: "🪴",
  prune: "✂️",
  bringHome: "🏠",
};
const STATE_EMOJI: Record<StateType, string> = {
  newLeaf: "🌿",
  blooming: "🌸",
  sick: "⚠️",
  lookingBeautiful: "💚",
};

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

// ─── Growth Compare sub-component ─────────────────────────────────────────────

function GrowthCompareModule({ plantId }: { plantId: string }) {
  const t = useTranslations("plantDetail");
  const tHome = useTranslations("home");
  const [preset, setPreset] = useState<ComparePreset>("7d");

  const { leftId, rightId } = useComparePhotoIds(plantId, preset);

  const presets: { key: ComparePreset; label: string }[] = [
    { key: "7d", label: tHome("sevenDaysAgo") },
    { key: "30d", label: tHome("thirtyDaysAgo") },
    { key: "first", label: tHome("firstDay") },
  ];

  const rightLabel = presets.find((p) => p.key === preset)?.label;
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

function TimelineCard({ entry, locale }: { entry: TimelineEntry; locale: string }) {
  const chips = [
    ...entry.actions.map((a) => `${ACTION_EMOJI[a]} ${a}`),
    ...entry.states.map((s) => `${STATE_EMOJI[s]} ${s}`),
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-1.5">
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
        <div className="text-right flex-shrink-0">
          <p className="text-[10px]" style={{ color: "#b0aba5" }}>{formatRelative(entry.timestamp)}</p>
          <p className="text-[10px]" style={{ color: "#d0cbc3" }}>{formatDate(entry.timestamp, locale)}</p>
        </div>
      </div>

      {/* Note */}
      {entry.note && (
        <p className="text-xs italic mb-3" style={{ color: "#7a7570" }}>
          &ldquo;{entry.note}&rdquo;
        </p>
      )}

      {/* Photo (first one only for timeline view) */}
      {entry.photoIds[0] && (
        <PhotoFromStore
          photoId={entry.photoIds[0]}
          alt=""
          className="w-full rounded-xl mt-2 object-cover"
          style={{ maxHeight: 200 }}
          objectFit="cover"
        />
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
  const { entries, loading: timelineLoading } = useTimeline(id);

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
                <TimelineCard key={entry.id} entry={entry} locale={locale} />
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
