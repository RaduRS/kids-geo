import type { ContinentId } from "@/lib/geo/continents";

// Money is tracked in pence (integer) so the running balance never drifts the
// way floating-point pounds would.
export const EUROPE_REWARD_PENCE = 10;
export const OTHER_CONTINENT_REWARD_PENCE = 100;

// Only a flawless round pays out: the country, capital, and flag quizzes are
// ten questions each, so a "perfect" round means 10 correct out of 10.
export function rewardPenceForContinent(continentId: ContinentId): number {
  return continentId === "europe"
    ? EUROPE_REWARD_PENCE
    : OTHER_CONTINENT_REWARD_PENCE;
}

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
