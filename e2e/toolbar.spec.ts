import type { Item } from "../src/lib/bindings";
import { expect, test } from "./support/ipc";

const quote = (id: string, x: number, y: number, w: number, h: number): Item => ({
  id,
  x,
  y,
  w,
  h,
  rotation: 0,
  z: 0,
  content: { kind: "quote", text: `Citát ${id}`, author: null },
});

test.describe("item toolbar in a small window", () => {
  test.use({
    viewport: { width: 720, height: 480 },
    board: {
      items: [
        quote("left", 0, 400, 300, 160),
        quote("right", 1620, 400, 300, 160),
        quote("tall", 700, 0, 400, 1080),
      ],
    },
  });

  for (const id of ["left", "right", "tall"]) {
    test(`stays fully visible for the ${id} item`, async ({ page }) => {
      await page.goto("/");
      await page.getByText(`Citát ${id}`).click();
      const toolbar = page.getByRole("toolbar", { name: "Úpravy položky" });
      await expect(toolbar).toBeVisible();
      const box = await toolbar.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(720);
      expect(box.y + box.height).toBeLessThanOrEqual(480);
      await expect(toolbar.getByRole("button", { name: "Smazat" })).toBeInViewport();
    });
  }
});
