"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNav() {
  const pathname = usePathname();
  const isQuiz = pathname.startsWith("/quiz");
  const isContinents = pathname.startsWith("/continents");
  const isMap = pathname === "/";

  const activeClass =
    "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-950";
  const inactiveClass =
    "rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100";
  const quizClass =
    "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-900/10 outline-none transition-colors hover:bg-amber-600 focus:outline-none focus-visible:outline-none active:bg-amber-700";
  const quizActiveClass =
    "rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-900/10 outline-none focus:outline-none focus-visible:outline-none";

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
      <Link
        href="/quiz?reset=1"
        className={isQuiz ? quizActiveClass : quizClass}
      >
        Quiz
      </Link>
    </nav>
  );
}
