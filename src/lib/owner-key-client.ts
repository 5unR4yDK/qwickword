// Browser-side handling of a room's owner key.
//
// The key arrives in the URL **fragment** — `/r/swift-hawk#k=…` — and never a
// query string. A `#` is not transmitted to the server, so it cannot reach
// server logs, `Referer` headers on outbound links, or any analytics that
// records paths. A query parameter would land in all three.
//
// On arrival the key is moved into localStorage and stripped from the address
// bar. That second step is the point of the whole design: the failure being
// prevented is someone copying the URL out of their address bar to share the
// room and handing over the ability to close it.
//
// Client-only. Nothing here may be imported by a Server Component.
const PREFIX = "qwickword.roomkey.";

function storageKey(slug: string): string {
  return `${PREFIX}${slug}`;
}

function read(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug));
  } catch {
    // Private browsing, or storage disabled entirely. Management simply is not
    // available, which is the safe direction to fail in.
    return null;
  }
}

function write(slug: string, key: string): void {
  try {
    window.localStorage.setItem(storageKey(slug), key);
  } catch {
    /* see read() */
  }
}

export function forgetOwnerKey(slug: string): void {
  try {
    window.localStorage.removeItem(storageKey(slug));
  } catch {
    /* already gone is the desired state */
  }
}

/** Rejects anything that is not shaped like a key we issued. */
function looksLikeKey(value: string): boolean {
  // 32 bytes, base64url: 43 characters, no padding.
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * Claims a key from the fragment if one is present, stores it, and removes it
 * from the address bar. Returns whatever key is now held for this room.
 *
 * Safe to call on every render of the room page: with no fragment it simply
 * reads what is already stored.
 */
export function claimOwnerKey(slug: string): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  const match = /^#k=([A-Za-z0-9_-]+)$/.exec(hash);

  if (match && looksLikeKey(match[1])) {
    write(slug, match[1]);
    // Replace rather than push, so Back does not walk into a history entry
    // that still contains the key.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
    return match[1];
  }

  // A fragment that is present but malformed is still worth clearing: it is
  // either a truncated paste or noise, and leaving it in the bar invites the
  // copy-and-share mistake this exists to prevent.
  if (hash.startsWith("#k=")) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }

  return read(slug);
}

/** The header the key travels in on management requests. */
export const OWNER_KEY_HEADER = "x-qwickword-owner-key";

export function ownerLink(slug: string, key: string): string {
  return `https://qwickword.com/r/${slug}#k=${key}`;
}
