export type ContinentId =
  | "africa"
  | "europe"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania";

export type Continent = {
  id: ContinentId;
  name: string;
  labelXPercent: number;
  labelYPercent: number;
  color: string;
  activeColor: string;
  path: string;
};

export const CONTINENT_MAP_SVG_SRC: Record<ContinentId, string> = {
  africa: "/maps/africaHigh.svg",
  asia: "/maps/asiaHigh.svg",
  europe: "/maps/europeHigh.svg",
  "north-america": "/maps/northAmericaHigh.svg",
  "south-america": "/maps/southAmericaHigh.svg",
  "australia-oceania": "/maps/oceaniaHigh.svg",
};

export const CONTINENTS: Continent[] = [
  {
    id: "north-america",
    name: "North America",
    labelXPercent: 20,
    labelYPercent: 30,
    color: "#f97316",
    activeColor: "#ea580c",
    path: "", // Loaded dynamically
  },
  {
    id: "south-america",
    name: "South America",
    labelXPercent: 28,
    labelYPercent: 65,
    color: "#22c55e",
    activeColor: "#16a34a",
    path: "",
  },
  {
    id: "europe",
    name: "Europe",
    labelXPercent: 50,
    labelYPercent: 25,
    color: "#0ea5e9",
    activeColor: "#0284c7",
    path: "",
  },
  {
    id: "africa",
    name: "Africa",
    labelXPercent: 52,
    labelYPercent: 50,
    color: "#facc15",
    activeColor: "#eab308",
    path: "",
  },
  {
    id: "asia",
    name: "Asia",
    labelXPercent: 75,
    labelYPercent: 30,
    color: "#ef4444",
    activeColor: "#dc2626",
    path: "",
  },
  {
    id: "australia-oceania",
    name: "Australia",
    labelXPercent: 85,
    labelYPercent: 75,
    color: "#6366f1",
    activeColor: "#4f46e5",
    path: "",
  },
];

export function findContinentById(id: string) {
  return CONTINENTS.find((continent) => continent.id === id) ?? null;
}

// Map REST API regions/subregions to our continent IDs
export function mapCountryToContinent(
  region: string,
  subregion?: string,
  countryCode?: string,
): ContinentId | null {
  const code = countryCode?.toLowerCase() ?? "";
  if (code === "ru") return "asia";

  const r = region.toLowerCase();
  const s = subregion?.toLowerCase() || "";

  if (r === "africa") return "africa";
  if (r === "europe") return "europe";
  if (r === "asia") return "asia";
  if (r === "oceania") return "australia-oceania";

  if (r === "americas") {
    if (s === "south america") return "south-america";
    // North America, Central America, Caribbean -> North America
    return "north-america";
  }

  return null;
}
