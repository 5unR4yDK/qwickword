import { createHmac, timingSafeEqual } from "node:crypto";

export const TRAFFIC_CLASSES = [
  "public",
  "founder",
  "developer",
  "contract",
  "smoke",
  "preview_fetch",
] as const;

export type TrafficClass = (typeof TRAFFIC_CLASSES)[number];

const AUTOMATED_USER_AGENT =
  /(?:googlebot|google-inspectiontool|bingbot|applebot|duckduckbot|yandexbot|baiduspider|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|perplexitybot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot)/i;

const TOKEN_VERSION = "v1";
const MAX_PROBE_TOKEN_AGE_SECONDS = 5 * 60;

function isTrafficClass(value: unknown): value is TrafficClass {
  return (
    typeof value === "string" &&
    (TRAFFIC_CLASSES as readonly string[]).includes(value)
  );
}

/**
 * Keep search indexing and link-preview fetches out of product-demand counts.
 * This is deliberately a narrow allowlist of declared crawler user agents;
 * an unknown or missing user agent remains public so we do not hide real use.
 */
export function trafficClassFromUserAgent(
  userAgent: string | null | undefined
): TrafficClass {
  return userAgent && AUTOMATED_USER_AGENT.test(userAgent)
    ? "preview_fetch"
    : "public";
}

function signature(secret: string, purpose: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(`qwickword:${purpose}:${TOKEN_VERSION}:${payload}`)
    .digest("base64url");
}

function signaturesMatch(expected: string, supplied: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

/**
 * Public is the secure default. A non-public class is accepted only when its
 * cookie was minted by this server; a visitor cannot disappear from demand
 * reporting by editing a URL, request body, or Cookie header.
 */
export function encodeTrafficCookie(
  trafficClass: TrafficClass,
  secret: string | null
): string {
  if (trafficClass === "public" || !secret) return "public";
  return [
    TOKEN_VERSION,
    trafficClass,
    signature(secret, "traffic-cookie", trafficClass),
  ].join(".");
}

export function decodeTrafficCookie(
  value: string | null | undefined,
  secret: string | null
): TrafficClass {
  if (value === "public") return "public";
  if (!value || !secret) return "public";
  const [version, trafficClass, suppliedSignature, extra] = value.split(".");
  if (
    version !== TOKEN_VERSION ||
    extra !== undefined ||
    !isTrafficClass(trafficClass) ||
    trafficClass === "public" ||
    !suppliedSignature
  ) {
    return "public";
  }
  const expected = signature(secret, "traffic-cookie", trafficClass);
  return signaturesMatch(expected, suppliedSignature)
    ? trafficClass
    : "public";
}

/**
 * Creates the short-lived bearer token used by first-party production probes.
 * The secret never leaves local/server secret storage; the token expires after
 * five minutes and can only assign its embedded class.
 */
export function createProbeTrafficToken(
  trafficClass: Exclude<TrafficClass, "public">,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const payload = `${nowSeconds}:${trafficClass}`;
  return [
    TOKEN_VERSION,
    nowSeconds,
    trafficClass,
    signature(secret, "traffic-probe", payload),
  ].join(".");
}

export function decodeProbeTrafficToken(
  value: string | null | undefined,
  secret: string | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): TrafficClass | null {
  if (!value || !secret) return null;
  const [version, timestampPart, trafficClass, suppliedSignature, extra] =
    value.split(".");
  const timestamp = Number(timestampPart);
  if (
    version !== TOKEN_VERSION ||
    extra !== undefined ||
    !Number.isInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > MAX_PROBE_TOKEN_AGE_SECONDS ||
    !isTrafficClass(trafficClass) ||
    trafficClass === "public" ||
    !suppliedSignature
  ) {
    return null;
  }
  const payload = `${timestamp}:${trafficClass}`;
  const expected = signature(secret, "traffic-probe", payload);
  return signaturesMatch(expected, suppliedSignature) ? trafficClass : null;
}
