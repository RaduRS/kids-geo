import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { HeaderNav } from "./components/header-nav";
import { BalanceBadge } from "@/app/components/balance-badge";
import { BalanceProvider } from "@/app/components/balance-provider";
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
  // Icons are provided via the App Router file conventions (app/icon.svg,
  // app/apple-icon.png, app/favicon.ico). Next emits them with content-hashed
  // URLs, so updated artwork busts the browser cache automatically.
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
        <BalanceProvider>
          <div className="min-h-screen bg-linear-to-b from-sky-50 via-sky-50 to-sky-100">
          <header className="sticky top-0 z-20 w-full border-b border-sky-200/70 bg-white/70 backdrop-blur">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between md:px-6 md:py-4">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:mr-auto"
                aria-label="Go to world map"
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl shadow-sm shadow-slate-900/10 ring-2 ring-white/80">
                  <Image
                    src="/icon-mark.svg"
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10"
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

              <div className="col-span-2 row-start-2 sm:contents">
                <HeaderNav />
              </div>
              <BalanceBadge />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-10">
            {children}
          </main>
          </div>
        </BalanceProvider>
      </body>
    </html>
  );
}
