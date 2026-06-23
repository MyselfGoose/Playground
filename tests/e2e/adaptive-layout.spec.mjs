import { test, expect } from "@playwright/test";

/** Device-class viewport matrix for adaptive layout verification */
const VIEWPORTS = [
  { name: "small-phone-portrait", width: 320, height: 568 },
  { name: "standard-phone-portrait", width: 390, height: 844 },
  { name: "large-phone-portrait", width: 430, height: 932 },
  { name: "standard-phone-landscape", width: 844, height: 390 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "ultrawide", width: 2560, height: 1080 },
];

const ROUTES = [
  { path: "/", heading: /playground/i },
  { path: "/games", heading: /pick your game/i },
  { path: "/leaderboard", heading: /global|typing|npat|taboo/i },
];

async function assertNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > window.innerWidth + 2;
  });
  expect(hasOverflow).toBe(false);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Adaptive layout @ ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    for (const route of ROUTES) {
      test(`${route.path} renders without horizontal overflow`, async ({ page }) => {
        const res = await page.goto(route.path);
        expect(res?.ok()).toBeTruthy();
        await expect(page.locator("body")).toBeVisible();
        await assertNoHorizontalOverflow(page);
      });
    }

    test("navbar exposes menu or desktop links", async ({ page }) => {
      await page.goto("/");
      const menuButton = page.getByRole("button", { name: /open menu/i });
      const gamesLink = page.getByRole("link", { name: "Games" });
      const menuVisible = await menuButton.isVisible().catch(() => false);
      const desktopNavVisible = await gamesLink.isVisible().catch(() => false);
      expect(menuVisible || desktopNavVisible).toBe(true);
    });

    test("phone header does not overflow horizontally when logged out", async ({ page }) => {
      await page.goto("/");
      const headerOverflow = await page.evaluate(() => {
        const header = document.querySelector("header");
        if (!header) return false;
        return header.scrollWidth > header.clientWidth + 2;
      });
      expect(headerOverflow).toBe(false);
    });

    test("main landmark uses play-area min height token", async ({ page }) => {
      await page.goto("/");
      const main = page.locator("#main-content");
      await expect(main).toBeVisible();
      const hasPlayAreaClass = await main.evaluate((el) => el.classList.contains("min-h-play-area"));
      expect(hasPlayAreaClass).toBe(true);
    });
  });
}

test.describe("Game immersive chrome", () => {
  test("marketing routes are not immersive", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/games");
    const immersive = await page.evaluate(() => document.documentElement.dataset.gameImmersive);
    expect(immersive).toBe("false");
  });
});
