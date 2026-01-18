export type ContinentId =
  | "africa"
  | "europe"
  | "asia"
  | "north-america"
  | "south-america"
  | "australia-oceania"
  | "antarctica";

export type Continent = {
  id: ContinentId;
  name: string;
  labelXPercent: number;
  labelYPercent: number;
  color: string;
  activeColor: string;
  path: string;
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
    color: "#facc15",
    activeColor: "#eab308",
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
    color: "#22c55e",
    activeColor: "#16a34a",
    path: "",
  },
  {
    id: "asia",
    name: "Asia",
    labelXPercent: 75,
    labelYPercent: 30,
    color: "#6366f1",
    activeColor: "#4f46e5",
    path: "",
  },
  {
    id: "australia-oceania",
    name: "Australia",
    labelXPercent: 85,
    labelYPercent: 75,
    color: "#ec4899",
    activeColor: "#db2777",
    path: "",
  },
  {
    id: "antarctica",
    name: "Antarctica",
    labelXPercent: 50,
    labelYPercent: 92,
    color: "#e5e7eb",
    activeColor: "#d1d5db",
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
): ContinentId | null {
  const r = region.toLowerCase();
  const s = subregion?.toLowerCase() || "";

  if (r === "africa") return "africa";
  if (r === "europe") return "europe";
  if (r === "asia") return "asia";
  if (r === "oceania") return "australia-oceania";
  if (r === "antarctic") return "antarctica";

  if (r === "americas") {
    if (s === "south america") return "south-america";
    // North America, Central America, Caribbean -> North America
    return "north-america";
  }

  return null;
}
