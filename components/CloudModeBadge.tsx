"use client";

/**
 * CloudModeBadge — tiny pill that surfaces sync state for the owner.
 *
 * - Local Mode (anonymous demo + owner before opting in): renders NOTHING.
 *   Demo visitors must never see "Cloud" UI on the public site.
 * - Cloud Mode: shows a small ✓ Cloud chip. Tap → /[locale]/owner.
 *
 * State changes are picked up via the "verdant:modeChanged" custom event
 * dispatched by lib/storeMode.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { getMode, type StoreMode } from "@/lib/storeMode";

export default function CloudModeBadge() {
  const [mode, setMode] = useState<StoreMode>("local");
  const locale = useLocale();

  useEffect(() => {
    setMode(getMode());
    const onChange = (e: Event) => setMode((e as CustomEvent).detail as StoreMode);
    window.addEventListener("verdant:modeChanged", onChange);
    return () => window.removeEventListener("verdant:modeChanged", onChange);
  }, []);

  if (mode !== "cloud") return null;

  return (
    <Link
      href={`/${locale}/owner`}
      aria-label="Cloud Mode settings"
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-opacity active:opacity-70"
      style={{ background: "#e6efe4", color: "#5a7a55" }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9" />
      </svg>
      Cloud
    </Link>
  );
}
