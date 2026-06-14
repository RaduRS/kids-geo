// Regenerates lib/api/countries.data.json — the app's bundled country dataset.
//
// Why this exists: the app originally fetched from REST Countries v3.1 at runtime,
// but that API was deprecated and now returns an error payload instead of data,
// which silently emptied every country list. We bundle the data instead so the
// app has zero runtime dependency on a third-party service.
//
// Source of facts: mledoze/countries (stable, public-domain dataset on GitHub).
// Flag images: flagcdn.com, built from each country's cca2 code (same CDN that
// REST Countries used), so flags stay reliable without bundling image files.
//
// Run:  node scripts/generate-countries.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "lib", "api", "countries.data.json");

const res = await fetch(SOURCE);
if (!res.ok) {
  throw new Error(`Failed to fetch source data: HTTP ${res.status}`);
}
const src = await res.json();

const countries = src
  .filter((c) => c.cca2 && c.name && c.name.common)
  .map((c) => {
    const code = c.cca2.toLowerCase();
    return {
      name: { common: c.name.common, official: c.name.official },
      capital: c.capital && c.capital.length ? c.capital : undefined,
      region: c.region || "",
      subregion: c.subregion || undefined,
      flags: {
        png: `https://flagcdn.com/w320/${code}.png`,
        svg: `https://flagcdn.com/${code}.svg`,
        alt: `The flag of ${c.name.common}`,
      },
      cca2: c.cca2,
    };
  })
  .sort((a, b) => a.name.common.localeCompare(b.name.common));

writeFileSync(OUT, JSON.stringify(countries, null, 2) + "\n");
console.log(`Wrote ${countries.length} countries to ${OUT}`);
