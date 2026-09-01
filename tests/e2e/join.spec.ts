import { expect, test } from "@playwright/test";

/**
 * /join hands off to app.qwickword.com rather than reproducing the sign-up
 * form. These tests guard the two things that would quietly break that:
 * a form creeping onto the page, and the TestFlight placeholder turning into
 * a dead link. They are written to keep passing once the real TestFlight
 * link is pasted into src/app/join/page.tsx.
 */

test("/join sends people to the real account page and collects nothing", async ({
  page,
}) => {
  await page.goto("/join");

  await expect(
    page.getByRole("link", { name: "Create your account" }),
  ).toHaveAttribute("href", "https://app.qwickword.com/auth/register");
  await expect(
    page.getByRole("link", { name: "app.qwickword.com/auth/link" }),
  ).toHaveAttribute("href", "https://app.qwickword.com/auth/link");

  // The whole point of the page: no second credential surface.
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("input, textarea, select")).toHaveCount(0);
});

test("/join presents the sequence as three ordered steps", async ({ page }) => {
  await page.goto("/join");

  const steps = page.locator("ol > li");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Create your account");
  await expect(steps.nth(1)).toContainText("Install the app");
  await expect(steps.nth(2)).toContainText("Sign in on your phone");
});

test("/join never implies a download that does not exist", async ({ page }) => {
  await page.goto("/join");

  const testflightLink = page.getByRole("link", {
    name: "Get the app through TestFlight",
  });

  if ((await testflightLink.count()) > 0) {
    // Once the link exists it must be a real absolute URL, not a stub.
    await expect(testflightLink).toHaveAttribute("href", /^https:\/\/\S+/);
  } else {
    await expect(page.getByText("no invitation link to give you yet")).toBeVisible();
  }
});

test("/join avoids the plumbing vocabulary a visitor should never meet", async ({
  page,
}) => {
  await page.goto("/join");
  const visibleText = (await page.locator("body").innerText()).toLowerCase();

  for (const jargon of ["homeserver", "matrix", "device grant"]) {
    expect(visibleText).not.toContain(jargon);
  }
});

test("/join is listed in the sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("https://qwickword.com/join");
});
