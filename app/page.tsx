import { WorldMap } from "@/app/components/world-map";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sky-50 px-4 py-6">
      <main className="flex w-full max-w-5xl flex-1 flex-col items-center gap-6 md:gap-8">
        <header className="flex w-full flex-col items-center text-center md:items-start md:text-left">
          <h1 className="text-3xl font-semibold text-sky-900 md:text-4xl">
            Tap a continent
          </h1>
          <p className="mt-2 max-w-xl text-base text-sky-900/80 md:text-lg">
            Tap on the map to hear the continent name and see it highlighted.
          </p>
        </header>
        <section className="flex w-full flex-1 items-center justify-center">
          <WorldMap />
        </section>
      </main>
    </div>
  );
}
