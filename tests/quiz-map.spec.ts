import { expect, test } from "@playwright/test";
import countries from "../lib/api/countries.data.json";

const continents = [
  ["north-america", "North America"],
  ["south-america", "South America"],
  ["europe", "Europe"],
  ["africa", "Africa"],
  ["asia", "Asia"],
  ["australia-oceania", "Australia & Oceania"],
] as const;

const quizzes = [
  ["Find the country", "Country quiz map"],
  ["Match the flag", "Flags quiz map"],
  ["Name the capital", "Capitals quiz map"],
] as const;

test("phone navigation stays on screen and Puerto Rico accepts a tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/quiz");
  await expect(page.getByRole("button", { name: /Balance/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: /Find the country/ }).click();
  await page.getByRole("button", { name: /North America/ }).click();
  const place = page.getByRole("button", { name: "Puerto Rico", exact: true });
  await place.click();
  await expect(place).toHaveAttribute("fill", "#93c5fd");
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
});

for (const [id, name] of continents) {
  for (const [quiz, mapLabel] of quizzes) {
    test(`${name}: ${quiz} includes every place on the learning map`, async ({ page }) => {
      await page.goto(`/continents/${id}`);
      const learningMap = page.locator(`svg[aria-label="${name} country map"]`);
      await expect(learningMap.locator('path[role="button"]').first()).toBeVisible();
      const expected = await learningMap.locator("path[aria-label]").evaluateAll(
        (paths) => [...new Set(paths.map((path) => path.getAttribute("aria-label")))].sort(),
      );

      await page.goto("/quiz");
      await page.getByRole("button", { name: new RegExp(quiz) }).click();
      await page.getByRole("button", { name: new RegExp(name) }).click();
      const quizMap = page.locator(`svg[aria-label="${mapLabel}"]`);
      await expect(quizMap.locator("path[aria-label]").first()).toBeVisible();
      const actual = await quizMap.locator("path[aria-label]").evaluateAll(
        (paths) => [...new Set(paths.map((path) => path.getAttribute("aria-label")))].sort(),
      );
      expect(actual).toEqual(expected);

      if (mapLabel !== "Capitals quiz map") {
        await expect(quizMap.locator('path[role="button"]')).toHaveCount(
          await quizMap.locator("path[aria-label]").count(),
        );
      }
    });
  }
}

for (const [continent, name] of [
  ["North America", "Puerto Rico"],
  ["South America", "Falkland Islands"],
  ["Australia & Oceania", "New Caledonia"],
] as const) {
  for (const [quiz, mapLabel] of quizzes) {
    test(`${name} can be quizzed and answered in ${quiz}`, async ({ page }) => {
      // Stable rounds include these places within the first 20 questions.
      await page.goto("/quiz");
      await page.getByRole("button", { name: new RegExp(quiz) }).click();
      const continentButton = page.getByRole("button", { name: new RegExp(continent) });
      await expect(continentButton).toBeVisible();
      await page.evaluate(() => { Math.random = () => 0; });
      await continentButton.click();
      const quizMap = page.locator(`svg[aria-label="${mapLabel}"]`);
      await expect(quizMap.locator("path[aria-label]").first()).toBeVisible();
      let answeredTarget = false;

      if (mapLabel !== "Capitals quiz map") {
        const place = quizMap.getByRole("button", { name, exact: true }).first();
        await place.click();
        await expect(place).toHaveAttribute("fill", "#93c5fd");
        await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeEnabled();
      }

      for (let question = 0; question < 20; question += 1) {
        let targetName: string;
        if (mapLabel === "Flags quiz map") {
          const flagImage = page.getByRole("img", { name: /^(The flag of |Flag of )/ });
          const flag = await flagImage.getAttribute("alt") ??
            await flagImage.getAttribute("aria-label");
          targetName = flag!.replace(/^(The flag of |Flag of )/, "");
        } else {
          const prompt = await page.getByRole("button", { name: /^(Where is |What is the capital of )/ }).innerText();
          targetName = prompt.replace(/^(Where is |What is the capital of )/, "").replace(/\?$/, "");
        }
        const country = countries.find((country) => country.name.common === targetName);
        expect(country, `Country for ${targetName}`).toBeDefined();

        if (mapLabel === "Capitals quiz map") {
          await page.getByRole("button", { name: country!.capital![0], exact: true }).click();
        } else {
          const place = quizMap.getByRole("button", { name: targetName, exact: true }).first();
          await place.focus();
          await place.press("Enter");
        }
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        const score = mapLabel === "Capitals quiz map"
          ? `Score: ${question + 1}/20`
          : `${question + 1}/20`;
        await expect(page.getByText(score, { exact: true })).toBeVisible();
        answeredTarget ||= targetName === name;
        await page.getByRole("button", { name: "Next", exact: true }).click();
      }

      expect(answeredTarget, `${name} must appear in the question pool`).toBe(true);
      await expect(page.getByText("Score: 20/20", { exact: true }).last()).toBeVisible();
    });
  }
}
