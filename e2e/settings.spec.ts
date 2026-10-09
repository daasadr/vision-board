import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Item } from "../src/lib/ipc";
import {
  DEFAULT_SETTINGS,
  expect,
  invokedCommands,
  storedItems,
  storedSettings,
  test,
} from "./support/ipc";

const quote: Item = {
  id: "q1",
  x: 200,
  y: 200,
  w: 420,
  h: 160,
  rotation: 0,
  z: 1,
  content: { kind: "quote", text: "Krok za krokem", author: null },
};

const section = (page: Page, name: string) => page.getByRole("tab", { name }).click();

test.describe("settings window", () => {
  test("choosing Noc switches the theme and keeps it after a restart", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "galerie");

    await section(page, "Vzhled");
    await page.getByRole("radio", { name: "Noc" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "noc");
    expect((await storedSettings(page)).theme).toBe("noc");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "noc");
  });

  test("a chosen language overrides the system one", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Deutsch" }).check();

    await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    expect((await storedSettings(page)).language).toBe("de");
  });

  test.describe("with changed settings and a board", () => {
    test.use({
      settings: { theme: "noc", frame: "line", imagesOnly: true, controlWidget: false },
      board: { items: [quote] },
    });

    test("restoring defaults resets every setting and keeps the board", async ({ page }) => {
      await page.goto("/settings");
      await page.getByRole("button", { name: "Obnovit výchozí nastavení" }).click();
      const dialog = page.getByRole("dialog", { name: "Obnovit výchozí nastavení?" });
      await dialog.getByRole("button", { name: "Obnovit" }).click();

      await expect(dialog).toBeHidden();
      await expect.poll(() => storedSettings(page)).toEqual(DEFAULT_SETTINGS);
      await expect(page.getByRole("switch", { name: "Ovládací prvek na ploše" })).toBeChecked();
      expect(await storedItems(page)).toEqual([quote]);
    });
  });

  test("starting at login can be turned on, and restoring defaults turns it off", async ({
    page,
  }) => {
    await page.goto("/settings");
    const autostart = page.getByRole("switch", { name: "Spouštět po přihlášení" });
    await expect(autostart).not.toBeChecked();
    await autostart.click();
    await expect(autostart).toBeChecked();

    await page.reload();
    await expect(autostart).toBeChecked();

    await page.getByRole("button", { name: "Obnovit výchozí nastavení" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Obnovit" }).click();
    await expect(autostart).not.toBeChecked();
  });

  test("the display section previews a partial placement in the bottom right", async ({ page }) => {
    await page.goto("/settings");
    await section(page, "Zobrazení");
    await page.getByRole("radio", { name: "Část obrazovky" }).check();

    const slider = page.getByRole("slider", { name: "Šířka" });
    await slider.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft"); // 60 → 40 %
    await expect(slider).toHaveAttribute("aria-valuetext", "40 % šířky obrazovky");
    await page.getByRole("radio", { name: "Vpravo dole" }).check();

    // 40 % of a 1600×900 screen at the bottom right, 2 % from the edges: 928, 508, 640×360.
    const preview = page.getByTestId("placement-preview-board");
    await expect(preview).toHaveAttribute("style", /left: 58%/);
    await expect(preview).toHaveAttribute("style", /width: 40%/);
    await expect
      .poll(async () => (await storedSettings(page)).placement)
      .toEqual({ mode: "partial", size: 40, anchor: "bottomRight" });
  });

  test("moving the size slider updates the preview while dragging", async ({ page }) => {
    await page.goto("/settings");
    await section(page, "Zobrazení");
    await page.getByRole("radio", { name: "Část obrazovky" }).check();
    const preview = page.getByTestId("placement-preview-board");
    await expect(preview).toHaveAttribute("style", /width: 60%/);

    await page.getByRole("slider", { name: "Šířka" }).fill("80");
    await expect(preview).toHaveAttribute("style", /width: 80%/);
  });

  for (const [theme, colorScheme] of [
    ["galerie", "light"],
    ["noc", "dark"],
  ] as const) {
    test(`${theme}: every section is accessible`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/settings");
      for (const name of ["Obecné", "Vzhled", "Zobrazení"]) {
        await section(page, name);
        if (name === "Zobrazení") {
          await page.getByRole("radio", { name: "Část obrazovky" }).check();
        }
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(results.violations, name).toEqual([]);
      }
    });
  }

  test("tabs work with the arrow keys", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Obecné" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("tab", { name: "Vzhled" })).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Vzhled" })).toBeVisible();
  });
});

test.describe("opening the settings", () => {
  test.use({ board: { items: [quote] } });

  test("from the board toolbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Nastavení" }).click();
    expect(await invokedCommands(page)).toContain("window_open_settings");
  });

  test("from the control widget, which also has a context menu", async ({ page }) => {
    await page.goto("/control");
    const control = page.getByRole("button", { name: "Otevřít nastavení Vision Board" });
    await control.click();
    await control.click({ button: "right" });
    const commands = await invokedCommands(page);
    expect(commands).toContain("window_open_settings");
    expect(commands).toContain("control_context_menu");
    await expect(page.locator("html")).toHaveAttribute("data-transparent", "");
  });
});
