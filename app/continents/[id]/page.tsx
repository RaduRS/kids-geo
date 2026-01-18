"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { findContinentById } from "@/lib/geo/continents";
import {
  getCountries,
  getCountriesByContinent,
  Country,
} from "@/lib/api/countries";

export default function ContinentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const continent = findContinentById(id);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!continent) return;

      const allCountries = await getCountries();
      const continentCountries = getCountriesByContinent(
        allCountries,
        continent.name,
      );
      // Sort alphabetically
      continentCountries.sort((a, b) =>
        a.name.common.localeCompare(b.name.common),
      );

      setCountries(continentCountries);
      setLoading(false);
    }

    loadData();
  }, [continent]);

  if (!continent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-red-600">Continent not found</h1>
        <Link href="/continents" className="mt-4 text-sky-600 underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-50 px-4 py-8">
      <header className="mb-8 w-full max-w-5xl text-center md:text-left">
        <div className="mb-4 flex items-center gap-4">
          <Link href="/continents" className="text-sky-600 hover:text-sky-800">
            ← Back to Continents
          </Link>
        </div>
        <div
          className="flex items-center gap-4 rounded-xl p-6 text-white shadow-lg"
          style={{ backgroundColor: continent.color }}
        >
          <h1 className="text-4xl font-bold md:text-5xl">{continent.name}</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 w-full items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600"></div>
        </div>
      ) : (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country) => (
            <div
              key={country.cca2}
              className="flex flex-col overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="relative h-12 w-20 overflow-hidden rounded border border-slate-100 shadow-sm">
                  <Image
                    src={country.flags.svg}
                    alt={country.flags.alt || `Flag of ${country.name.common}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {country.cca2}
                </span>
              </div>

              <h2 className="line-clamp-1 text-lg font-bold text-slate-800">
                {country.name.common}
              </h2>

              <div className="mt-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-400">Capital:</span>{" "}
                  {country.capital?.[0] || "N/A"}
                </p>
              </div>
            </div>
          ))}

          {countries.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No countries found for this region in the database.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
