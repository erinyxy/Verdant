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
        className="min-h-dvh md:min-h-screen md:flex md:items-center md:justify-center"
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
         * Mobile: NO fixed height, NO inner scroll container, NO transform.
         * The document itself scrolls (min-h-dvh just guarantees at least one
         * screen). BottomNav is a plain `fixed bottom-0` — the single most
         * reliable pattern on iOS. Earlier attempts used an h-dvh frame with
         * an inner scroller, which desynced from the visual viewport whenever
         * the address bar collapsed/expanded, leaking a band of frame
         * background above the nav and trapping touches.
         *
         * Desktop (md+): becomes a fixed-size phone preview. h-[844px] +
         * overflow-hidden clips it; the inner div scrolls; translateZ(0)
         * creates a containing block so BottomNav / FABs stay inside the
         * frame instead of escaping to the browser viewport corners. */}
        <div
          className={[
            "relative w-full min-h-dvh",
            "md:w-[390px] md:h-[844px] md:min-h-0 md:rounded-[44px] md:shadow-2xl md:overflow-hidden",
            "md:[transform:translateZ(0)]",
          ].join(" ")}
          style={{ background: "#faf8f4" }}
        >
          <SeedInit />

          {/* Content area. Mobile: no own scroll (document scrolls), just
           *  bottom padding so the last items clear the fixed nav. Desktop:
           *  becomes the scroll viewport inside the clipped frame. */}
          <div className="pb-24 md:h-full md:overflow-y-auto md:overscroll-contain">
            <main>{children}</main>
          </div>

          {/* Bottom nav — fixed to viewport (mobile) / frame (desktop). */}
          <BottomNav />

          {/* Dev-only reset button — only visible in development */}
          <DevReset />
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
