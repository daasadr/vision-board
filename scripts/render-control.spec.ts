import { resolve } from "node:path";
import { expect, test } from "../e2e/support/ipc";

/** Rendered at 3× and scaled down to the monitor's scale factor by the app. */
const SCALE = 3;
const OUT = resolve("src-tauri/assets/control");

for (const theme of ["galerie", "noc"] as const) {
  test.describe(theme, () => {
    test.use({
      settings: { theme },
      viewport: { width: 120, height: 40 },
      deviceScaleFactor: SCALE,
    });

    test(`renders ${theme}`, async ({ page }) => {
      await page.goto("/control");
      const bar = page.getByRole("button", { name: "Otevřít nastavení Vision Board" });
      await expect(bar).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // No transitions, so the hover state is captured fully applied.
      await page.addStyleTag({ content: "*, *::before { transition: none !important; }" });

      const shot = (name: string) =>
        page.screenshot({ path: `${OUT}/${theme}-${name}.png`, omitBackground: true });
      await shot("normal");
      // The hover look: tilted towards the viewer with the highlight moved, as when the
      // pointer rests on the right part of the bar.
      await bar.evaluate((el) => {
        el.style.setProperty("--tilt-x", "-5deg");
        el.style.setProperty("--tilt-y", "9deg");
        el.style.setProperty("--glare-x", "25%");
      });
      await shot("hover");
    });
  });
}
