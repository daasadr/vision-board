import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Item } from "../src/lib/bindings";
import { expect, test } from "./support/ipc";

/** Arguments of every call of a command, in order. */
async function callsOf(page: Page, cmd: string): Promise<unknown[]> {
  return page.evaluate(
    (name) =>
      (
        window as unknown as { __E2E_IPC_CALLS__: { cmd: string; args: unknown }[] }
      ).__E2E_IPC_CALLS__
        .filter((c) => c.cmd === name)
        .map((c) => c.args),
    cmd,
  );
}

const quote: Item = {
  id: "q1",
  x: 100,
  y: 200,
  w: 400,
  h: 160,
  rotation: 0,
  z: 0,
  content: { kind: "quote", text: "Cíl bez plánu je jen přání.", author: null },
};

test.describe("help", () => {
  test("the guide in the settings explains every feature", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Nápověda" }).click();

    await expect(page.getByText("Přetáhněte na nástěnku fotky")).toBeVisible();
    await expect(page.locator("summary")).toHaveText([
      "Začínáme",
      "Nástěnka",
      "Hotspoty na obrázcích",
      "Úkoly vedle nástěnky (nepovinné)",
      "Naplánované zobrazení",
      "Nástěnka jako tapeta",
      "Ovládací prvek a ikona",
      "Soukromí",
      "Aktualizace",
    ]);

    await page.locator("summary", { hasText: "Soukromí" }).click();
    await expect(page.getByText(/Nikdy nečte, co píšete/)).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test.describe("on a board with content", () => {
    test.use({ board: { items: [quote] } });

    test("the toolbar opens the guide", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Nápověda" }).click();
      expect(await callsOf(page, "window_open_settings")).toContainEqual({ section: "help" });
    });
  });

  test("an empty board links to the guide", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Jak Vision Board funguje?" }).click();
    expect(await callsOf(page, "window_open_settings")).toContainEqual({ section: "help" });
  });

  test("the backend can switch an open settings window to the guide", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "Obecné" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect.poll(() => callsOf(page, "plugin:event|listen")).not.toEqual([]);
    await page.evaluate(() =>
      (window as unknown as { __E2E_EMIT__: (e: string, p: unknown) => void }).__E2E_EMIT__(
        "settings://section",
        "help",
      ),
    );
    await expect(page.getByRole("tab", { name: "Nápověda" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
