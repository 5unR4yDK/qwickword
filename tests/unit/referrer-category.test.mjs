import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyReferrer,
  isReferrerCategory,
} from "../../src/lib/referrer-category.ts";

const ORIGIN = "https://qwickword.com";

test("referrers are reduced to privacy-limited categories", () => {
  assert.equal(classifyReferrer("", ORIGIN), "direct");
  assert.equal(classifyReferrer("https://qwickword.com/about", ORIGIN), "internal");
  assert.equal(
    classifyReferrer("https://www.google.com/search?q=private+terms", ORIGIN),
    "search"
  );
  assert.equal(
    classifyReferrer("https://m.instagram.com/qwickword", ORIGIN),
    "social"
  );
  assert.equal(classifyReferrer("https://example.org/private/path", ORIGIN), "other");
  assert.equal(classifyReferrer("not a URL", ORIGIN), "other");
});

test("only declared referrer categories pass validation", () => {
  for (const category of ["direct", "internal", "search", "social", "other"]) {
    assert.equal(isReferrerCategory(category), true);
  }
  assert.equal(isReferrerCategory("https://www.google.com/search?q=private"), false);
  assert.equal(isReferrerCategory(null), false);
});
