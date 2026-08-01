// The owner key: what separates "join a call here" from "close this room".
//
// A room has two capabilities and therefore two credentials. The slug is
// public — it goes in an email signature. The owner key is not, and grants
// rename, re-length and close. Neither is an account; both are bearer
// credentials, which is the same trust model calls already use.
//
// Everything above `verifyOwnerKey` is pure and testable without a database.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getRoomOwnerKeyHash } from "./db";

/**
 * 32 bytes from the system CSPRNG, base64url so it survives a URL fragment
 * without escaping. 256 bits is not a number anyone guesses.
 */
export function generateOwnerKey(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Plain SHA-256, deliberately — no salt, no bcrypt, no argon2.
 *
 * Those exist to slow down guessing a human-chosen password. The input here is
 * 32 bytes of CSPRNG output: there is no dictionary, no reuse across sites and
 * nothing to stretch. Adding a work factor would only put latency on every
 * management request while buying nothing.
 */
export function hashOwnerKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Compares in constant time.
 *
 * The comparison is of hashes rather than keys, so a timing leak would only
 * reveal a hash prefix — but `===` on secrets is the kind of thing that is
 * correct until the code around it changes, and this costs nothing.
 */
export function ownerKeyMatches(key: string, storedHash: string): boolean {
  // An empty stored hash marks a room nobody holds a key for. It must match
  // nothing, including an empty key.
  if (!storedHash || !key) return false;
  const provided = Buffer.from(hashOwnerKey(key), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** The header the key travels in. Never a query param — see the spec. */
export const OWNER_KEY_HEADER = "x-qwickword-owner-key";

/**
 * Whether the caller holds the owner key for this room.
 *
 * Returns false for a room that does not exist, so a caller cannot use this to
 * discover which slugs are real.
 */
export async function verifyOwnerKey(
  slug: string,
  key: string | null
): Promise<boolean> {
  if (!key) return false;
  // Fails closed throughout: a missing room, an empty stored hash and an
  // unreachable database all return null here, and null grants nothing.
  const stored = await getRoomOwnerKeyHash(slug);
  return stored ? ownerKeyMatches(key, stored) : false;
}
