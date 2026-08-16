import { test, expect } from "@playwright/test";

// Browser sign-in. An address, then a six-digit code — the same two steps as
// the app, against the same routes, and the session lands in an HttpOnly
// cookie the page's own scripts can never read.
//
// These run in mock mode (see playwright.config.ts), which has no database, so
// the flow itself is driven against intercepted routes. That is the right level
// for these: the server side of sign-in is covered by the unit tests over
// identity-core, and what is unproven here is the client — that the dialog
// reaches the second step, that six digits submit themselves, that a rejected
// code does not leave someone looking signed in.
//
// The one thing asserted against the real server is that being signed out is
// not an error, because that is the state almost every visitor is in.

test("not being signed in is a normal answer, not a 401", async ({ request }) => {
  const res = await request.get("/api/me");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ user: null });
});

test("routes that need an account refuse a guest without leaking detail", async ({
  request,
}) => {
  for (const [method, path] of [
    ["POST", "/api/calls/quiet-otter/participants"],
    ["GET", "/api/calls/quiet-otter/participants"],
    ["GET", "/api/contacts"],
    ["DELETE", "/api/account"],
  ] as const) {
    const res = await request.fetch(path, { method });
    expect(res.status(), `${method} ${path}`).toBe(401);
    // One wording everywhere. Nothing about whether the call or person exists.
    expect((await res.json()).error).toBe("Sign in to do that.");
  }
});

test("signing in is offered but never in the way", async ({ page }) => {
  await page.goto("/");

  // The primary action is still the only prominent one.
  const signIn = page.getByRole("button", { name: "Sign in" });
  await expect(signIn).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await signIn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Shift+Tab from the first control wraps to the last control, and Tab wraps
  // back again instead of escaping to the page behind the modal.
  await expect(page.getByPlaceholder("you@work.com")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Not now" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByPlaceholder("you@work.com")).toBeFocused();

  // A dialog with no keyboard way out is a trap.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(signIn).toBeFocused();
});

test("an address then a code signs you in, and the footer says who you are", async ({
  page,
}) => {
  let verifyBody: unknown = null;

  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: null } })
  );
  await page.route("**/api/auth/challenges", (route) =>
    route.fulfill({ json: { challengeId: "ch_test", sentTo: "a***@example.com" } })
  );
  await page.route("**/api/auth/challenges/*/verify", (route) => {
    verifyBody = route.request().postDataJSON();
    return route.fulfill({
      json: { token: "tok_test", user: { id: "u_1", displayName: "ada" }, isNew: true },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByPlaceholder("you@work.com").fill("ada@example.com");
  await page.getByRole("button", { name: "Send me a code" }).click();

  // Second step names the address back, so a typo is caught before waiting on
  // an email that will never arrive.
  await expect(page.getByRole("dialog")).toContainText("ada@example.com");

  // Six digits is the whole input; there is nothing left to confirm.
  await page.getByPlaceholder("000000").fill("123456");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("ada")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(verifyBody).toMatchObject({ code: "123456", deviceLabel: "Browser" });
});

test("a rejected code says so and leaves you signed out", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: null } })
  );
  await page.route("**/api/auth/challenges", (route) =>
    route.fulfill({ json: { challengeId: "ch_test" } })
  );
  await page.route("**/api/auth/challenges/*/verify", (route) =>
    route.fulfill({ status: 401, json: { error: "That code isn't right." } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("you@work.com").fill("ada@example.com");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByPlaceholder("000000").fill("000000");

  await expect(page.getByText("That code isn't right.")).toBeVisible();
  // Cleared, so the next attempt starts from empty rather than from a wrong
  // code that has to be selected and deleted first.
  await expect(page.getByPlaceholder("000000")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});

test("closing and reopening starts from a blank form", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: null } })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("you@work.com").fill("typo@example.com");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByPlaceholder("you@work.com")).toHaveValue("");
});

// ---------------------------------------------------------------------------
// Participation. Without this, someone who joined from a browser could never be
// kept as a contact — the graph would only ever grow between two app users.
// ---------------------------------------------------------------------------

test("a call page records a signed-in visitor as having been there", async ({
  page,
}) => {
  const recorded: string[] = [];
  await page.route("**/api/calls/*/participants", (route) => {
    recorded.push(route.request().method());
    return route.fulfill({ json: { recorded: true } });
  });

  // Mock links carry their own exp/duration; nothing is persisted to look up.
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`/quiet-otter?exp=${exp}&d=300`);
  await expect.poll(() => recorded).toEqual(["POST"]);
});

test("a guest's refusal on a call page is silent and harmless", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  // The real route, with no session: a 401. Nothing may surface from it.
  // Mock links carry their own exp/duration; nothing is persisted to look up.
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`/quiet-otter?exp=${exp}&d=300`);
  await expect(page.locator("body")).not.toContainText("Sign in to do that.");
  await expect(page.locator("body")).not.toContainText("Application error");
  expect(errors).toEqual([]);
});
