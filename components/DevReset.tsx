"use client";

/**
 * DevReset — development-only floating button to clear all local data.
 * Only renders when NODE_ENV === "development". Invisible in production.
 *
 * Clears localStorage + IndexedDB, then reloads the page so seed runs again.
 */

import { useState } from "react";
import { clearAllData } from "@/lib/dataStore";

export default function DevReset() {
  // Hard-check at render time; tree-shaken out in production builds.
  if (process.env.NODE_ENV !== "development") return null;

  return <DevResetInner />;
}

function DevResetInner() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleReset() {
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel after 3 s if user doesn't confirm
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setBusy(true);
    try {
      // Also clear the seeding lock so seed can re-run
      localStorage.removeItem("verdant:seeding");
      await clearAllData();
      window.location.reload();
    } catch (err) {
      console.error("[DevReset] failed:", err);
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={busy}
      title="Dev: Reset all plant data"
      className="absolute bottom-24 left-3 z-50 text-[10px] px-2.5 py-1 rounded-full transition-all active:opacity-70"
      style={{
        background: confirming ? "#e08080" : "rgba(176,171,165,0.18)",
        color: confirming ? "#fff" : "#b0aba5",
        border: "1px solid",
        borderColor: confirming ? "#e08080" : "rgba(176,171,165,0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      {busy ? "…" : confirming ? "Sure?" : "Reset"}
    </button>
  );
}
