"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

const LOCALES = [
  { code: "en", label: "EN", full: "English" },
  { code: "ja", label: "JA", full: "日本語" },
  { code: "zh", label: "中文", full: "中文" },
] as const;

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("localeSwitcher");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点外面关闭
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchLocale(newLocale: string) {
    // /en/some/path → /ja/some/path
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/") || "/");
    setOpen(false);
  }

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 transition-opacity active:opacity-60"
        style={{
          fontSize: "11px",
          letterSpacing: "0.08em",
          color: "#9a9690",
          padding: "4px 8px",
          borderRadius: "20px",
          border: "0.5px solid #e6e0d8",
          background: "transparent",
          cursor: "pointer",
          userSelect: "none",
        }}
        aria-label={t("label")}
        aria-expanded={open}
      >
        {current.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            opacity: 0.7,
          }}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "#fdfaf6",
            border: "0.5px solid #e6e0d8",
            borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
            overflow: "hidden",
            minWidth: "88px",
            zIndex: 100,
          }}
        >
          {LOCALES.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                onClick={() => switchLocale(l.code)}
                className="w-full text-left transition-colors"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 14px",
                  fontSize: "12px",
                  letterSpacing: "0.04em",
                  color: active ? "#77826e" : "#4a4639",
                  fontWeight: active ? 500 : 400,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  borderTop: l.code !== "en" ? "0.5px solid #f0ece4" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f8f5f0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {l.full}
                {active && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#77826e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
