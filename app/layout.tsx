import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { HeaderNav } from "./components/header-nav";
import { PwaRegister } from "@/app/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kids Geo",
  description:
    "Tablet-first geography game for kids with interactive world map and PWA support.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/flag.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}
      >
        <PwaRegister />
        <div className="min-h-screen bg-linear-to-b from-sky-50 via-sky-50 to-sky-100">
          <header className="sticky top-0 z-20 w-full border-b border-sky-200/70 bg-white/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-2xl outline-none focus:outline-none focus-visible:outline-none"
                aria-label="Go to world map"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 via-sky-500 to-fuchsia-500 shadow-sm shadow-slate-900/10 ring-2 ring-white/80">
                  <Image
                    src="/flag.svg"
                    alt=""
                    width={22}
                    height={22}
                    className="h-6 w-6 opacity-100"
                    priority
                  />
                </div>
                <div className="leading-tight">
                  <div className="text-lg font-semibold md:text-xl">
                    Kids Geo
                  </div>
                  <div className="text-xs text-slate-600 md:text-sm">
                    Tap to learn geography
                  </div>
                </div>
              </Link>

              <HeaderNav />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
