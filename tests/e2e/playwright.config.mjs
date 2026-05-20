import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..", "..");
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: configDir,
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isCi
    ? {
        command: "node scripts/start-e2e-stack.mjs",
        cwd: repoRoot,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 360_000,
      }
    : process.env.E2E_STACK
      ? {
          command: "node scripts/start-e2e-stack.mjs",
          cwd: repoRoot,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 360_000,
        }
      : undefined,
});
