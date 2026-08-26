export const REFERRER_CATEGORIES = [
  "direct",
  "internal",
  "search",
  "social",
  "other",
] as const;

export type ReferrerCategory = (typeof REFERRER_CATEGORIES)[number];

const REFERRER_CATEGORY_SET = new Set<string>(REFERRER_CATEGORIES);
const SEARCH_HOSTS = [
  "bing.com",
  "duckduckgo.com",
  "google.com",
  "search.brave.com",
  "search.yahoo.com",
] as const;
const SOCIAL_HOSTS = [
  "bsky.app",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "t.co",
  "threads.net",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
] as const;

function isHostOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isReferrerCategory(value: unknown): value is ReferrerCategory {
  return typeof value === "string" && REFERRER_CATEGORY_SET.has(value);
}

/**
 * Reduce a browser referrer to a fixed category. The referrer URL, hostname,
 * path, and query are never returned or sent to Qwickword.
 */
export function classifyReferrer(
  referrer: string,
  currentOrigin: string
): ReferrerCategory {
  if (!referrer) return "direct";

  let referrerUrl: URL;
  try {
    referrerUrl = new URL(referrer);
  } catch {
    return "other";
  }

  if (referrerUrl.origin === currentOrigin) return "internal";

  const hostname = referrerUrl.hostname.toLowerCase();
  if (SEARCH_HOSTS.some((domain) => isHostOrSubdomain(hostname, domain))) {
    return "search";
  }
  if (SOCIAL_HOSTS.some((domain) => isHostOrSubdomain(hostname, domain))) {
    return "social";
  }
  return "other";
}
