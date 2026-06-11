"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function BottomNav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();

  const tabs = [
    {
      key: "home",
      label: t("home"),
      href: `/${locale}`,
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      key: "garden",
      label: t("garden"),
      href: `/${locale}/garden`,
      icon: (active: boolean) => (
        // Two large alternating leaves on a full-height stem —
        // visually fills the viewBox the same way the house and bookmark do.
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
          {/* Stem — full height */}
          <path d="M12 21 L12 5" />
          {/* Left leaf — lower, extends to the left edge */}
          <path d="M12 16 C7 12, 2 11, 2 16 C3 20, 11 18, 12 16 Z" />
          {/* Right leaf — upper, extends to the right edge */}
          <path d="M12 10 C17 6, 22 5, 22 10 C21 14, 13 12, 12 10 Z" />
        </svg>
      ),
    },
    {
      key: "milestones",
      label: t("milestones"),
      href: `/${locale}/milestones`,
      icon: (active: boolean) => (
        // Bookmark — minimal line, slight handmade tilt feel via uneven points
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3.5h12a1 1 0 011 1V21l-7-4.5L5 21V4.5a1 1 0 011-1z" />
        </svg>
      ),
    },
  ];

  function isActive(href: string) {
    if (href === `/${locale}`) {
      return pathname === `/${locale}` || pathname === `/${locale}/`;
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        // NOTE: intentionally NO backdrop-filter. On iOS WebKit a fixed
        // element with backdrop-filter leaves a same-width "ghost" repaint
        // band above itself when the address bar collapses/expands, and that
        // ghost layer also swallows taps on the nav. A near-opaque solid
        // background looks the same here (the content behind is the warm
        // ivory page anyway) without triggering the bug.
        background: "rgba(253, 250, 246, 0.98)",
        borderTop: "1px solid rgba(201, 185, 154, 0.25)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around px-4 py-3">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center gap-1 min-w-[60px] transition-opacity"
              style={{
                color: active ? "#77826e" : "#b0aba5",
                opacity: active ? 1 : 0.8,
              }}
            >
              {tab.icon(active)}
              <span
                className="text-[10px] tracking-wide"
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
