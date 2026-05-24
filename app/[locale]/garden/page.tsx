"use client";

/**
 * Garden page — My Garden / 我的花园 / マイガーデン
 *
 * Full plant roster with circular avatars, companion days count,
 * and last activity. Replaces the Record tab in BottomNav.
 *
 * Design: same warm journal feel as the rest of the app, but each
 * card emphasises "how long we've been together" as the primary metric.
 */

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePlants } from "@/hooks/useDataStore";
import { getRecordsByPlant, getTogetherDays, type Plant, type TimelineEntry } from "@/lib/dataStore";
import PhotoFromStore from "@/components/PhotoFromStore";
import SampleDataBanner from "@/components/SampleDataBanner";
import FirstPlantEmptyState from "@/components/FirstPlantEmptyState";
import DataMenu from "@/components/DataMenu";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Days the user has spent with this plant. Frozen for past plants (endedAt). */
function companionDays(plant: Plant): number | null {
  if (!plant.startedOn && !plant.createdAt) return null;
  return getTogetherDays(plant);
}

// pastAction / pastState key type helpers (garden namespace)
type PastActionKey = `pastAction.${"water" | "fertilize" | "repot" | "prune" | "bringHome" | "sow" | "sayGoodbye"}`;
type PastStateKey = `pastState.${"newLeaf" | "blooming" | "sick" | "lookingBeautiful"}`;

/** "今天" / "today" or "{n} days ago". */
function relativeTime(ts: string, today: string, daysAgoTpl: (n: number) => string): string {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
  return d === 0 ? today : daysAgoTpl(d);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlantRow {
  plant: Plant;
  days: number | null;
  latestEntry: TimelineEntry | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GardenPage() {
  const t = useTranslations("garden");
  const tHome = useTranslations("home");
  const locale = useLocale();

  const { plants, loading: plantsLoading } = usePlants();
  const [rows, setRows] = useState<PlantRow[]>([]);
  const [enriching, setEnriching] = useState(false);

  // After plants load, fetch the latest timeline entry for each plant.
  useEffect(() => {
    if (plants.length === 0) {
      setRows([]);
      return;
    }
    setEnriching(true);
    Promise.all(
      plants.map(async (plant) => {
        const entries = await getRecordsByPlant(plant.id); // newest-first
        return {
          plant,
          days: companionDays(plant),
          latestEntry: entries[0] ?? null,
        };
      }),
    ).then((data) => {
      setRows(data);
      setEnriching(false);
    });
  }, [plants]);

  const isLoading = plantsLoading || enriching;

  return (
    <div className="px-5 pt-10 pb-28">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-1 pl-1">
        <h1
          className="text-2xl"
          style={{
            color: "#3a3530",
            fontFamily: "var(--font-manrope), sans-serif",
            fontWeight: 500,
            letterSpacing: "0.005em",
          }}
        >
          {t("title")}
        </h1>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <Link
            href={`/${locale}/newcomer`}
            className="text-xs px-3 py-1.5 rounded-full transition-opacity active:opacity-70"
            style={{ background: "#e8f0e8", color: "#6B8B66" }}
          >
            + {tHome("addPlant")}
          </Link>
          <DataMenu />
        </div>
      </div>
      <p className="text-sm mb-6 pl-1" style={{ color: "#9a948e" }}>
        {t("subtitle")}
      </p>

      {/* Sample-data note (only while seeded sample data exists) */}
      <SampleDataBanner />

      {/* ── Content ── */}
      {isLoading ? (
        <LoadingSkeletons />
      ) : plants.length === 0 ? (
        <FirstPlantEmptyState />
      ) : (() => {
        const activeRows = rows.filter((r) => !r.plant.endedAt);
        const pastRows = rows.filter((r) => r.plant.endedAt);
        return (
          <>
            <div className="space-y-3">
              {activeRows.map(({ plant, days, latestEntry }) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  days={days}
                  latestEntry={latestEntry}
                  locale={locale}
                />
              ))}
            </div>

            {pastRows.length > 0 && (
              <section className="mt-10">
                <h2
                  className="text-xs uppercase tracking-widest mb-4 pl-1"
                  style={{ color: "#9a948e" }}
                >
                  {t("onceTogetherTitle")}
                </h2>
                <div className="space-y-3">
                  {pastRows.map(({ plant, days, latestEntry }) => (
                    <PlantCard
                      key={plant.id}
                      plant={plant}
                      days={days}
                      latestEntry={latestEntry}
                      locale={locale}
                      isPast
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─── PlantCard ────────────────────────────────────────────────────────────────

interface CardProps {
  plant: Plant;
  days: number | null;
  latestEntry: TimelineEntry | null;
  locale: string;
  isPast?: boolean;
}

function PlantCard({ plant, days, latestEntry, locale, isPast = false }: CardProps) {
  const t = useTranslations("garden");
  const tHome = useTranslations("home");

  const displayName = plant.nickname
    ? `${plant.nickname} · ${plant.name}`
    : plant.name;

  // Derive garden past-tense activity label (actions take priority over states)
  const actLabel: string | null = (() => {
    if (!latestEntry) return null;
    if (latestEntry.actions.length > 0)
      return t(`pastAction.${latestEntry.actions[0]}` as PastActionKey);
    if (latestEntry.states.length > 0)
      return t(`pastState.${latestEntry.states[0]}` as PastStateKey);
    return null;
  })();

  const timeLabel: string | null = latestEntry
    ? relativeTime(
        latestEntry.timestamp,
        tHome("today"),
        (n) => tHome("daysAgo", { days: n }),
      )
    : null;

  return (
    <Link
      href={`/${locale}/plant/${plant.id}`}
      className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-opacity active:opacity-70"
      style={{
        // Past plants get a subtler card to recede behind active ones,
        // but stay fully readable (this is still memory journal, not delete).
        background: isPast ? "#f8f4ec" : "#fdfaf6",
        boxShadow: isPast ? "0 1px 6px rgba(0,0,0,0.03)" : "0 1px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Circular avatar (slightly desaturated for past) */}
      <div
        className="flex-shrink-0 rounded-full overflow-hidden"
        style={{
          width: 68,
          height: 68,
          border: "1.5px solid rgba(140,110,70,0.10)",
          background: "#efe9dd",
          filter: isPast ? "saturate(0.55) brightness(0.97)" : undefined,
        }}
      >
        <PhotoFromStore
          photoId={plant.coverPhotoId}
          alt={plant.name}
          className="w-full h-full object-cover"
          objectFit="cover"
        />
      </div>

      {/* Info block — fewer lines for past plants, no "last activity" noise */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: isPast ? "#5a5550" : "#2c2c2c" }}>
          {displayName}
        </p>

        {/* Days together — frozen for past, with 🍂 hint */}
        {days !== null && (
          <p
            className="text-sm mt-1.5"
            style={{
              color: isPast ? "#9a948e" : "#7A9A77",
              lineHeight: 1.4,
            }}
          >
            {isPast ? (
              <>
                {t("onceTogetherDays", { n: days })}
                <span style={{ marginLeft: 6 }}>🍂</span>
              </>
            ) : (
              t("daysCount", { n: days })
            )}
          </p>
        )}

        {/* Last activity — only for active plants (past plants are frozen) */}
        {!isPast && (
          <div className="mt-1.5">
            {actLabel && timeLabel ? (
              <p
                className="text-xs flex items-center min-w-0"
                style={{ color: "#b0aba5", letterSpacing: "0.04em" }}
              >
                <span className="truncate">{actLabel}</span>
                <span
                  className="flex-shrink-0"
                  style={{ paddingInline: "6px", opacity: 0.55 }}
                >
                  ·
                </span>
                <span className="flex-shrink-0 whitespace-nowrap">{timeLabel}</span>
              </p>
            ) : (
              <p
                className="text-xs"
                style={{ color: "#d0cbc5", letterSpacing: "0.04em" }}
              >
                {t("noLastRecord")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isPast ? "#d4cec5" : "#c9c3bb"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl px-4 py-3.5 animate-pulse"
          style={{ background: "#fdfaf6" }}
        >
          {/* Circle */}
          <div
            className="flex-shrink-0 rounded-full"
            style={{ width: 68, height: 68, background: "#ede9e3" }}
          />
          {/* Lines */}
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded" style={{ background: "#ede9e3", width: "55%" }} />
            <div className="h-4 rounded" style={{ background: "#ede9e3", width: "35%" }} />
            <div className="h-2.5 rounded" style={{ background: "#ede9e3", width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
