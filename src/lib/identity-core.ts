// The parts of identity that are pure: normalising an address, hashing it for
// lookup, generating and checking a code, deciding whether a request is too
// frequent.
//
// Separated from anything that touches the database or a mail provider so it
// can be tested exhaustively without either. The rules here are the ones that
// are easy to get subtly wrong and hard to notice: two spellings of the same
// address must produce the same hash, or one person ends up with two accounts.
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

/** How long a code is worth trying. Long enough to switch apps and back. */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;

/** Browser cookies and server-side sessions expire together. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Wrong guesses before the challenge is dead. */
export const MAX_ATTEMPTS = 5;

/** Minimum gap between codes for one address, so this is not a mail cannon. */
export const RESEND_COOLDOWN_MS = 30 * 1000;

/** Most codes one address may request in an hour, however patient the caller. */
export const MAX_PER_HOUR = 5;

export type IdentityKind = "email" | "phone";

/**
 * Whether a verification request is the first-party browser flow.
 *
 * Browser JavaScript must never receive the bearer token that is also placed
 * in its HttpOnly cookie. `Sec-Fetch-Site` is controlled by the browser, while
 * the Origin comparison covers older clients. Native HTTP clients use neither
 * browser signal and receive the token for Keychain storage.
 */
export function usesBrowserCookieTransport(input: {
  secFetchSite: string | null;
  origin: string | null;
  requestOrigin: string;
}): boolean {
  if (input.secFetchSite?.toLowerCase() === "same-origin") return true;
  if (!input.origin) return false;
  try {
    return new URL(input.origin).origin === new URL(input.requestOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * Canonical form of an email address.
 *
 * Lowercased and trimmed, and nothing else. Deliberately no dot-stripping or
 * plus-tag removal: `a.b@gmail.com` and `ab@gmail.com` are the same mailbox at
 * one provider and different mailboxes at most others, so normalising them
 * together would merge two people's accounts. Treating `user+qwickword@` as
 * distinct is also what lets someone deliberately keep them apart.
 */
export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.length < 3 || value.length > 254) return null;
  // Deliberately permissive. A regex cannot decide whether an address is real —
  // only delivery can — so this rejects what is obviously not an address and
  // lets the code being received be the actual proof.
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

/**
 * A stable, non-reversible handle for an address.
 *
 * Keyed rather than a plain digest: an unkeyed hash of an email address is
 * trivially reversible by anyone with a list of addresses, which is everyone.
 * The key never leaves the server, so a leak of the table alone reveals nothing.
 */
export function lookupHash(kind: IdentityKind, value: string, secret: string): string {
  if (!secret) throw new Error("IDENTITY_HMAC_SECRET is not configured.");
  return createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
}

/**
 * Six digits, uniformly distributed.
 *
 * `randomInt`-style rejection rather than `% 1000000`, which would make low
 * codes slightly likelier. Six digits with five attempts and a ten-minute
 * window is a 1-in-200,000 chance of a blind guess landing.
 */
export function generateCode(): string {
  while (true) {
    // 2^20 = 1,048,576; reject the tail so the remainder is unbiased.
    const n = randomBytes(3).readUIntBE(0, 3) & 0xfffff;
    if (n < 1_000_000) return String(n).padStart(6, "0");
  }
}

export function hashCode(code: string, challengeId: string): string {
  // Salted with the challenge id so the same code in two live challenges does
  // not produce the same hash.
  return createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

export function codeMatches(
  code: string,
  challengeId: string,
  storedHash: string
): boolean {
  if (!code || !storedHash) return false;
  const provided = Buffer.from(hashCode(code, challengeId), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** 32 bytes. The session token itself; only its hash reaches the database. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newId(): string {
  return randomUUID();
}

export type RateDecision =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "hourly"; retryAfterMs: number };

/**
 * Whether another code may be sent for this address right now.
 *
 * Two limits with different jobs: the cooldown stops a stuck button becoming a
 * stream of mail, and the hourly cap stops someone using the send endpoint to
 * post messages into a stranger's inbox.
 */
export function rateDecision(
  recentTimestamps: number[],
  now: number
): RateDecision {
  const lastSent = recentTimestamps.length ? Math.max(...recentTimestamps) : null;
  if (lastSent !== null && now - lastSent < RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterMs: RESEND_COOLDOWN_MS - (now - lastSent),
    };
  }
  const withinHour = recentTimestamps.filter((t) => now - t < 60 * 60 * 1000);
  if (withinHour.length >= MAX_PER_HOUR) {
    const oldest = Math.min(...withinHour);
    return {
      allowed: false,
      reason: "hourly",
      retryAfterMs: 60 * 60 * 1000 - (now - oldest),
    };
  }
  return { allowed: true };
}

/**
 * A display name derived from an address, for someone who has not chosen one.
 *
 * The local part only, so a name never reveals the domain — "alex" rather than
 * "alex@somecompany.com", which would leak an employer to anyone they call.
 */
export function defaultDisplayName(kind: IdentityKind, value: string): string {
  if (kind === "email") {
    const local = value.split("@")[0] ?? "";
    const cleaned = local.replace(/[._-]+/g, " ").trim();
    if (!cleaned) return "Someone";
    return cleaned.slice(0, 40);
  }
  // A phone number is never a display name. Showing one would put a personal
  // number on someone else's screen.
  return "Someone";
}

/** `a•••@example.com` — enough to recognise, not enough to read out. */
export function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "•••";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}
