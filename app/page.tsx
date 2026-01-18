import { WorldMap } from "@/app/components/world-map";

export default function Home() {
  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <header className="flex w-full flex-col items-center justify-between gap-4 text-center md:flex-row md:items-end md:text-left">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Tap a continent
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-700 md:text-lg">
            Tap anywhere on the map to hear the continent name and see it pop up
            for a few seconds.
          </p>
        </div>
      </header>

      <section className="w-full">
        <WorldMap />
      </section>
    </div>
  );
}
