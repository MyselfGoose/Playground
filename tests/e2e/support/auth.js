/** @typedef {import('@playwright/test').Page} Page */

/** Password meeting backend register policy (12+ mixed case, number, symbol). */
export const E2E_PASSWORD = "E2eTest123!@#ab";

/**
 * Register a new user via /register and wait until signed-in UI is visible.
 *
 * @param {Page} page
 * @param {{ nextPath?: string }} [opts]
 * @returns {Promise<{ email: string, username: string }>}
 */
export async function registerTestUser(page, opts = {}) {
  const nextPath = opts.nextPath ?? "/games";
  const stamp = Date.now();
  const email = `e2e_${stamp}@example.com`;
  const username = `e2e_${stamp}`;

  await page.goto(`/register?next=${encodeURIComponent(nextPath)}`);

  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  const [registerResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/v1/auth/register") && res.request().method() === "POST",
      { timeout: 30_000 },
    ),
    page.getByRole("button", { name: "Create account" }).click(),
  ]);

  if (!registerResponse.ok()) {
    const body = await registerResponse.text().catch(() => "");
    throw new Error(`Register failed: ${registerResponse.status()} ${body}`);
  }

  await page.getByRole("link", { name: username }).waitFor({ timeout: 30_000 });

  return { email, username };
}

/**
 * Log in with env credentials (staging reuse). Falls back to register when env unset.
 *
 * @param {Page} page
 * @param {{ nextPath?: string }} [opts]
 */
export async function ensureSignedIn(page, opts = {}) {
  const email = process.env.E2E_USER_EMAIL?.trim();
  const password = process.env.E2E_USER_PASSWORD?.trim();
  const nextPath = opts.nextPath ?? "/games";

  if (!email || !password) {
    return registerTestUser(page, { nextPath });
  }

  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === nextPath || url.pathname.startsWith(`${nextPath}/`), {
    timeout: 30_000,
  });
  return { email, username: email.split("@")[0] ?? "e2e" };
}
