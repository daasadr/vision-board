import { expect, storedSettings, test } from "./support/ipc";

test("the board can become the desktop wallpaper", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Zobrazení" }).click();
  const wallpaper = page.getByRole("switch", { name: "Nástěnka jako tapeta plochy" });
  await expect(wallpaper).not.toBeChecked();
  await wallpaper.click();
  await expect.poll(async () => (await storedSettings(page)).startup.wallpaper).toBe(true);
  await expect(page.getByText(/vrátí vaše původní tapeta/)).toBeVisible();
});

test.describe("without the entitlement", () => {
  test.use({
    ipc: {
      entitlements_get: [
        { feature: "premiumFrames", enabled: true },
        { feature: "wallpaper", enabled: false },
        { feature: "scheduledPopup", enabled: true },
      ],
    },
  });

  test("the wallpaper cannot be turned on and says how to unlock it", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Zobrazení" }).click();
    await expect(page.getByRole("switch", { name: "Nástěnka jako tapeta plochy" })).toBeDisabled();
    await expect(page.getByText("Odemknete ji dárkovým kódem")).toBeVisible();
  });
});

test("the renderer page draws the board and reports when it is done", async ({ page }) => {
  await page.goto("/wallpaper");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __E2E_IPC_CALLS__: { cmd: string }[] }).__E2E_IPC_CALLS__.some(
          (c) => c.cmd === "wallpaper_rendered",
        ),
      ),
    )
    .toBe(true);
});
