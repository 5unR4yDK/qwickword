import {
  expect,
  NETWORK_PROFILES,
  test,
} from "./fixtures/network";

test.describe("F7 network-condition harness", () => {
  test("offline room creation fails clearly and retries in place", async ({
    page,
    network,
  }) => {
    await page.goto("/");

    await network.use(NETWORK_PROFILES.offline);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

    await page.getByRole("button", { name: "1 min" }).click();
    await expect(page.locator("p[role='alert']")).toHaveText(
      "Couldn't reach the server. Check your connection and try again."
    );

    await network.reset();
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);

    await page.getByRole("button", { name: "1 min" }).click();
    await expect(page.getByText("Share this link")).toBeVisible();
  });

  test("slow mobile creation stays single-flight", async ({ page, network }) => {
    await page.goto("/");

    let createRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/rooms"
      ) {
        createRequests += 1;
      }
    });

    await network.use(NETWORK_PROFILES.slowMobile);
    const picker = page.getByRole("group", { name: "Call length" });
    const oneMinute = picker.getByRole("button", { name: "1 min" });

    await oneMinute.click();
    await expect(oneMinute).toBeDisabled();
    await expect(picker.getByRole("button", { name: "custom" })).toBeDisabled();
    await expect(page.getByText("Share this link")).toBeVisible({
      timeout: 15_000,
    });
    expect(createRequests).toBe(1);
  });

  test("an offline countdown start is retryable after recovery", async ({
    page,
    network,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "1 min" }).click();

    const roomPath = await page
      .getByRole("link", { name: "Join the meeting now" })
      .getAttribute("href");
    expect(roomPath).toBeTruthy();
    await page.goto(roomPath!);
    await expect(page.getByText(/Mock call/)).toBeVisible();

    await network.use(NETWORK_PROFILES.offline);
    await page.getByRole("button", { name: "Start now" }).click();
    const appAlert = page.locator("p[role='alert']");
    await expect(appAlert).toHaveText(
      "Couldn't reach the server. Check your connection and try again."
    );

    await network.reset();
    await page.getByRole("button", { name: "Start now" }).click();
    await expect(page.getByRole("timer")).toContainText(/^1:0[01]$/);
    await expect(appAlert).toBeHidden();
  });

  test("an already-started call still reaches its terminal screen offline", async ({
    page,
    network,
  }) => {
    // Leave enough headroom for a fully parallel CI worker to finish the
    // server render before the timer starts; the assertion below still keeps
    // the whole scenario short.
    const exp = Math.floor(Date.now() / 1000) + 8;
    await page.goto(`/offline-expiry?exp=${exp}`);
    await expect(page.getByRole("timer")).toBeVisible();

    await network.use(NETWORK_PROFILES.offline);
    await expect(
      page.getByText("This Qwickword has ended.")
    ).toBeVisible({ timeout: 12_000 });
  });
});
