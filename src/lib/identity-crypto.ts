// Reversible encryption for the one thing that has to be reversible: the
// address itself.
//
// `lookup_hash` is one-way and does the finding. This is the other half — the
// copy that lets someone be shown their own masked address, and lets a code be
// delivered to them. Nothing else may read it.
//
// AES-256-GCM, so the ciphertext is authenticated: a tampered value fails to
// decrypt rather than returning something plausible. The key is derived from
// the same secret as the HMAC via HKDF, with a different info string, so one
// configured value backs both without either being usable as the other.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const IV_BYTES = 12; // GCM's standard nonce length
const KEY_BYTES = 32;

function key(): Buffer {
  const secret = process.env.IDENTITY_HMAC_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "IDENTITY_HMAC_SECRET is not configured. Identity storage cannot work without it."
    );
  }
  // Salt is empty and the info string is what separates this key from the HMAC
  // use of the same secret. Deriving rather than reusing means neither key can
  // be substituted for the other if one ever leaks.
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), "qwickword:identity:aes", KEY_BYTES)
  );
}

/** `v1.<iv>.<tag>.<ciphertext>`, all base64url. Versioned so it can change. */
export function encryptValue(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Returns null rather than throwing on anything malformed or tampered with.
 *
 * A caller that cannot decrypt an address should degrade — show a masked
 * placeholder, skip the send — not crash a request. The failure is logged
 * where it can be found.
 */
export function decryptValue(encoded: string): string | null {
  try {
    const [version, ivPart, tagPart, dataPart] = encoded.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !dataPart) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    console.error("[Qwickword] Failed to decrypt a stored identity value:", err);
    return null;
  }
}
