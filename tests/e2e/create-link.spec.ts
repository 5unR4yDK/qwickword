import { test, expect } from "@playwright/test";

// The create-a-link flow, which is the whole product on the way in. Runs in
// mock mode (see playwright.config.ts), so no Daily room is provisioned and
// nothing is written to `calls`.

test("home page offers the duration picker", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("This meeting could've been a Qwickword")).toBeVisible();
  await expect(page.getByText("How long is your Qwickword?")).toBeVisible();

  const picker = page.getByRole("group", { name: "Call length" });
  await expect(picker).toBeVisible();
  // Presets plus the custom-duration pill.
  expect(await picker.getByRole("button").count()).toBeGreaterThan(1);
});

test("picking a duration produces a shareable link", async ({ page }) => {
  await page.goto("/");

  const picker = page.getByRole("group", { name: "Call length" });
  await picker.getByRole("button").first().click();

  await expect(page.getByText("Share this link")).toBeVisible();
  // The link is rendered as text, not an input, so assert on the copy control
  // and the visible URL rather than a value.
  await expect(page.getByText(/qwickword\.com\/|127\.0\.0\.1:3100\//)).toBeVisible();
});

test("the custom field reverts to a pill on an outside click", async ({ page }) => {
  await page.goto("/");

  const picker = page.getByRole("group", { name: "Call length" });
  await picker.getByRole("button", { name: "custom" }).click();
  await expect(page.getByLabel("Custom call length in minutes")).toBeVisible();

  // Clicking inside the field must not dismiss it.
  await page.getByLabel("Custom call length in minutes").click();
  await expect(page.getByLabel("Custom call length in minutes")).toBeVisible();

  // Clicking anywhere else must.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(page.getByLabel("Custom call length in minutes")).toBeHidden();
  await expect(picker.getByRole("button", { name: "custom" })).toBeVisible();
});

test("mock mode is surfaced, not hidden", async ({ page }) => {
  // Guards the fallback path itself: if credentials go missing in a real
  // deploy the app must say so rather than appear to work.
  await page.goto("/");
  await expect(page.getByText(/Mock mode/)).toBeVisible();
});

test("an unknown room shows the invalid-link screen, not a crash", async ({ page }) => {
  const res = await page.goto("/this-room-does-not-exist-12345");
  expect(res?.status()).toBeLessThan(500);
  await expect(page.locator("body")).not.toContainText("Application error");
});

test("about page renders", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("the telemetry endpoint accepts good timings and drops bad ones", async ({ request }) => {
  const res = await request.post("/api/telemetry", {
    data: {
      timings: [
        { callName: "some-room", metric: "join_to_audio", ms: 1200, surface: "ios" },
        { callName: "some-room", metric: "not_a_metric", ms: 5, surface: "ios" },
        { callName: "some-room", metric: "reconnect", ms: -1, surface: "ios" },
        { callName: "", metric: "reconnect", ms: 10, surface: "ios" },
      ],
    },
  });
  expect(res.status()).toBe(200);
  // Only the first is valid; the rest are dropped without an error, because a
  // client retrying telemetry on a bad network worsens what it is measuring.
  expect((await res.json()).accepted).toBe(1);

  const junk = await request.post("/api/telemetry", { data: { nonsense: true } });
  expect(junk.status()).toBe(200);
  expect((await junk.json()).accepted).toBe(0);
});

test("the share-stats endpoint validates its channel", async ({ request }) => {
  const good = await request.post("/api/rooms/some-room/shared", {
    data: { via: "copy" },
  });
  expect(good.status()).toBe(200);

  for (const bad of [{ via: "carrier-pigeon" }, {}]) {
    const res = await request.post("/api/rooms/some-room/shared", { data: bad });
    expect(res.status()).toBe(400);
  }
});

test("the end-stats endpoint validates its reason", async ({ request }) => {
  // DATABASE_URL is blank here, so the write no-ops — this pins the route's
  // contract, not the database behaviour.
  const good = await request.post("/api/rooms/some-room/end", {
    data: { reason: "completed" },
  });
  expect(good.status()).toBe(200);

  for (const bad of [{ reason: "nonsense" }, {}]) {
    const res = await request.post("/api/rooms/some-room/end", { data: bad });
    expect(res.status()).toBe(400);
  }
});
