"use client";

/**
 * GrowthMarkDetail — full-screen view of a single GrowthMark.
 *
 * Per spec § 5.3:
 *   - Soft fade-in on mount
 *   - Close on backdrop click / X button / system back gesture
 *
 * The "no download button" rule from spec §9 was overridden by the
 * product owner once users started seeing milestone cards as keepable
 * mementos. We now offer:
 *   - Save image button → html-to-image PNG → download (or Web Share
 *     where supported, so iOS users can save to Photos directly).
 *
 * Note: rendered as a regular React subtree (not a portal). The parent
 * layout applies `transform: translateZ(0)` on the phone frame, which
 * makes fixed descendants contained within the frame on desktop preview.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toBlob } from "html-to-image";
import GrowthMarkCard from "@/components/GrowthMarkCard";
import type { GrowthMark, Plant } from "@/lib/dataStore";

interface Props {
  mark: GrowthMark;
  plant: Plant;
  onClose: () => void;
}

function safeFileName(s: string): string {
  // Strip path separators and weird chars, keep CJK / latin / numbers / dashes.
  // Replace whitespace with underscore. Limit length.
  return (
    s
      .normalize("NFC")
      .replace(/[\s/\\?%*:|"<>]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "plant"
  );
}

export default function GrowthMarkDetail({ mark, plant, onClose }: Props) {
  const t = useTranslations("marks");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const cardWrapRef = useRef<HTMLDivElement>(null);

  // Fade-in on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lock body scroll while open.
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
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSave() {
    const node = cardWrapRef.current;
    if (!node || saving) return;
    setSaving(true);
    try {
      const blob = await toBlob(node, {
        pixelRatio: 2, // crisp on retina
        // Background matches the card's archive-ivory so saved PNGs aren't
        // weirdly transparent in the rounded corners of the card.
        backgroundColor: "#EFE5CE",
        cacheBust: true,
      });
      if (!blob) throw new Error("toBlob returned null");

      const filename = `verdant-${safeFileName(plant.nickname || plant.name)}-${mark.milestoneDays}days.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // Web Share Level 2 (iOS Safari, Android Chrome) lets the user save
      // directly to Photos via the system share sheet.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const canShareFile =
        typeof nav.canShare === "function" && nav.canShare({ files: [file] });
      if (canShareFile) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          // User cancelled share — silently fall through to download fallback.
          if ((err as { name?: string }).name === "AbortError") return;
        }
      }

      // Fallback: trigger a regular download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after a tick so the browser can start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[verdant] save image failed:", err);
    } finally {
      setSaving(false);
    }
  }

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
      onClick={() => { if (!saving) onClose(); }}
    >
      {/* Top-right controls: save (left) + close (right) */}
      <div
        className="absolute z-10 flex items-center gap-2"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          right: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label={t("saveImage")}
          className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
          style={{
            width: 36,
            height: 36,
            background: "rgba(253, 250, 246, 0.92)",
            color: "#3a3530",
            boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label={t("close")}
          className="flex items-center justify-center rounded-full transition-opacity active:opacity-70"
          style={{
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
      </div>

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
        {/* Card wrapper for html-to-image capture */}
        <div ref={cardWrapRef}>
          <GrowthMarkCard mark={mark} plant={plant} onOpen={() => {}} detailMode />
        </div>
      </div>
    </div>
  );
}
