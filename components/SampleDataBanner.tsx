"use client";

/**
 * SampleDataBanner — gentle note clarifying that the seeded plants are
 * sample data, not other users' plants. Verdant is a private journal.
 *
 * Shows on Home & My Garden while sample data exists and hasn't been
 * dismissed. Calm, journal-like (pale sage), never error/warning styled.
 *
 * Actions:
 *   - Dismiss: hides the banner (data kept), remembered in localStorage
 *   - Clear sample data: confirm → wipe everything → empty state.
 *     clearSampleData() also sets a "cleared" flag so seed won't re-run.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isSampleData, clearSampleData } from "@/lib/dataStore";

const DISMISS_KEY = "verdant:sampleBannerDismissed";

export default function SampleDataBanner() {
  const t = useTranslations("sample");
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  function evaluate() {
    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    setVisible(isSampleData() && !dismissed);
  }

  useEffect(() => {
    evaluate();
    // Re-check after the first-load seed finishes (sampleData flag is set then).
    window.addEventListener("verdant:seeded", evaluate);
    return () => window.removeEventListener("verdant:seeded", evaluate);
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearSampleData();
      // Tell all data hooks to refetch → they'll find an empty store → empty state.
      window.dispatchEvent(new Event("verdant:seeded"));
      setVisible(false);
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div
        className="rounded-2xl px-4 py-3 mb-5 flex items-start gap-3"
        style={{
          background: "#e6ede3", // pale sage
          border: "1px solid rgba(119,130,110,0.14)",
        }}
      >
        {/* Leaf glyph — soft, not an alert icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#77826e"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 13 4a7 7 0 0 1 7 7c0 5-4 9-9 9z" />
          <path d="M11 20c0-4 1-7 5-9" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-relaxed" style={{ color: "#5a6152" }}>
            {t("banner")}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs transition-opacity active:opacity-60"
              style={{ color: "#9a948e" }}
            >
              {t("dismiss")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs font-medium transition-opacity active:opacity-60"
              style={{ color: "#77826e" }}
            >
              {t("clear")}
            </button>
          </div>
        </div>
      </div>

      {/* Gentle confirmation dialog */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center px-8"
          style={{ background: "rgba(38,36,32,0.45)" }}
          onClick={() => { if (!clearing) setConfirming(false); }}
        >
          <div
            className="w-full rounded-2xl p-5"
            style={{ background: "#fdfaf6", maxWidth: 300, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#3a3530" }}>
              {t("clearConfirm")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={clearing}
                className="text-sm px-4 py-2 rounded-full transition-opacity active:opacity-70"
                style={{ color: "#7a7570", background: "rgba(0,0,0,0.04)" }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="text-sm px-4 py-2 rounded-full text-white transition-opacity active:opacity-70"
                style={{ background: "#77826e", opacity: clearing ? 0.6 : 1 }}
              >
                {clearing ? "…" : t("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
