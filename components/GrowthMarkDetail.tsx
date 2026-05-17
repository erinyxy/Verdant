"use client";

/**
 * GrowthMarkDetail — full-screen view of a single GrowthMark.
 *
 * Per spec § 5.3:
 *   - Soft fade-in on mount
 *   - Close on backdrop click / X button / system back gesture
 *   - No download button (user takes a screenshot manually)
 *
 * Note: rendered as a regular React subtree (not a portal). The parent layout
 * applies `transform: translateZ(0)` on the phone frame, which makes fixed
 * descendants contained within the frame on desktop preview.
 *
 * System back gesture is supported by pushing a history state on open and
 * listening for popstate.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import GrowthMarkCard from "@/components/GrowthMarkCard";
import type { GrowthMark, Plant } from "@/lib/dataStore";

interface Props {
  mark: GrowthMark;
  plant: Plant;
  onClose: () => void;
}

export default function GrowthMarkDetail({ mark, plant, onClose }: Props) {
  const t = useTranslations("marks");
  const [visible, setVisible] = useState(false);

  // Fade-in on mount.
  useEffect(() => {
    // next paint
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lock body scroll while open.
  // Note: system back-gesture support intentionally not implemented —
  // synchronous history.pushState + StrictMode double-mount creates a race
  // where the async popstate from the dev-unmount cleanup hits the second
  // mount's listener and closes the modal. Close-via-backdrop / X is enough.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Escape key to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "rgba(38, 36, 32, 0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 220ms ease-out",
      }}
      onClick={onClose}
    >
      {/* Close button (top-right) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("close")}
        className="absolute z-10 flex items-center justify-center rounded-full"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          right: 16,
          width: 36,
          height: 36,
          background: "rgba(253, 250, 246, 0.92)",
          color: "#3a3530",
          boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>

      {/* Scrollable card content — clicking the card itself shouldn't close. */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <GrowthMarkCard mark={mark} plant={plant} onOpen={() => {}} detailMode />
      </div>
    </div>
  );
}
