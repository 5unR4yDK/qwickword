import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProbeTrafficToken,
  decodeProbeTrafficToken,
  decodeTrafficCookie,
  encodeTrafficCookie,
} from "../../src/lib/traffic-classification.ts";

const SECRET = "test-secret-not-the-real-one";

test("non-public traffic cookies require a server signature", () => {
  assert.equal(decodeTrafficCookie("smoke", SECRET), "public");
  assert.equal(decodeTrafficCookie("v1.smoke.not-a-signature", SECRET), "public");
  const signed = encodeTrafficCookie("smoke", SECRET);
  assert.equal(decodeTrafficCookie(signed, SECRET), "smoke");
  assert.equal(decodeTrafficCookie(signed, "different-secret"), "public");
});

test("probe tokens are scoped and expire after five minutes", () => {
  const issuedAt = 2_000_000_000;
  const token = createProbeTrafficToken("contract", SECRET, issuedAt);
  assert.equal(decodeProbeTrafficToken(token, SECRET, issuedAt + 300), "contract");
  assert.equal(decodeProbeTrafficToken(token, SECRET, issuedAt + 301), null);
  assert.equal(decodeProbeTrafficToken(token, "different-secret", issuedAt), null);
});

test("public traffic remains public without a configured secret", () => {
  assert.equal(encodeTrafficCookie("smoke", null), "public");
  assert.equal(decodeTrafficCookie("smoke", null), "public");
  assert.equal(decodeProbeTrafficToken("anything", null), null);
});
