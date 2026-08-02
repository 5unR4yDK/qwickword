import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLE_APP_SITE_ASSOCIATION,
  GET,
} from "../../src/app/.well-known/apple-app-site-association/route.ts";

const APP_ID = "UL24D2Q894.llc.mauriceholdings.qwickword";

test("the Apple association is extensionless JSON for the signed iPhone app", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await response.json(), APPLE_APP_SITE_ASSOCIATION);
  assert.equal(APPLE_APP_SITE_ASSOCIATION.applinks.details[0].appIDs[0], APP_ID);
  assert.equal(APPLE_APP_SITE_ASSOCIATION.applinks.details[1].appID, APP_ID);
});

test("app links include calls and rooms but exclude browser-only surfaces first", () => {
  const components = APPLE_APP_SITE_ASSOCIATION.applinks.details[0].components;
  const includeCall = components.findIndex(
    (entry) => entry["/"] === "/*" && !("exclude" in entry)
  );
  const includeRoom = components.findIndex(
    (entry) => entry["/"] === "/r/*" && !("exclude" in entry)
  );

  assert.ok(includeCall > -1);
  assert.ok(includeRoom > -1);
  for (const path of ["/", "/r", "/about", "/manifesto", "/api/*", "/_next/*"]) {
    const excluded = components.findIndex(
      (entry) => entry["/"] === path && "exclude" in entry && entry.exclude
    );
    assert.ok(excluded > -1, `${path} must stay in the browser`);
    assert.ok(excluded < includeCall, `${path} must be excluded before the call wildcard`);
  }
});
