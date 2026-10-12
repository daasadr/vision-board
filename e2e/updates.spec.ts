import { expect, invokedCommands, storedSettings, test } from "./support/ipc";

const AVAILABLE = { version: "0.2.0", notes: "Nápověda přímo v aplikaci." };

test.describe("updates", () => {
  test("shows the version and finds nothing new", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Verze 0.0.0-e2e")).toBeVisible();
    await page.getByRole("button", { name: "Zkontrolovat teď" }).click();
    await expect(page.getByText("Máte nejnovější verzi.")).toBeVisible();
    expect(await invokedCommands(page)).toContain("update_check");
  });

  test("automatic checks can be turned off", async ({ page }) => {
    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "Automaticky kontrolovat aktualizace" });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect.poll(async () => (await storedSettings(page)).updates.autoCheck).toBe(false);
  });

  test.describe("with a newer version", () => {
    test.use({ ipc: { update_status: { current: "0.1.0", available: AVAILABLE } } });

    test("the settings offer to install it", async ({ page }) => {
      await page.goto("/settings");
      await expect(page.getByText("Je k dispozici verze 0.2.0.")).toBeVisible();
      await page.getByText("Co je nového").click();
      await expect(page.getByText("Nápověda přímo v aplikaci.")).toBeVisible();
      await page.getByRole("button", { name: "Nainstalovat a restartovat" }).click();
      expect(await invokedCommands(page)).toContain("update_install");
    });

    test("the board tells about it once", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByText("Je k dispozici nová verze Vision Boardu (0.2.0)."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Nainstalovat" }).click();
      expect(await invokedCommands(page)).toContain("update_install");

      await page.reload();
      await expect(page.getByRole("heading", { name: "Vaše vize začíná tady" })).toBeVisible();
      await expect(page.getByText("Je k dispozici nová verze Vision Boardu")).toHaveCount(0);
    });
  });

  test.describe("when installing fails", () => {
    test.use({
      ipc: {
        update_status: { current: "0.1.0", available: AVAILABLE },
        update_install: { __error: "signature mismatch" },
      },
    });

    test("the settings say so", async ({ page }) => {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Nainstalovat a restartovat" }).click();
      await expect(page.getByText("Aktualizaci se nepodařilo nainstalovat.")).toBeVisible();
    });
  });
});
