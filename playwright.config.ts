import { defineConfig, devices } from "@playwright/test";

/** End to end demo path. Runs against E2E_BASE_URL, production by default. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://qwida.vercel.app",
    locale: "es-PR",
    timezoneId: "America/Puerto_Rico",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
