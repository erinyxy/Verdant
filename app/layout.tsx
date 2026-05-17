import type { Metadata, Viewport } from "next";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";

// Lora Regular — 衬线字体，用于 wordmark 和品牌文字展示
const lora = Lora({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

// Manrope Medium — 无衬线字体，用于 UI 文字、tagline
const manrope = Manrope({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verdant",
  description: "A plant memory journal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Verdant",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5f0ea",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`h-full ${lora.variable} ${manrope.variable}`}>
      <head>
        {/* 浏览器标签页图标 — 绿底填满，无白边 */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-filled-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-filled-16.png" />
        {/* iOS 主屏图标 — 180×180 */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
