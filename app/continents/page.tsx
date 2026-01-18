import Link from "next/link";
import { CONTINENTS } from "@/lib/geo/continents";

export default function ContinentsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-sky-50 px-4 py-6">
      <main className="flex w-full max-w-5xl flex-1 flex-col gap-6 md:gap-8">
        <header className="flex w-full flex-col items-center justify-between gap-4 border-b border-sky-200 pb-6 md:flex-row md:items-start">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-semibold text-sky-900 md:text-4xl">
              Continents
            </h1>
            <p className="mt-2 text-base text-sky-900/80 md:text-lg">
              Explore the 7 continents of the world.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full bg-sky-100 px-6 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 active:bg-sky-300 transition-colors"
          >
            ← Back to Map
          </Link>
        </header>

        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTINENTS.map((continent) => (
            <Link
              key={continent.id}
              href={`/continents/${continent.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <div
                className="h-32 w-full transition-colors"
                style={{ backgroundColor: continent.color }}
              />
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-2xl font-bold text-slate-800 group-hover:text-sky-700 transition-colors">
                  {continent.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">Tap to learn more</p>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
