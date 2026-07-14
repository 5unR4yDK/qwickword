// Reads Daily.co credentials from the environment and falls back to a "mock mode"
// when they are not configured, so the app can boot and be developed without a
// real Daily account. Phase 0 item 3 (POST /api/rooms) will be the first consumer
// that actually calls the Daily REST API using this config.

export type DailyConfig = {
  /** Present only when both env vars are set; null in mock mode. */
  apiKey: string | null;
  /** Present only when both env vars are set; null in mock mode. */
  domain: string | null;
  /** True when DAILY_API_KEY or DAILY_DOMAIN is missing/empty. */
  mockMode: boolean;
};

let loggedOnce = false;

/**
 * Reads DAILY_API_KEY / DAILY_DOMAIN from process.env (populated by Next.js from
 * .env.local). Never throws: if either value is missing, returns mockMode: true
 * so callers can simulate Daily behaviour instead of crashing the app.
 */
export function getDailyConfig(): DailyConfig {
  const apiKey = process.env.DAILY_API_KEY?.trim() || null;
  const domain = process.env.DAILY_DOMAIN?.trim() || null;
  const mockMode = !apiKey || !domain;

  if (!loggedOnce) {
    loggedOnce = true;
    if (mockMode) {
      console.warn(
        "[Quick Word] Daily: mock mode — DAILY_API_KEY / DAILY_DOMAIN not set in " +
          ".env.local. Room creation and video will be simulated until real credentials " +
          "are configured."
      );
    } else {
      console.log(`[Quick Word] Daily: live mode (domain: ${domain})`);
    }
  }

  return { apiKey, domain, mockMode };
}
