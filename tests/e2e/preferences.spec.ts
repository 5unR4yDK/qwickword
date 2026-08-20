import { expect, test } from "@playwright/test";

test("the selected theme survives a reload", async ({ page }) => {
  await page.goto("/");

  const toLight = page.getByRole("button", { name: "Switch to light mode" });
  await expect(toLight).toBeVisible();
  await toLight.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" })
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("camera and microphone start choices survive a reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Call settings" }).click();

  const camera = page.getByRole("button", { name: "Start with camera" });
  const mic = page.getByRole("button", { name: "Start with mic" });
  await expect(camera).toHaveAttribute("aria-pressed", "true");
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await camera.click();
  await mic.click();
  await expect(camera).toHaveAttribute("aria-pressed", "false");
  await expect(mic).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await page.getByRole("button", { name: "Call settings" }).click();
  await expect(
    page.getByRole("button", { name: "Start with camera" })
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Start with mic" })
  ).toHaveAttribute("aria-pressed", "false");
});

test("Escape closes settings and returns focus to its trigger", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Call settings" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Call settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Call settings" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
