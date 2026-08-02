// Pure identity rules: normalising an address, hashing it, generating and
// checking a code, and deciding whether a request is too frequent.
//
// No database, no network, no mail provider. These are the parts where a subtle
// mistake is invisible in testing and expensive later — two spellings of one
// address producing different hashes means one person quietly ends up with two
// accounts and cannot reach their own rooms.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  CHALLENGE_TTL_MS,
  MAX_ATTEMPTS,
  MAX_PER_HOUR,
  RESEND_COOLDOWN_MS,
  SESSION_TTL_MS,
  codeMatches,
  defaultDisplayName,
  generateCode,
  generateSessionToken,
  hashCode,
  hashSessionToken,
  lookupHash,
  maskEmail,
  normalizeEmail,
  rateDecision,
  usesBrowserCookieTransport,
} from "../../src/lib/identity-core.ts";

const SECRET = "test-secret-not-the-real-one";

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

test("case and surrounding whitespace never make a second account", () => {
  const forms = ["Alex@Example.com", "  alex@example.com  ", "ALEX@EXAMPLE.COM"];
  const hashes = forms.map((f) => lookupHash("email", normalizeEmail(f), SECRET));
  assert.equal(new Set(hashes).size, 1, "all three must resolve to one identity");
});

test("dots and plus tags are deliberately NOT normalised away", () => {
  // Google treats a.b@gmail and ab@gmail as one mailbox; almost every other
  // provider treats them as two. Merging them would join two strangers'
  // accounts, which is far worse than someone having to remember which they
  // used. Same for plus tags, which people use deliberately to keep things
  // apart.
  const dotted = normalizeEmail("a.b@example.com");
  const undotted = normalizeEmail("ab@example.com");
  assert.notEqual(dotted, undotted);
  assert.notEqual(
    lookupHash("email", dotted, SECRET),
    lookupHash("email", undotted, SECRET)
  );

  const tagged = normalizeEmail("alex+qwickword@example.com");
  assert.equal(tagged, "alex+qwickword@example.com");
  assert.notEqual(
    lookupHash("email", tagged, SECRET),
    lookupHash("email", normalizeEmail("alex@example.com"), SECRET)
  );
});

test("obvious non-addresses are refused, real ones are not", () => {
  for (const bad of ["", "   ", "alex", "alex@", "@example.com", "a b@c.com", "alex@example", "a@b"]) {
    assert.equal(normalizeEmail(bad), null, JSON.stringify(bad));
  }
  for (const good of [
    "alex@example.com",
    "alex.smith@sub.example.co.uk",
    "alex+tag@example.com",
    "a_b-c@example.io",
  ]) {
    assert.equal(normalizeEmail(good), good.toLowerCase(), good);
  }
});

test("an absurdly long address is refused rather than stored", () => {
  assert.equal(normalizeEmail("a".repeat(250) + "@example.com"), null);
});

// ---------------------------------------------------------------------------
// Lookup hashing
// ---------------------------------------------------------------------------

test("the lookup hash is keyed, so the table alone reveals nothing", () => {
  const withOne = lookupHash("email", "alex@example.com", "secret-one");
  const withTwo = lookupHash("email", "alex@example.com", "secret-two");
  assert.notEqual(withOne, withTwo, "a different key must give a different hash");

  // Not a plain SHA-256 of the address, which anyone holding the table could
  // reproduce from a list of email addresses — that is the whole point of
  // keying it.
  const unkeyed = createHash("sha256").update("email:alex@example.com").digest("hex");
  assert.notEqual(withOne, unkeyed);

  // Same input, same key, same answer — or nobody could ever sign in twice.
  assert.equal(withOne, lookupHash("email", "alex@example.com", "secret-one"));
});

test("hashing refuses to run without a key rather than using a blank one", () => {
  // Silently keying with "" would produce hashes anyone could reproduce.
  assert.throws(() => lookupHash("email", "alex@example.com", ""), /IDENTITY_HMAC_SECRET/);
});

test("the same address under different kinds is a different identity", () => {
  assert.notEqual(
    lookupHash("email", "+15551234567", SECRET),
    lookupHash("phone", "+15551234567", SECRET)
  );
});

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

test("codes are six digits, and the leading zero is kept", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateCode();
    assert.match(code, /^\d{6}$/, code);
  }
});

test("codes are spread across the whole range, not clustered", () => {
  // A modulo-biased generator would skew low. Ten buckets over 2000 draws
  // should each land somewhere near 200; this only catches gross bias, which
  // is the failure worth catching.
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 2000; i++) {
    buckets[Math.floor(Number(generateCode()) / 100_000)]++;
  }
  for (const [i, count] of buckets.entries()) {
    assert.ok(count > 80 && count < 360, `bucket ${i} had ${count}`);
  }
});

test("a code hash is salted by its challenge, so two live codes never collide", () => {
  const a = hashCode("123456", "challenge-a");
  const b = hashCode("123456", "challenge-b");
  assert.notEqual(a, b);
});

test("only the right code against the right challenge verifies", () => {
  const id = "challenge-a";
  const stored = hashCode("123456", id);
  assert.equal(codeMatches("123456", id, stored), true);
  assert.equal(codeMatches("123457", id, stored), false);
  assert.equal(codeMatches("123456", "challenge-b", stored), false);
  assert.equal(codeMatches("", id, stored), false);
  assert.equal(codeMatches("123456", id, ""), false);
  assert.equal(codeMatches("123456", id, "not-hex-at-all"), false);
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

test("session tokens are long, unique, and stored only as a hash", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const token = generateSessionToken();
    assert.ok(token.length >= 43, token);
    assert.equal(seen.has(token), false, "tokens must not repeat");
    seen.add(token);
    // The hash must not be the token: storing the token itself would mean a
    // database leak signs everyone in.
    assert.notEqual(hashSessionToken(token), token);
  }
});

test("server sessions and browser cookies share the 30-day lifetime", () => {
  assert.equal(SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
});

test("browser verification never exposes the bearer-token transport", () => {
  const requestOrigin = "https://qwickword.com";
  assert.equal(
    usesBrowserCookieTransport({
      secFetchSite: "same-origin",
      origin: requestOrigin,
      requestOrigin,
    }),
    true
  );
  assert.equal(
    usesBrowserCookieTransport({
      secFetchSite: null,
      origin: requestOrigin,
      requestOrigin,
    }),
    true
  );
});

test("a native client without browser fetch headers receives its Keychain token", () => {
  assert.equal(
    usesBrowserCookieTransport({
      secFetchSite: null,
      origin: null,
      requestOrigin: "https://qwickword.com",
    }),
    false
  );
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test("a first request is allowed", () => {
  assert.deepEqual(rateDecision([], Date.now()), { allowed: true });
});

test("a second request too soon is held back, with how long to wait", () => {
  const now = Date.now();
  const decision = rateDecision([now - 5_000], now);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, "cooldown");
  assert.ok(
    decision.allowed === false &&
      decision.retryAfterMs > 0 &&
      decision.retryAfterMs <= RESEND_COOLDOWN_MS
  );
});

test("once the cooldown passes, another code may be sent", () => {
  const now = Date.now();
  assert.equal(rateDecision([now - RESEND_COOLDOWN_MS - 1], now).allowed, true);
});

test("an hourly cap stops this being a way to mail a stranger repeatedly", () => {
  const now = Date.now();
  // Spaced past the cooldown so only the hourly limit can be what bites.
  const timestamps = Array.from(
    { length: MAX_PER_HOUR },
    (_, i) => now - (i + 1) * 60_000
  );
  const decision = rateDecision(timestamps, now);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, "hourly");
});

test("requests older than an hour do not count against the cap", () => {
  const now = Date.now();
  const old = Array.from({ length: MAX_PER_HOUR }, () => now - 2 * 60 * 60_000);
  assert.equal(rateDecision(old, now).allowed, true);
});

test("the limits are the ones the routes describe", () => {
  assert.equal(CHALLENGE_TTL_MS, 10 * 60 * 1000);
  assert.equal(MAX_ATTEMPTS, 5);
  assert.equal(RESEND_COOLDOWN_MS, 30 * 1000);
});

// ---------------------------------------------------------------------------
// What gets shown
// ---------------------------------------------------------------------------

test("a default display name never reveals the domain", () => {
  // "alex@acme-corp.com" becoming "alex@acme-corp.com" on a call screen would
  // put someone's employer in front of a stranger.
  const name = defaultDisplayName("email", "alex.smith@acme-corp.com");
  assert.equal(name, "alex smith");
  assert.ok(!name.includes("@"));
  assert.ok(!name.includes("acme"));
});

test("a phone number is never used as a display name", () => {
  assert.equal(defaultDisplayName("phone", "+15551234567"), "Someone");
});

test("a masked address is recognisable but not readable", () => {
  const masked = maskEmail("alexsmith@example.com");
  assert.ok(masked.startsWith("a"));
  assert.ok(masked.endsWith("@example.com"));
  assert.ok(!masked.includes("lexsmith"));
});
