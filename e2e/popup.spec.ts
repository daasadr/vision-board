import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Item } from "../src/lib/ipc";
import { expect, test } from "./support/ipc";

const quote: Item = {
  id: "q1",
  x: 700,
  y: 400,
  w: 420,
  h: 160,
  rotation: 0,
  z: 1,
  content: { kind: "quote", text: "Krok za krokem", author: null },
};

type Call = { cmd: string; args: Record<string, unknown> };
const closeCalls = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __E2E_IPC_CALLS__: Call[] }).__E2E_IPC_CALLS__.filter(
      (c) => c.cmd === "popup_close",
    ),
  );

test.use({ board: { items: [quote] } });

test("shows the board read-only with close and snooze", async ({ page }) => {
  await page.goto("/popup");
  await expect(page.getByText("Krok za krokem")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-transparent", "");
  // Read-only: no editing toolbar, items are not focusable buttons.
  await expect(page.getByRole("button", { name: /Citát/ })).toHaveCount(0);

  await page.getByRole("button", { name: "15 min" }).click();
  await expect
    .poll(() => closeCalls(page))
    .toEqual([{ cmd: "popup_close", args: { snoozeMinutes: 15 } }]);
});

test("closes with the button and only once", async ({ page }) => {
  await page.goto("/popup");
  const close = page.getByRole("button", { name: "Zavřít" });
  await close.click();
  await expect.poll(async () => (await closeCalls(page)).length).toBe(1);
  expect((await closeCalls(page))[0].args).toEqual({ snoozeMinutes: null });
});

test("closes with Escape", async ({ page }) => {
  await page.goto("/popup");
  await expect(page.getByText("Krok za krokem")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await closeCalls(page)).length).toBe(1);
});

test("closes when the countdown ends, and hovering pauses it", async ({ page }) => {
  await page.goto("/popup");
  const countdown = page.getByTestId("popup-countdown");
  await expect(countdown).toHaveCSS("animation-duration", "30s");

  await page.getByRole("toolbar").hover();
  await expect(countdown).toHaveCSS("animation-play-state", "paused");

  await countdown.dispatchEvent("animationend");
  await expect.poll(async () => (await closeCalls(page)).length).toBe(1);
});

for (const [theme, colorScheme] of [
  ["galerie", "light"],
  ["noc", "dark"],
] as const) {
  test(`${theme}: the pop-up is accessible`, async ({ page }) => {
    // Without motion the fade-in is done at once, so colors are checked as they end up.
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/popup");
    await expect(page.getByText("Krok za krokem")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}
