import Link from "next/link";
import { WorldMap } from "@/app/components/world-map";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sky-50 px-4 py-6">
      <main className="flex w-full max-w-5xl flex-1 flex-col items-center gap-6 md:gap-8">
        <header className="flex w-full flex-col items-center justify-between gap-4 text-center md:flex-row md:items-start md:text-left">
          <div>
            <h1 className="text-3xl font-semibold text-sky-900 md:text-4xl">
              Tap a continent
            </h1>
            <p className="mt-2 max-w-xl text-base text-sky-900/80 md:text-lg">
              Tap on the map to hear the continent name and see it highlighted.
            </p>
          </div>
          <Link
            href="/continents"
            className="rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-900/20 transition-all hover:bg-sky-700 hover:shadow-xl active:scale-95"
          >
            View List →
          </Link>
        </header>
        <section className="flex w-full flex-1 items-center justify-center">
          <WorldMap />
        </section>
      </main>
    </div>
  );
}
