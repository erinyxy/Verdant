"use client";

/**
 * GrowthMarkCard — archive-style milestone card.
 *
 * Design goal (per spec § 10): from "info card" → "museum archive object".
 * Visual recipe:
 *   - Archive ivory background (warmer than the page) + faint grain
 *   - Plant name + caption flow on the left
 *   - "DAY 30" capsule in the upper-right corner
 *   - Timeline events labeled "DAY · N" in mono (archive indexing feel)
 *   - Tagline as a deep-leaf-green hand-written sign-off
 *
 * Architectural constraints (CLAUDE.md):
 *   - All photos use <img src={dataUrl}> via PhotoFromStore
 *     (never CSS background-image — screenshot-friendly)
 */

import { useTranslations, useLocale } from "next-intl";
import PhotoFromStore from "@/components/PhotoFromStore";
import type { GrowthMark, GrowthMarkEvent, Plant } from "@/lib/dataStore";

interface Props {
  mark: GrowthMark;
  plant: Plant;
  onOpen: () => void;
  /** When true, used inside the full-screen detail view: removes click + shadow. */
  detailMode?: boolean;
}

// Inline noise SVG (fractalNoise w/ alpha 0.05 baked in). 120×120 tile.
// Single-quotes used so we can embed the whole thing in a CSS url("...").
const NOISE_DATA_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")";

// Mono stack — archive indexing feel; uses installed system fonts.
const MONO_FONT =
  '"SF Mono", "JetBrains Mono", "IBM Plex Mono", Menlo, Consolas, monospace';

function isHeroEvent(type: GrowthMarkEvent["type"]): boolean {
  return type === "firstPhoto" || type === "lastPhoto";
}

export default function GrowthMarkCard({
  mark,
  plant,
  onOpen,
  detailMode = false,
}: Props) {
  const t = useTranslations("marks");
  // captionKey is stored as a full dotted path (e.g. "marks.caption.30days"),
  // so use the root translator to resolve it.
  const tRoot = useTranslations();
  const locale = useLocale();

  const displayName = plant.nickname || plant.name;
  const hasStats =
    mark.stats.water > 0 ||
    mark.stats.newLeaf > 0 ||
    mark.stats.blooming > 0 ||
    mark.stats.maintenance > 0;

  const heroPx = detailMode ? 200 : 160;
  const smallPx = detailMode ? 96 : 80;

  // Spec: italic only for en/ja — Chinese characters distort under italic.
  const taglineItalic = locale !== "zh";

  const Wrapper = detailMode ? "div" : "button";

  return (
    <Wrapper
      onClick={detailMode ? undefined : onOpen}
      className={[
        "block w-full text-left rounded-2xl overflow-hidden relative",
        detailMode ? "" : "transition-transform active:scale-[0.995]",
      ].join(" ")}
      style={{
        backgroundColor: "#EFE5CE", // archive ivory
        backgroundImage: NOISE_DATA_URL,
        backgroundSize: "120px 120px",
        border: "1px solid rgba(140,110,70,0.08)",
        // Brown-tinted shadow, soft + lifted
        boxShadow: detailMode
          ? "none"
          : "0 1px 2px rgba(60,40,20,0.04), 0 4px 16px rgba(60,40,20,0.06)",
      }}
    >
      {/* Milestone: small "DAY 30" capsule, top-right. Farewell uses a
          ceremonial hairline-flanked inscription inside the header instead. */}
      {mark.kind !== "farewell" && (
        <div
          aria-hidden="true"
          className="absolute select-none flex items-center justify-center"
          style={{
            top: 20,
            right: 20,
            height: 26,
            padding: "0 12px",
            borderRadius: 999,
            border: "1px solid rgba(122,154,119,0.35)",
            background: "rgba(122,154,119,0.05)",
            color: "#4A6B47",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          DAY {mark.milestoneDays}
        </div>
      )}

      {/* Header — for farewell, no right-padding needed (no top-right capsule);
          a Lora-serif inscription line above the name sets the memorial tone. */}
      <header
        className={
          mark.kind === "farewell"
            ? "px-6 pt-6 pb-4"
            : "pl-6 pr-24 pt-6 pb-4"
        }
      >
        {mark.kind === "farewell" && (
          <div
            className="flex items-center gap-3 mb-5"
            aria-hidden="true"
          >
            <div style={{ flex: 1, height: "0.5px", background: "#c9c3bb" }} />
            <span
              style={{
                fontFamily: "var(--font-lora), Georgia, serif",
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: "0.28em",
                color: "#4A6B47",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              TOGETHER · {mark.milestoneDays} DAYS
            </span>
            <div style={{ flex: 1, height: "0.5px", background: "#c9c3bb" }} />
          </div>
        )}

        <p
          className="text-2xl mb-2 leading-tight"
          style={{
            color: "#3a3530",
            fontFamily: "var(--font-manrope), sans-serif",
            fontWeight: 600,
            letterSpacing: "0.005em",
          }}
        >
          {displayName}
        </p>
        <p
          className={["text-sm leading-relaxed", taglineItalic ? "italic" : ""].join(" ")}
          style={{
            color: "#7a7570",
            whiteSpace: mark.kind === "farewell" ? "nowrap" : undefined,
          }}
        >
          {/* Farewell caption interpolates {n}; milestone captions are static. */}
          {mark.kind === "farewell"
            ? tRoot("marks.farewell.caption", { n: mark.milestoneDays })
            : tRoot(mark.captionKey)}
        </p>
      </header>

      {/* Divider */}
      <div
        className="mx-6"
        style={{ borderTop: "1px solid rgba(140,110,70,0.15)" }}
      />

      {/* Timeline */}
      <ul className="relative px-6 py-5 space-y-5">
        {/* Vertical line behind the dots */}
        {mark.events.length > 1 && (
          <div
            aria-hidden="true"
            className="absolute"
            style={{
              left: "calc(24px + 3px)", // px-6 (24) + half of 6px dot
              top: 32,
              bottom: 32,
              width: 1,
              background: "rgba(122,154,119,0.28)",
            }}
          />
        )}

        {mark.events.map((event) => {
          const isHero = isHeroEvent(event.type);
          const size = isHero ? heroPx : smallPx;
          return (
            <li
              key={`${event.type}-${event.timestamp}`}
              className="flex items-start gap-3 relative"
            >
              {/* Dot + DAY · N mono label */}
              <div
                className="flex items-center gap-2 flex-shrink-0 pt-1"
                style={{ width: 76 }}
              >
                <span
                  className="block rounded-full flex-shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    background: "#7A9A77",
                  }}
                />
                <span
                  className="whitespace-nowrap"
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    color: "#6B8B66",
                    textTransform: "uppercase",
                  }}
                >
                  {/* +1: spec convention is 1-indexed (Day 1 = startedOn) */}
                  DAY · {event.daysFromStart + 1}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {event.photoId && (
                  <PhotoFromStore
                    photoId={event.photoId}
                    alt=""
                    className="block mb-2 rounded-lg"
                    style={{ width: size, height: size }}
                  />
                )}
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#3a3530" }}
                >
                  {t(`event.${event.type}`)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Stats band + tagline */}
      {hasStats && (
        <>
          <div
            className="mx-6"
            style={{ borderTop: "1px solid rgba(140,110,70,0.15)" }}
          />
          <footer className="px-6 pt-4 pb-6">
            <ul
              className="flex flex-wrap gap-x-4 gap-y-1.5 mb-5 text-xs"
              style={{ color: "#7a7570" }}
            >
              {mark.stats.newLeaf > 0 && (
                <li>🌿 {t("stats.newLeaf", { n: mark.stats.newLeaf })}</li>
              )}
              {mark.stats.blooming > 0 && (
                <li>🌸 {t("stats.blooming", { n: mark.stats.blooming })}</li>
              )}
              {mark.stats.water > 0 && (
                <li>💧 {t("stats.water", { n: mark.stats.water })}</li>
              )}
              {mark.stats.maintenance > 0 && (
                <li>🪴 {t("stats.maintenance", { n: mark.stats.maintenance })}</li>
              )}
            </ul>

            {/* Sign-line: a short underline above the tagline, evoking
                a handwritten signoff at the bottom of an archive card. */}
            <div
              aria-hidden="true"
              style={{
                width: 24,
                height: 1,
                background: "#D4C9A8",
                marginBottom: 10,
              }}
            />
            <p
              className={taglineItalic ? "italic" : ""}
              style={{
                color: "#3D5238",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.02em",
                lineHeight: 1.6,
              }}
            >
              {mark.kind === "farewell" ? t("farewell.tagline") : t("tagline")}
            </p>
          </footer>
        </>
      )}
    </Wrapper>
  );
}
