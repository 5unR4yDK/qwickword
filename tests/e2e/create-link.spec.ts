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
