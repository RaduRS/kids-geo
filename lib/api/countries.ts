
export type Country = {
  name: {
    common: string;
    official: string;
  };
  capital?: string[];
  region: string;
  subregion?: string;
  flags: {
    png: string;
    svg: string;
    alt?: string;
  };
  cca2: string;
};

// Country data is bundled locally (see countries.data.json) so the app has no
// runtime dependency on any external API. The REST Countries v3.1 API this app
// originally used was deprecated and now returns an error payload instead of
// data, which silently emptied every country list. Flag images are served from
// flagcdn.com (the same CDN REST Countries used) and built from each cca2 code.
//
// To refresh the dataset, see scripts/generate-countries.mjs.
import countriesData from "./countries.data.json";

export async function getCountries(): Promise<Country[]> {
  return countriesData as Country[];
}

export function getCountriesByContinent(
  countries: Country[],
  continentName: string
): Country[] {
  // Map our app's continent names to REST Countries API region/subregion logic if needed
  // For now, simple region matching:
  // Africa, Americas, Asia, Europe, Oceania, Antarctic
  
  const normalizedContinent = continentName.toLowerCase();
  
  return countries.filter((country) => {
    const region = country.region.toLowerCase();
    
    if (normalizedContinent === "north america" || normalizedContinent === "south america") {
        return region === "americas"; // REST countries groups them as Americas
        // We could filter further by subregion if we want strict separation
    }
    
    if (normalizedContinent === "australia" || normalizedContinent === "australia-oceania") {
        return region === "oceania";
    }
    
    return region === normalizedContinent;
  });
}
