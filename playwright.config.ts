import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against a production build with DAILY_API_KEY, DAILY_DOMAIN
 * and DATABASE_URL deliberately blanked. That is not a convenience — it is the
 * point:
 *
 *   - Blank Daily credentials put the app in mock mode (see lib/daily-config),
 *     so creating a link never calls the Daily API or provisions a real room.
 *   - A blank DATABASE_URL makes every write in lib/db a no-op, so the tests
 *     cannot insert rows into `calls`. That table is the usage signal the
 *     monitoring routine reads; test rooms in it would be indistinguishable
 *     from real ones and would quietly corrupt the numbers.
 *
 * Anything that needs real credentials does not belong in this suite.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npx next start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DAILY_API_KEY: "",
      DAILY_DOMAIN: "",
      DATABASE_URL: "",
      IDENTITY_HMAC_SECRET: "playwright-traffic-secret-not-for-production",
    },
  },
});
