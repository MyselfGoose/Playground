import { test, expect } from "@playwright/test";

/**
 * Post–Wave 1 smoke: each game entry route loads without a client crash.
 * Full login → room → refresh → logout flows require auth fixtures (see manual QA matrix).
 */
const GAME_ENTRY_PATHS = [
  "/games/npat",
  "/games/cah",
  "/games/taboo",
  "/games/hangman",
  "/games/typing-race",
];

test.describe("Game entry smoke", () => {
  for (const path of GAME_ENTRY_PATHS) {
    test(`${path} loads`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
      const crash = page.locator("text=useEffect is not defined");
      await expect(crash).toHaveCount(0);
    });
  }
});
