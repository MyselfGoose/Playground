import { test, expect } from "@playwright/test";
import { ensureSignedIn } from "./support/auth.js";

/**
 * Second-player join via a second browser context is covered manually in ops-smoke-test.md
 * (optional; can be flaky in CI without extra isolation).
 */
test.describe("NPAT lobby E2E", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await ensureSignedIn(page, { nextPath: "/games" });
  });

  test("create room shows lobby code", async ({ page }) => {
    await page.goto("/games/npat");

    const createBtn = page.getByRole("button", { name: /Create Game/i });
    await expect(createBtn).toBeEnabled({ timeout: 30_000 });
    await createBtn.click();

    await page.waitForURL(/\/games\/npat\/lobby\?code=\d+/, { timeout: 30_000 });

    const url = new URL(page.url());
    const code = url.searchParams.get("code");
    expect(code).toMatch(/^\d+$/);

    await expect(page.getByText(code, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Ready up/i })).toBeVisible();
  });
});
