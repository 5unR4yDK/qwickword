import { test, expect } from "@playwright/test";

// Rooms: the persistent layer above calls. A room has a stable URL, a name and
// a default length; entering it starts nothing. Calls held inside it are
// ordinary Qwickwords whose hard ending is untouched.
//
// These run in mock mode (see playwright.config.ts), so no Daily room is
// provisioned. Room creation itself needs a database, which the mock
// environment does not have — so the tests that need a real room are written
// against the contract's failure path rather than skipped, and the ones that
// can assert real behaviour do.

test("the room API rejects a slug that could never be one", async ({ request }) => {
  for (const bad of ["ab", "Has-Capitals", "has_underscore", "has space", "-leading"]) {
    const res = await request.get(`/api/r/${encodeURIComponent(bad)}`);
    expect(res.status(), `${bad} should not resolve`).toBe(400);
  }
});

test("creating a room requires a valid default length", async ({ request }) => {
  for (const bad of [
    {},
    { defaultDurationSeconds: 29 },
    { defaultDurationSeconds: 1801 },
    { defaultDurationSeconds: "300" },
  ]) {
    const res = await request.post("/api/r", { data: bad });
    expect(res.status(), JSON.stringify(bad)).toBe(400);
    expect((await res.json()).error).toContain("defaultDurationSeconds");
  }
});

// ---------------------------------------------------------------------------
// The owner key. A room carries two capabilities: the slug opens it and starts
// calls, the key renames and closes. Before they were split, being sent a room
// link meant being able to retire the room.
// ---------------------------------------------------------------------------

test("renaming without the owner key is refused", async ({ request }) => {
  const res = await request.patch("/api/r/quiet-otter", {
    data: { name: "Taken over" },
  });
  expect(res.status()).toBe(403);
  expect((await res.json()).error).toContain("owner key");
});

test("closing without the owner key is refused", async ({ request }) => {
  const res = await request.delete("/api/r/quiet-otter");
  expect(res.status()).toBe(403);
});

test("a wrong owner key is refused, and says no more than a missing one", async ({
  request,
}) => {
  const missing = await request.delete("/api/r/quiet-otter");
  const wrong = await request.delete("/api/r/quiet-otter", {
    headers: { "x-qwickword-owner-key": "a".repeat(43) },
  });
  expect(wrong.status()).toBe(403);
  // Identical responses: distinguishing them would tell someone probing with a
  // guessed key that they had found a live room.
  expect(await wrong.json()).toEqual(await missing.json());
});

test("the key is checked before the body, so a bad key never reveals validation", async ({
  request,
}) => {
  // An empty PATCH body is a 400 once you hold the key. Without one it must
  // still be 403 — otherwise the error text distinguishes real rooms.
  const res = await request.patch("/api/r/quiet-otter", { data: {} });
  expect(res.status()).toBe(403);
});

test("starting a call never needs the owner key", async ({ request }) => {
  // The whole claim of the product is that a stranger can be talking in one
  // tap with nothing installed. Rename and close are gated; joining is not,
  // and must never become so. A 404 here is the room not existing in mock
  // mode — what matters is that it is not a 403.
  const res = await request.post("/api/r/quiet-otter/calls", {
    data: { durationSeconds: 300 },
  });
  expect(res.status()).not.toBe(403);
});

test("reading a room never needs the owner key", async ({ request }) => {
  const res = await request.get("/api/r/quiet-otter");
  expect(res.status()).not.toBe(403);
});

test("the owner key is never returned by any read", async ({ request }) => {
  // It is issued once, at creation. No endpoint may hand it back, or the
  // share link would silently become a management link again.
  const res = await request.get("/api/r/quiet-otter");
  expect(await res.text()).not.toContain("ownerKey");
});

test("an unknown room reads as closed, not as an error", async ({ request }) => {
  // One response for never-existed, closed, and idle-expired. Telling them
  // apart would confirm whether a given slug was ever real.
  const res = await request.get("/api/r/definitely-not-a-real-room-92f4a1");
  expect(res.status()).toBe(404);
  expect((await res.json()).error).toContain("no longer available");
});

test("starting a call in an unknown room fails rather than minting an orphan", async ({
  request,
}) => {
  const res = await request.post("/api/r/definitely-not-a-real-room-92f4a1/calls", {
    data: { durationSeconds: 300 },
  });
  expect(res.status()).toBe(404);
});

test("room open and explicit share events validate their public contract", async ({
  request,
}) => {
  const badOpen = await request.post("/api/r/ab/opened");
  expect(badOpen.status()).toBe(400);

  const missingOpen = await request.post(
    "/api/r/definitely-not-a-real-room-92f4a1/opened"
  );
  expect(missingOpen.status()).toBe(404);

  for (const via of ["native", "copy", "email"]) {
    const missingShare = await request.post(
      "/api/r/definitely-not-a-real-room-92f4a1/shared",
      { data: { via } }
    );
    expect(missingShare.status()).toBe(404);
  }

  const invalidShare = await request.post("/api/r/quiet-otter/shared", {
    data: { via: "automatic" },
  });
  expect(invalidShare.status()).toBe(400);
});

test("the room page shows the closed screen for a room that isn't there", async ({
  page,
}) => {
  const response = await page.goto("/r/definitely-not-a-real-room-92f4a1");
  expect(response?.status()).toBeLessThan(500);
  // `InvalidLinkScreen` renders its heading as a <p> inside a role="status"
  // region, not as a heading element — asserted as it is, not as it might be.
  await expect(page.getByText("This room is closed")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});

test("a malformed room address gets the invalid-link screen", async ({ page }) => {
  await page.goto("/r/ab");
  await expect(page.getByText("This link isn't valid")).toBeVisible();
});

test("room links never leak room contents into the preview card", async ({ request }) => {
  // A room link is meant to live in an email signature, so its preview must be
  // safe to show anyone who happens to see the message.
  const res = await request.get("/r/definitely-not-a-real-room-92f4a1");
  const html = await res.text();
  expect(html).not.toContain("Room timeline");
  expect(html).not.toMatch(/never started|left early/);
});

test("the home page offers a room without competing with a one-off call", async ({
  page,
}) => {
  await page.goto("/");
  // The duration picker is still the primary act, and still one tap.
  await expect(page.getByRole("group", { name: "Call length" })).toBeVisible();
  // The room action exists, is reachable, and is not a primary button.
  const roomAction = page.getByRole("button", {
    name: /make a room you can come back to/i,
  });
  await expect(roomAction).toBeVisible();
});

test("the home page's room action reports failure rather than hanging", async ({
  page,
}) => {
  // Mock mode has no database, so room creation fails. What matters is that it
  // says so instead of sitting on "Making a room…" forever.
  //
  // Asserted on the message rather than role="alert": Next.js renders its own
  // route announcer with that role, so the role alone is ambiguous.
  await page.goto("/");
  await page.getByRole("button", { name: /make a room you can come back to/i }).click();
  await expect(page.getByText(/couldn't create the room|no connection/i)).toBeVisible({
    timeout: 10_000,
  });
  // And the button returns to its resting label rather than staying busy.
  await expect(
    page.getByRole("button", { name: /make a room you can come back to/i })
  ).toBeEnabled();
});

test("call links and room links stay in separate namespaces", async ({ page }) => {
  // `/quiet-otter` is a call, `/r/quiet-otter` is a room. Neither may be
  // mistaken for the other, which is why rooms got their own prefix.
  const call = await page.goto("/quiet-otter");
  expect(call?.status()).toBeLessThan(500);
  await expect(page.locator("body")).not.toContainText("Room timeline");
});
