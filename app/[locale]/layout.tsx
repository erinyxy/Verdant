import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMessages } from "next-intl/server";
import BottomNav from "@/components/BottomNav";
import SeedInit from "@/components/SeedInit";
import DevReset from "@/components/DevReset";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/*
       * Desktop: stone-colored background, phone frame centered.
       * Mobile: fills the screen normally (md: classes are no-ops).
       *
       * KEY TRICK: transform: translateZ(0) on the phone frame makes it the
       * "containing block" for all position:fixed descendants (BottomNav, FABs).
       * This keeps fixed elements inside the phone frame on desktop preview,
       * instead of escaping to the browser viewport's corners.
       */}
      <div
        className="min-h-screen md:flex md:items-center md:justify-center"
        style={{ background: "var(--bg-desktop, transparent)" }}
      >
        {/* Desktop chrome: subtle background */}
        <style>{`
          @media (min-width: 768px) {
            :root { --bg-desktop: #d6d0c8; }
          }
        `}</style>

        {/* Phone frame.
         *
         * Mobile: full screen, NO transform. BottomNav must be fixed to the
         * real viewport — iOS Chrome's address bar collapse/expand otherwise
         * leaves it floating mid-screen because the containing block (this
         * frame, sized in dvh) lags the visible viewport.
         *
         * Desktop: phone-sized frame; the translateZ(0) creates a containing
         * block so BottomNav and FABs stay inside the preview frame instead
         * of escaping to the browser viewport corners. */}
        <div
          className={[
            "relative w-full h-dvh overflow-hidden",
            "md:w-[390px] md:h-[844px] md:rounded-[44px] md:shadow-2xl md:overflow-hidden",
            "md:[transform:translateZ(0)]",
          ].join(" ")}
          style={{ background: "#faf8f4" }}
        >
          <SeedInit />

          {/* Scrollable content area */}
          <div className="h-full overflow-y-auto overscroll-contain pb-20">
            <main>{children}</main>
          </div>

          {/* Bottom nav — position:fixed, contained within the phone frame */}
          <BottomNav />

          {/* Dev-only reset button — only visible in development */}
          <DevReset />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
