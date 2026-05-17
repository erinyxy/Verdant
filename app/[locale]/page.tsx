"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePlants, useComparePhotoIds } from "@/hooks/useDataStore";
import { getRecordsByPlant, type Plant, type TimelineEntry } from "@/lib/dataStore";
import PhotoFromStore from "@/components/PhotoFromStore";
import PhotoCompare from "@/components/PhotoCompare";
import LocaleSwitcher from "@/components/LocaleSwitcher";

// A timeline entry enriched with its parent plant (for cross-plant display).
type RichEntry = TimelineEntry & { plant: Plant };

// ─── Action / State label helpers ─────────────────────────────────────────────

function entryLabel(entry: TimelineEntry, tActions: (k: string) => string, tStates: (k: string) => string): string {
  // tActions / tStates already include emojis ("💧 Water"), so no need for ACTION_EMOJI prefix
  const parts: string[] = [
    ...entry.actions.map((a) => tActions(a)),
    ...entry.states.map((s) => tStates(s)),
  ];
  return parts.slice(0, 2).join(" · ") || "—";
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecentActivity({ entries, locale }: { entries: RichEntry[]; locale: string }) {
  const t = useTranslations("home");
  const tActions = useTranslations("actions");
  const tStates = useTranslations("states");

  if (entries.length === 0) {
    return (
      <p className="text-sm px-1" style={{ color: "#b0aba5" }}>{t("emptyRecent")}</p>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className="flex items-baseline gap-3 px-4 py-3"
          style={{
            borderTop: i > 0 ? "1px solid rgba(201,185,154,0.15)" : undefined,
          }}
        >
          {/* Date */}
          <span className="text-[11px] tabular-nums flex-shrink-0 whitespace-nowrap" style={{ color: "#c9c3bb" }}>
            {formatDate(entry.timestamp, locale)}
          </span>
          {/* Plant name — comes from the enriched entry, correct for every plant */}
          <span className="text-[12px] font-medium flex-shrink-0" style={{ color: "#7a7570" }}>
            {entry.plant.nickname || entry.plant.name}
          </span>
          {/* Actions + states */}
          <span className="text-[12px] truncate" style={{ color: "#2c2c2c" }}>
            {entryLabel(entry, tActions, tStates)}
          </span>
        </div>
      ))}
    </div>
  );
}

function GrowthLookback({ plant }: { plant: Plant }) {
  const t = useTranslations("home");
  const { leftId, rightId } = useComparePhotoIds(plant.id, "7d");

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      <p className="text-xs mb-3" style={{ color: "#7a7570" }}>
        {plant.nickname || plant.name}
      </p>
      <PhotoCompare
        leftPhotoId={leftId}
        rightPhotoId={rightId}
        leftLabel={t("today")}
        rightLabel={rightId ? t("sevenDaysAgo") : undefined}
        summaryText={t("growthSummary")}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const { plants, loading } = usePlants();

  // Cross-plant enrichment: fetch all timelines, merge & sort once.
  const [recentEntries, setRecentEntries] = useState<RichEntry[]>([]);
  const [activePlant, setActivePlant] = useState<Plant | null>(null);
  const [enriching, setEnriching] = useState(false);

  const enrich = useCallback(async () => {
    if (plants.length === 0) {
      setRecentEntries([]);
      setActivePlant(null);
      return;
    }
    setEnriching(true);
    const results = await Promise.all(
      plants.map(async (plant) => {
        const entries = await getRecordsByPlant(plant.id);
        return { plant, entries };
      }),
    );

    // Merge entries from all plants, sort newest-first.
    const merged: RichEntry[] = results
      .flatMap(({ plant, entries }) => entries.map((e) => ({ ...e, plant })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setRecentEntries(merged.slice(0, 3));

    // Growth Lookback: plant whose most recent entry has a photo.
    // Falls back to plants[0] if none have photos yet.
    const latestWithPhoto = merged.find((e) => e.photoIds.length > 0);
    setActivePlant(latestWithPhoto?.plant ?? plants[0]);

    setEnriching(false);
  }, [plants]);

  useEffect(() => {
    enrich();
    window.addEventListener("verdant:seeded", enrich);
    return () => window.removeEventListener("verdant:seeded", enrich);
  }, [enrich]);

  return (
    <div className="px-5 pt-10 pb-20">
      {/* 顶栏：标题 + 语言切换 */}
      <div className="flex items-start justify-between mb-8 pl-1">
        <h1
          className="text-2xl"
          style={{
            color: "#3a3530",
            fontFamily: "var(--font-manrope), sans-serif",
            fontWeight: 500,
            fontStyle: "italic",
            letterSpacing: "0.005em",
            lineHeight: 1.45,
            whiteSpace: "pre-line",
          }}
        >
          {t("title")}
        </h1>
        <LocaleSwitcher />
      </div>

      {/* Recent Activity */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9a948e" }}>
          {t("recentActivity")}
        </h2>
        {loading || enriching ? (
          <div
            className="rounded-2xl p-4 animate-pulse"
            style={{ background: "#fdfaf6", height: 56 }}
          />
        ) : (
          <RecentActivity entries={recentEntries} locale={locale} />
        )}
      </section>

      {/* Growth Lookback — shows the plant with the most recent photo */}
      {!loading && !enriching && activePlant && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-widest mb-4" style={{ color: "#9a948e" }}>
            {t("growthLookback")}
          </h2>
          <GrowthLookback plant={activePlant} />
        </section>
      )}

      {/* My Plants */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-widest" style={{ color: "#9a948e" }}>
            {t("myPlants")}
          </h2>
          <Link
            href={`/${locale}/newcomer`}
            className="text-xs px-3 py-1 rounded-full transition-opacity active:opacity-70"
            style={{ background: "#e8f0e8", color: "#8fad8f" }}
          >
            + {t("addPlant")}
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ background: "#fdfaf6", height: 72 }}
              />
            ))}
          </div>
        ) : plants.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="text-sm" style={{ color: "#b0aba5" }}>{t("emptyPlants")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {plants.slice(0, 3).map((plant) => (
                <PlantCard key={plant.id} plant={plant} locale={locale} />
              ))}
            </div>
            {plants.length > 3 && (
              <Link
                href={`/${locale}/garden`}
                className="flex items-center justify-center gap-1 mt-3 py-2.5 rounded-2xl text-xs transition-opacity active:opacity-70"
                style={{ color: "#8fad8f", background: "#f5f2ec" }}
              >
                {t("viewAll")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            )}
          </>
        )}
      </section>

      {/* Brand footer — Wordmark + Growth Mark */}
      <div className="mt-12 mb-0 flex flex-col items-center gap-3 select-none" aria-hidden="true">

        {/* VERDANT 两侧横线 */}
        <div className="flex items-center gap-3 w-full px-2">
          <div style={{ flex: 1, height: "0.5px", background: "#c9c3bb" }} />
          <span
            style={{
              fontFamily: "var(--font-lora), Georgia, serif",
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "0.28em",
              color: "#2e2e2b",
            }}
          >
            VERDANT
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "#c9c3bb" }} />
        </div>

        {/* PLANT MEMORY JOURNAL tagline */}
        <p
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.26em",
            color: "#77826e",
            textTransform: "uppercase",
            marginTop: "-4px",
          }}
        >
          Plant Memory Journal
        </p>

        {/* Growth Mark */}
        <img
          src="/icons/growth-mark-transparent-256.png"
          alt=""
          width={52}
          height={52}
          style={{ opacity: 0.35, marginTop: "4px" }}
        />
      </div>

      {/* FAB — jump to Record */}
      <button
        onClick={() => router.push(`/${locale}/record`)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40 transition-transform active:scale-95"
        style={{ background: "#77826e" }}
        aria-label="Quick record"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// ─── PlantCard ────────────────────────────────────────────────────────────────

function PlantCard({ plant, locale }: { plant: Plant; locale: string }) {
  const t = useTranslations("home");

  // days since startedOn
  const daysSince = plant.startedOn
    ? Math.floor((Date.now() - new Date(plant.startedOn).getTime()) / 86_400_000)
    : null;

  return (
    <Link
      href={`/${locale}/plant/${plant.id}`}
      className="flex items-center gap-4 rounded-2xl px-4 py-3 transition-opacity active:opacity-70"
      style={{ background: "#fdfaf6", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
    >
      {/* Cover photo */}
      <PhotoFromStore
        photoId={plant.coverPhotoId}
        alt={plant.name}
        className="w-14 h-14 rounded-xl flex-shrink-0 object-cover"
        objectFit="cover"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "#2c2c2c" }}>
          {plant.nickname ? `${plant.nickname} · ` : ""}
          {plant.name}
        </p>
        {daysSince !== null && (
          <p className="text-xs mt-0.5" style={{ color: "#b0aba5" }}>
            {t("daysAgo", { days: daysSince })}
          </p>
        )}
      </div>

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#b0aba5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
