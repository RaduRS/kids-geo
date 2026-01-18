import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
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
        <div className="min-h-screen bg-gradient-to-b from-sky-50 via-sky-50 to-sky-100">
          <header className="sticky top-0 z-20 w-full border-b border-sky-200/70 bg-white/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-base font-black tracking-tight text-white shadow-sm shadow-sky-900/15">
                  KG
                </div>
                <div className="leading-tight">
                  <div className="text-lg font-semibold md:text-xl">
                    Kids Geo
                  </div>
                  <div className="text-xs text-slate-600 md:text-sm">
                    Tap to learn geography
                  </div>
                </div>
              </div>

              <nav className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition-colors hover:bg-slate-800 active:bg-slate-950"
                >
                  Map
                </Link>
                <Link
                  href="/continents"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  Continents
                </Link>
              </nav>
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
