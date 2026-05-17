"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { seedIfEmpty } from "@/lib/seedData";

type Locale = "en" | "ja" | "zh";

/**
 * Client-side guard that seeds mock data on first mount.
 * Renders nothing. Safe to mount in any layout — seedIfEmpty is a no-op
 * if data already exists in localStorage.
 */
export default function SeedInit() {
  const locale = useLocale() as Locale;

  useEffect(() => {
    seedIfEmpty(locale).catch((err) => {
      console.error("[verdant] seed failed:", err);
    });
  }, [locale]);

  return null;
}
