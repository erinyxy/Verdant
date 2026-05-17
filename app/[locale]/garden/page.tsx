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
import { getRecordsByPlant, type Plant, type TimelineEntry } from "@/lib/dataStore";
import PhotoFromStore from "@/components/PhotoFromStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Days since the plant was first cared for. */
function companionDays(plant: Plant): number | null {
  const base = plant.startedOn ?? plant.createdAt;
  if (!base) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000));
}

// pastAction / pastState key type helpers (garden namespace)
type PastActionKey = `pastAction.${"water" | "fertilize" | "repot" | "prune" | "bringHome"}`;
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
        <Link
          href={`/${locale}/newcomer`}
          className="text-xs px-3 py-1.5 rounded-full transition-opacity active:opacity-70 flex-shrink-0 mt-1"
          style={{ background: "#e8f0e8", color: "#6B8B66" }}
        >
          + {tHome("addPlant")}
        </Link>
      </div>
      <p className="text-sm mb-8 pl-1" style={{ color: "#9a948e" }}>
        {t("subtitle")}
      </p>

      {/* ── Content ── */}
      {isLoading ? (
        <LoadingSkeletons />
      ) : plants.length === 0 ? (
        <EmptyState locale={locale} />
      ) : (
        <div className="space-y-3">
          {rows.map(({ plant, days, latestEntry }) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              days={days}
              latestEntry={latestEntry}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PlantCard ────────────────────────────────────────────────────────────────

interface CardProps {
  plant: Plant;
  days: number | null;
  latestEntry: TimelineEntry | null;
  locale: string;
}

function PlantCard({ plant, days, latestEntry, locale }: CardProps) {
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
        background: "#fdfaf6",
        boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Circular avatar */}
      <div
        className="flex-shrink-0 rounded-full overflow-hidden"
        style={{
          width: 68,
          height: 68,
          border: "1.5px solid rgba(140,110,70,0.10)",
          background: "#efe9dd",
        }}
      >
        <PhotoFromStore
          photoId={plant.coverPhotoId}
          alt={plant.name}
          className="w-full h-full object-cover"
          objectFit="cover"
        />
      </div>

      {/* Three-line info block */}
      <div className="flex-1 min-w-0">

        {/* Line 1: Name — medium weight, dark */}
        <p className="text-sm font-medium truncate" style={{ color: "#2c2c2c" }}>
          {displayName}
        </p>

        {/* Line 2: Days together — small, grey-green, sentence feel */}
        {days !== null && (
          <p
            className="text-sm mt-1.5"
            style={{ color: "#7A9A77", lineHeight: 1.4 }}
          >
            {t("daysCount", { n: days })}
          </p>
        )}

        {/* Line 3: Last activity — muted, wider spacing, · has room to breathe */}
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
      </div>

      {/* Arrow */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#c9c3bb"
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ locale }: { locale: string }) {
  const t = useTranslations("garden");
  return (
    <div className="flex flex-col items-center text-center pt-16 px-4">
      {/* Simple pot illustration */}
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        stroke="#b8c9b8"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Stem */}
        <path d="M32 36 C32 28, 32 22, 32 14" />
        {/* Left leaf */}
        <path d="M32 22 C26 16, 18 16, 18 22 C24 24, 30 22, 32 22 Z" />
        {/* Right leaf */}
        <path d="M32 18 C38 12, 46 12, 46 18 C40 20, 34 18, 32 18 Z" />
        {/* Pot rim */}
        <path d="M20 38 Q20 36 24 36 L40 36 Q44 36 44 38 L44 40 Q44 42 40 42 L24 42 Q20 42 20 40 Z" />
        {/* Pot body */}
        <path d="M24 42 L22 54 Q22 56 26 56 L38 56 Q42 56 42 54 L40 42 Z" />
      </svg>

      <p
        className="text-base mt-6 font-medium"
        style={{ color: "#9a948e" }}
      >
        {t("emptyTitle")}
      </p>

      <Link
        href={`/${locale}/newcomer`}
        className="mt-4 text-sm px-5 py-2 rounded-full transition-opacity active:opacity-70"
        style={{ background: "#e8f0e8", color: "#6B8B66" }}
      >
        + {t("emptyCta")}
      </Link>
    </div>
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
