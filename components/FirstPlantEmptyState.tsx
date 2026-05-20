"use client";

/**
 * FirstPlantEmptyState — warm invitation shown when the user has no plants
 * (fresh start, or after clearing sample data). Calm and journal-like.
 */

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function FirstPlantEmptyState() {
  const t = useTranslations("firstPlant");
  const tGarden = useTranslations("garden");
  const locale = useLocale();

  return (
    <div className="flex flex-col items-center text-center pt-14 px-6">
      {/* Soft sprout-in-pot illustration */}
      <svg
        width="60"
        height="60"
        viewBox="0 0 64 64"
        fill="none"
        stroke="#b8c9b8"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M32 36 C32 28, 32 22, 32 14" />
        <path d="M32 22 C26 16, 18 16, 18 22 C24 24, 30 22, 32 22 Z" />
        <path d="M32 18 C38 12, 46 12, 46 18 C40 20, 34 18, 32 18 Z" />
        <path d="M20 38 Q20 36 24 36 L40 36 Q44 36 44 38 L44 40 Q44 42 40 42 L24 42 Q20 42 20 40 Z" />
        <path d="M24 42 L22 54 Q22 56 26 56 L38 56 Q42 56 42 54 L40 42 Z" />
      </svg>

      <p
        className="text-lg mt-6"
        style={{
          color: "#3a3530",
          fontFamily: "var(--font-manrope), sans-serif",
          fontWeight: 500,
        }}
      >
        {t("title")}
      </p>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: "#9a948e", maxWidth: 260 }}>
        {t("body")}
      </p>

      <Link
        href={`/${locale}/newcomer`}
        className="mt-6 text-sm px-5 py-2.5 rounded-full transition-opacity active:opacity-70"
        style={{ background: "#77826e", color: "#fff" }}
      >
        + {tGarden("emptyCta")}
      </Link>
    </div>
  );
}
