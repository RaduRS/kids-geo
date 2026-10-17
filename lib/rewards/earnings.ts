import type { ContinentId } from "@/lib/geo/continents";

// Money is tracked in pence (integer) so the running balance never drifts the
// way floating-point pounds would. The smaller, better-known continents pay
// less, so a child does not earn the whole balance on the easiest quizzes.
export const EUROPE_REWARD_PENCE = 10;
export const SOUTH_AMERICA_REWARD_PENCE = 30;
export const NORTH_AMERICA_REWARD_PENCE = 50;
export const OTHER_CONTINENT_REWARD_PENCE = 100;

const REWARD_BY_CONTINENT: Partial<Record<ContinentId, number>> = {
  europe: EUROPE_REWARD_PENCE,
  "south-america": SOUTH_AMERICA_REWARD_PENCE,
  "north-america": NORTH_AMERICA_REWARD_PENCE,
  // Oceania has fewer than ten countries on the map, so its round is too short
  // to ever reach the perfect score that pays out.
  "australia-oceania": 0,
};

// Only a flawless round pays out: the country, capital, and flag quizzes are
// ten questions each, so a "perfect" round means 10 correct out of 10.
export function rewardPenceForContinent(continentId: ContinentId): number {
  return REWARD_BY_CONTINENT[continentId] ?? OTHER_CONTINENT_REWARD_PENCE;
}

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
