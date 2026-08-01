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
  await expect(
    page.getByRole("heading", { name: "A small request you can believe" })
  ).toBeVisible();
  await expect(page.getByText("Permission goes both ways")).toBeVisible();
  await expect(page.getByText("An opinion, not a universal rule")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Privacy policy" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "info@mauriceholdings.llc" }).first()
  ).toHaveAttribute("href", "mailto:info@mauriceholdings.llc");
  await expect(
    page.getByText(/A five-minute invitation becomes easier to accept/)
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  ).toBe(true);
});

test("public copy does not use em dashes", async ({ page, request }) => {
  for (const path of ["/", "/about", "/manifesto"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("—");

    const metadata = await page
      .locator("meta[content]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("content") ?? "")
      );
    expect(metadata.join(" ")).not.toContain("—");
  }

  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).not.toContain("—");
});

test("owned discovery surfaces are crawlable", async ({ page, request }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "A small request you can believe" })).toBeVisible();

  await page.goto("/manifesto");
  await expect(
    page.getByRole("heading", { name: "The Qwickword Manifesto" })
  ).toBeVisible();

  const feed = await request.get("/feed.xml");
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("application/rss+xml");
  const feedText = await feed.text();
  expect(feedText).toContain("https://qwickword.com/about");
  expect(feedText).toContain("https://qwickword.com/manifesto");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("https://qwickword.com/about");
  expect(sitemapText).toContain("https://qwickword.com/manifesto");

  const key = await request.get("/10f8619456c2ea84499dd5e46ca68a4c.txt");
  expect(key.status()).toBe(200);
  expect((await key.text()).trim()).toBe(
    "10f8619456c2ea84499dd5e46ca68a4c"
  );
});

test("share controls fit mobile and desktop viewports", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => undefined,
    });
  });

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("group", { name: "Call length" })
      .getByRole("button")
      .first()
      .click();
    await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copied|Copy link/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Email it" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    ).toBe(true);
  }
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

test("the telemetry endpoint accepts bounded call diagnostics and drops malformed events", async ({ request }) => {
  const now = Date.now();
  const res = await request.post("/api/telemetry", {
    data: {
      events: [
        {
          schemaVersion: 1,
          eventId: "11111111-1111-4111-8111-111111111111",
          room: "some-room",
          clientCallSessionId: "22222222-2222-4222-8222-222222222222",
          sequence: 0,
          eventName: "countdown.sync_applied",
          surface: "web",
          clientWallTimeMs: now,
          clientMonotonicMs: 1234.5,
          serverReceivedAtMs: now - 100,
          serverNowMs: now - 20,
          rttMs: 120,
          serverProcessingMs: 80,
          clockOffsetMs: 0,
          authoritativeExpMs: now + 60_000,
          phase: "live",
          source: "start_response",
          participantCount: 2,
          // Extra input is ignored rather than stored because ingestion maps
          // only its explicit allowlist.
          contactName: "must not be stored",
        },
        {
          schemaVersion: 1,
          eventId: "not-a-uuid",
          room: "some-room",
          clientCallSessionId: "also-not-a-uuid",
          sequence: 1,
          eventName: "anything-goes",
          surface: "web",
          clientWallTimeMs: now,
          clientMonotonicMs: 1,
        },
      ],
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.accepted).toBe(1);
  expect(body.eventsAccepted).toBe(1);
  expect(body.timingsAccepted).toBe(0);
});

test("countdown responses carry a server timing sample", async ({ request }) => {
  const createdResponse = await request.post("/api/rooms", {
    data: { durationSeconds: 60 },
  });
  expect(createdResponse.status()).toBe(200);
  const created = await createdResponse.json();

  const startedResponse = await request.post(
    `/api/rooms/${created.name}/start`,
    { data: { durationSeconds: 60, source: "manual_start" } }
  );
  expect(startedResponse.status()).toBe(200);
  const started = await startedResponse.json();
  expect(started.started).toBe(true);
  expect(typeof started.exp).toBe("number");
  expect(typeof started.serverReceivedAtMs).toBe("number");
  expect(typeof started.serverNowMs).toBe("number");
  expect(started.serverNowMs).toBeGreaterThanOrEqual(
    started.serverReceivedAtMs
  );
});

test("the share-stats endpoint validates its channel", async ({ request }) => {
  for (const via of ["native", "copy", "email"]) {
    const good = await request.post("/api/rooms/some-room/shared", {
      data: { via },
    });
    expect(good.status()).toBe(200);
  }

  for (const bad of [{ via: "carrier-pigeon" }, {}]) {
    const res = await request.post("/api/rooms/some-room/shared", { data: bad });
    expect(res.status()).toBe(400);
  }
});

test("landing attribution is sanitized and stored in first-party cookies", async ({
  request,
}) => {
  const response = await request.post("/api/attribution/landing", {
    data: {
      attribution: {
        source: "linkedin",
        medium: "organic_social",
        campaign: "hard_stop_30d",
        content: "native_share_v1",
      },
      trafficClass: "smoke",
    },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toContain("qw_session=");
  expect(setCookie).toContain("qw_attribution=");
  expect(setCookie).toContain("qw_traffic=smoke");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=lax");
});

test("native share opens the supported share sheet with truthful copy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as typeof window & {
        sharedPayload?: ShareData;
      }
    ).sharedPayload = undefined;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload: ShareData) => {
        (
          window as typeof window & {
            sharedPayload?: ShareData;
          }
        ).sharedPayload = payload;
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("group", { name: "Call length" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const payload = await page.evaluate(
    () =>
      (
        window as typeof window & {
          sharedPayload?: ShareData;
        }
      ).sharedPayload
  );
  expect(payload?.title).toContain("Qwickword");
  expect(payload?.text).toContain("ends when the timer does");
  expect(payload?.url).toMatch(/^http:\/\/127\.0\.0\.1:3100\//);
});

test("the resolve endpoint validates its room name and refuses to guess", async ({
  request,
}) => {
  // Exists for the native app, which receives a bare qwickword.com/<slug> link
  // and has no server-rendered page to read the join details from.
  for (const bad of ["has/slash", "has%20space", ""]) {
    const res = await request.get(
      `/api/rooms/${encodeURIComponent(bad)}/resolve`
    );
    // An empty or slash-bearing name never reaches the handler as a single
    // path segment; either way it must not resolve to a room.
    expect(res.status()).not.toBe(200);
  }

  // Mock mode has no persisted room to resolve, so the route says so rather
  // than fabricating a Daily URL that would fail later at connect time.
  const res = await request.get("/api/rooms/some-room/resolve");
  expect(res.status()).toBe(503);
  const body = await res.json();
  expect(body.error).toContain("mock mode");
  // Whatever it returns, it must never carry credentials.
  expect(JSON.stringify(body)).not.toMatch(/apiKey|api_key|Bearer/i);
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
