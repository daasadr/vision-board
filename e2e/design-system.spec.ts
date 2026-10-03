import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./support/ipc";

for (const [theme, colorScheme] of [
  ["galerie", "light"],
  ["noc", "dark"],
] as const) {
  test(`${theme}: design system page has no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/design");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("dialog traps focus, closes on Escape and returns focus", async ({ page }) => {
  await page.goto("/design");
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Přidat citát" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Text citátu" })).toBeFocused();

  const results = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("switch toggles with the keyboard", async ({ page }) => {
  await page.goto("/design");
  const toggle = page.getByRole("switch", { name: "Spustit při přihlášení" });
  await expect(toggle).not.toBeChecked();
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
});

test("animations are disabled when the OS asks for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design");
  await page.getByRole("button", { name: "Open dialog" }).click();
  const duration = await page
    .getByRole("dialog")
    .evaluate((el) => getComputedStyle(el).animationDuration);
  expect(duration).toBe("0s");
});
