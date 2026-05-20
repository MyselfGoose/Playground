import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Home is the CI gate; login contrast is tracked in a11y-backlog.md (Phase 19). */
const ROUTES = [
  { path: "/", ci: true },
  { path: "/login", ci: false },
];

for (const { path, ci } of ROUTES) {
  test(`no serious axe violations on ${path}`, async ({ page }) => {
    test.skip(Boolean(process.env.CI) && !ci, "Non-gating route in CI — see a11y-backlog.md");
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === "serious");
    if (serious.length > 0) {
      console.error(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join("\n"),
      );
    }
    expect(serious).toEqual([]);
  });
}

test("skip link targets main content", async ({ page }) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeAttached();
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  const main = page.locator("#main-content");
  await expect(main).toBeFocused();
});
