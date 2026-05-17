"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  syncMarks,
  getAllPlants,
  getDaysUntilFirstMilestone,
  type GrowthMark,
  type Plant,
} from "@/lib/dataStore";
import GrowthMarkCard from "@/components/GrowthMarkCard";
import GrowthMarkDetail from "@/components/GrowthMarkDetail";

export default function MilestonesPage() {
  const t = useTranslations("marks");

  const [marks, setMarks] = useState<GrowthMark[]>([]);
  const [plants, setPlants] = useState<Map<string, Plant>>(new Map());
  const [loading, setLoading] = useState(true);
  const [openMarkId, setOpenMarkId] = useState<string | null>(null);
  const [countdownDays, setCountdownDays] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // syncMarks generates any missing GrowthMarks and returns the full list (sorted).
    const [allMarks, allPlants] = await Promise.all([syncMarks(), getAllPlants()]);
    setMarks(allMarks);
    setPlants(new Map(allPlants.map((p) => [p.id, p])));
    setCountdownDays(allMarks.length === 0 ? await getDaysUntilFirstMilestone() : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // re-sync after seed completes (first run on a fresh browser).
    window.addEventListener("verdant:seeded", load);
    return () => window.removeEventListener("verdant:seeded", load);
  }, [load]);

  const openMark = openMarkId ? marks.find((m) => m.id === openMarkId) ?? null : null;
  const openPlant = openMark ? plants.get(openMark.plantId) ?? null : null;

  return (
    <div className="px-5 pt-10 pb-28">
      <h1
        className="mb-1 text-2xl pl-1"
        style={{
          color: "#3a3530",
          fontFamily: "var(--font-manrope), sans-serif",
          fontWeight: 500,
          letterSpacing: "0.005em",
        }}
      >
        {t("title")}
      </h1>
      <p className="text-sm mb-8 pl-1" style={{ color: "#9a948e" }}>
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ background: "#fdfaf6", height: 320 }}
            />
          ))}
        </div>
      ) : marks.length === 0 ? (
        <EmptyState countdownDays={countdownDays} />
      ) : (
        <div className="space-y-6">
          {marks.map((mark) => {
            const plant = plants.get(mark.plantId);
            if (!plant) return null;
            return (
              <GrowthMarkCard
                key={mark.id}
                mark={mark}
                plant={plant}
                onOpen={() => setOpenMarkId(mark.id)}
              />
            );
          })}
        </div>
      )}

      {openMark && openPlant && (
        <GrowthMarkDetail
          mark={openMark}
          plant={openPlant}
          onClose={() => setOpenMarkId(null)}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ countdownDays }: { countdownDays: number | null }) {
  const t = useTranslations("marks");

  return (
    <div className="flex flex-col items-center text-center pt-12 px-4">
      <LeafIllustration />
      <p className="text-sm mt-6 leading-relaxed" style={{ color: "#9a948e", maxWidth: 280 }}>
        {countdownDays !== null
          ? t("empty", { days: countdownDays })
          : t("emptyNoCountdown")}
      </p>
    </div>
  );
}

function LeafIllustration() {
  // Hand-drawn-feel simple leaf, line-only.
  return (
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
      <path d="M32 10 C 18 18, 14 34, 22 50 C 30 46, 42 38, 46 26 C 47 20, 44 14, 32 10 Z" />
      <path d="M28 46 C 30 38, 33 28, 38 20" />
      <path d="M30 38 L 25 33" />
      <path d="M32 32 L 27 28" />
      <path d="M34 26 L 30 23" />
    </svg>
  );
}
