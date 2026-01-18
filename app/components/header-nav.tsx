"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNav() {
  const pathname = usePathname();
  const isContinents = pathname.startsWith("/continents");
  const isMap = !isContinents;

  const activeClass =
    "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-950";
  const inactiveClass =
    "rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100";

  return (
    <nav className="flex items-center gap-2">
      <Link href="/" className={isMap ? activeClass : inactiveClass}>
        Map
      </Link>
      <Link
        href="/continents"
        className={isContinents ? activeClass : inactiveClass}
      >
        Continents
      </Link>
    </nav>
  );
}
