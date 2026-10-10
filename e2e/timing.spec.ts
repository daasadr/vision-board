import { expect, invokedCommands, storedSettings, test } from "./support/ipc";

test.describe("timing", () => {
  test("a daily reminder on weekdays", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Časování" }).click();
    await page.getByRole("switch", { name: "Zobrazovat nástěnku podle plánu" }).click();
    await expect.poll(async () => (await storedSettings(page)).startup.scheduledPopup).toBe(true);

    const time = page.getByRole("textbox", { name: "Čas 1" }).or(page.getByLabel("Čas 1"));
    await time.fill("08:30");
    await time.blur();
    await page.getByRole("button", { name: "sobota" }).click();
    await page.getByRole("button", { name: "neděle" }).click();
    await page.getByRole("radio", { name: "30 s" }).check();

    await expect
      .poll(async () => (await storedSettings(page)).schedule)
      .toMatchObject({
        times: [8 * 60 + 30],
        days: [true, true, true, true, true, false, false],
        durationSecs: 30,
      });
    await expect(page.getByText(/^Příští zobrazení:/)).toBeVisible();
  });

  test("try it shows the pop-up right away", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Časování" }).click();
    await page.getByRole("button", { name: "Vyzkoušet teď" }).click();
    expect(await invokedCommands(page)).toContain("popup_show_now");
  });

  test.describe("without the entitlement", () => {
    test.use({
      ipc: {
        entitlements_get: [
          { feature: "premiumFrames", enabled: true },
          { feature: "wallpaper", enabled: true },
          { feature: "scheduledPopup", enabled: false },
        ],
      },
    });

    test("the schedule cannot be turned on and says how to unlock it", async ({ page }) => {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "Časování" }).click();
      await expect(
        page.getByRole("switch", { name: "Zobrazovat nástěnku podle plánu" }),
      ).toBeDisabled();
      await expect(page.getByText("Odemknete ho dárkovým kódem")).toBeVisible();
    });
  });
});
