
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

// Cache API responses in memory to avoid repeated fetches during session
let countriesCache: Country[] | null = null;

export async function getCountries(): Promise<Country[]> {
  if (countriesCache) {
    return countriesCache;
  }

  try {
    const res = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,capital,flags,cca2,region,subregion"
    );

    if (!res.ok) {
      throw new Error("Failed to fetch countries");
    }

    const data = await res.json();
    countriesCache = data;
    return data;
  } catch (error) {
    console.error("Error fetching countries:", error);
    return [];
  }
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
