import { expect, test, type Page } from "@playwright/test";

const SOCIAL_PREVIEW_URL =
  "https://qwickword.com/og-card-share-v2-1200x630.png";

async function metaContents(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("content") ?? ""),
  );
}

async function expectSingleSocialPreview(page: Page): Promise<void> {
  await expect
    .poll(() => metaContents(page, 'meta[property="og:image"]'))
    .toEqual([SOCIAL_PREVIEW_URL]);
  await expect(
    page.locator('meta[property="og:image:width"]'),
  ).toHaveAttribute("content", "1200");
  await expect(
    page.locator('meta[property="og:image:height"]'),
  ).toHaveAttribute("content", "630");
  await expect(
    page.locator('meta[property="og:image:type"]'),
  ).toHaveAttribute("content", "image/png");
  await expect(
    page.locator('meta[name="twitter:image"]'),
  ).toHaveAttribute("content", SOCIAL_PREVIEW_URL);
}

test("home page publishes one landscape social preview", async ({ page }) => {
  await page.goto("/");
  await expectSingleSocialPreview(page);
});

test("shared room links keep the same single social preview", async ({ page }) => {
  const futureExpiry = Math.floor(Date.now() / 1000) + 60 * 60;
  await page.goto(`/preview_room?d=420&exp=${futureExpiry}`);
  await expectSingleSocialPreview(page);
  await expect(
    page.locator('meta[property="og:title"]'),
  ).toHaveAttribute("content", "Someone wants to have a Qwickword (7 min)");
});
