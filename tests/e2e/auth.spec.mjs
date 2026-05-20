import { test, expect } from "@playwright/test";
import { registerTestUser } from "./support/auth.js";

test.describe("Auth E2E", () => {
  test.setTimeout(60_000);

  test("register lands on games hub signed in", async ({ page }) => {
    const { username } = await registerTestUser(page, { nextPath: "/games" });

    await expect(page).toHaveURL(/\/games\/?$/);
    await expect(page.getByRole("link", { name: username })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });
});
