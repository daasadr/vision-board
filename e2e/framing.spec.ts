import type { Page } from "@playwright/test";
import type { Item, Media } from "../src/lib/ipc";
import { expect, storedItems, storedSettings, test } from "./support/ipc";

const media: Media = {
  id: "m1",
  fileName: "m1.webp",
  thumbName: "m1_t.webp",
  width: 800,
  height: 600,
  bytes: 1000,
};

const image = (id: string, x: number, style?: Item["style"]): Item => ({
  id,
  x,
  y: 300,
  w: 400,
  h: 300,
  rotation: 0,
  z: 1,
  content: { kind: "image", mediaId: "m1" },
  ...(style ? { style } : {}),
});

const quote: Item = {
  id: "q1",
  x: 1200,
  y: 200,
  w: 420,
  h: 160,
  rotation: 0,
  z: 2,
  content: { kind: "quote", text: "Krok za krokem", author: null },
};

const frames = (page: Page) => page.locator("[data-frame]");

test.describe("board frame", () => {
  test.use({
    settings: { frame: "polaroid" },
    board: { items: [image("a", 100), image("b", 700, { frame: "none" })], media: [media] },
  });

  test("frames images without their own frame and keeps exceptions", async ({ page }) => {
    await page.goto("/");
    await expect(frames(page)).toHaveCount(2);
    await expect(frames(page).nth(0)).toHaveAttribute("data-frame", "polaroid");
    await expect(frames(page).nth(1)).toHaveAttribute("data-frame", "none");
  });

  test("an image can follow the board again or pick its own frame", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Obrázek" }).nth(1).click();
    const select = page.getByRole("combobox", { name: "Rám" });
    await expect(select).toHaveValue("none");

    await select.selectOption({ label: "Podle nástěnky (Polaroid)" });
    await expect(frames(page).nth(1)).toHaveAttribute("data-frame", "polaroid");
    await select.selectOption({ label: "Paspartá" });
    await expect(frames(page).nth(1)).toHaveAttribute("data-frame", "passepartout");
    await expect
      .poll(async () => (await storedItems(page)).find((i) => i.id === "b")?.style?.frame)
      .toBe("passepartout");

    await page.keyboard.press("Control+z");
    await expect(frames(page).nth(1)).toHaveAttribute("data-frame", "polaroid");
  });
});

test.describe("without the premium frames entitlement", () => {
  test.use({
    settings: { frame: "polaroid" },
    board: { items: [image("a", 100)], media: [media] },
    ipc: {
      entitlements_get: [
        { feature: "premiumFrames", enabled: false },
        { feature: "wallpaper", enabled: false },
        { feature: "scheduledPopup", enabled: false },
      ],
    },
  });

  test("a stored premium frame shows as no frame", async ({ page }) => {
    await page.goto("/");
    await expect(frames(page).first()).toHaveAttribute("data-frame", "none");
  });

  test("a locked frame is explained instead of applied", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Vzhled" }).click();
    await page.getByRole("radio", { name: /Linka/ }).check();
    await expect.poll(async () => (await storedSettings(page)).frame).toBe("line");

    await page.getByRole("radio", { name: /Sklo/ }).click();
    await expect(page.getByRole("status")).toContainText("Odemknete ho dárkovým kódem");
    expect((await storedSettings(page)).frame).toBe("line");
    await expect(page.getByRole("radio", { name: /Sklo/ })).not.toBeChecked();
  });
});

test.describe("images only", () => {
  test.use({ board: { items: [image("a", 100), quote], media: [media] } });

  test("hides quotes and texts and brings them back in place", async ({ page }) => {
    await page.goto("/");
    const quoteItem = page.getByRole("button", { name: /Citát: Krok za krokem/ });
    await expect(quoteItem).toBeVisible();

    const toggle = page.getByRole("button", { name: "Jen obrázky" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(quoteItem).toBeHidden();
    await expect(frames(page)).toHaveCount(1);

    await toggle.click();
    await expect(quoteItem).toBeVisible();
    const stored = (await storedItems(page)).find((i) => i.id === "q1");
    expect(stored).toMatchObject({ x: quote.x, y: quote.y, content: quote.content });
  });
});
