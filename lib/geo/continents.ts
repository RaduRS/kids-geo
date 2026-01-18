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
    labelXPercent: 22,
    labelYPercent: 32,
    color: "#f97316",
    activeColor: "#ea580c",
    path:
      "M80 60 L260 60 L260 120 L220 140 L200 170 L150 170 L120 200 L80 200 Z",
  },
  {
    id: "south-america",
    name: "South America",
    labelXPercent: 28,
    labelYPercent: 68,
    color: "#facc15",
    activeColor: "#eab308",
    path:
      "M210 180 L260 180 L300 230 L290 280 L270 330 L230 360 L210 320 L220 260 Z",
  },
  {
    id: "europe",
    name: "Europe",
    labelXPercent: 50,
    labelYPercent: 28,
    color: "#0ea5e9",
    activeColor: "#0284c7",
    path: "M320 40 L430 40 L470 80 L470 120 L430 150 L350 140 L320 100 Z",
  },
  {
    id: "africa",
    name: "Africa",
    labelXPercent: 52,
    labelYPercent: 56,
    color: "#22c55e",
    activeColor: "#16a34a",
    path: "M360 150 L450 150 L480 220 L470 290 L450 360 L380 360 L350 260 Z",
  },
  {
    id: "asia",
    name: "Asia",
    labelXPercent: 72,
    labelYPercent: 38,
    color: "#6366f1",
    activeColor: "#4f46e5",
    path:
      "M430 60 L620 60 L700 80 L740 140 L740 180 L700 200 L650 210 L600 190 L540 200 L500 210 L460 180 L480 140 Z",
  },
  {
    id: "australia-oceania",
    name: "Australia",
    labelXPercent: 78,
    labelYPercent: 72,
    color: "#ec4899",
    activeColor: "#db2777",
    path: "M600 260 L700 260 L740 300 L720 340 L670 360 L610 350 Z",
  },
  {
    id: "antarctica",
    name: "Antarctica",
    labelXPercent: 50,
    labelYPercent: 92,
    color: "#e5e7eb",
    activeColor: "#d1d5db",
    path: "M40 360 L760 360 L740 390 L60 390 Z",
  },
];

export function findContinentById(id: ContinentId) {
  return CONTINENTS.find((continent) => continent.id === id) ?? null;
}

