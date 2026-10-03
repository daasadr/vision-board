import type { Page } from "@playwright/test";
import type { Item, Media } from "../src/lib/ipc";
import { emitTauriEvent, expect, storedItems, test } from "./support/ipc";

/** Drops files onto the board at a point in CSS pixels, the way Tauri reports an OS drop. */
async function dropFiles(page: Page, paths: string[], at: { x: number; y: number }) {
  const ratio = await page.evaluate(() => window.devicePixelRatio);
  await emitTauriEvent(page, "tauri://drag-drop", {
    paths,
    position: { x: at.x * ratio, y: at.y * ratio },
  });
}

const images = (page: Page) =>
  page.getByRole("button", { name: "Obrázek" }).filter({ has: page.locator("img") });

test("dropping three photos adds three images around the drop point", async ({ page }) => {
  await page.goto("/");
  const canvas = await page.getByRole("region", { name: "Nástěnka" }).boundingBox();
  if (!canvas) throw new Error("canvas not visible");
  const at = { x: canvas.x + canvas.width * 0.3, y: canvas.y + canvas.height * 0.4 };

  await dropFiles(page, ["C:\\Fotky\\more.jpg", "C:\\Fotky\\hory.jpg", "C:\\Fotky\\dum.jpg"], at);

  await expect(images(page)).toHaveCount(3);
  await expect.poll(async () => (await storedItems(page)).length).toBe(3);
  const stored = await storedItems(page);
  const scale = canvas.width / 1920;
  const meanX = stored.reduce((sum, i) => sum + (i.x ?? 0) + (i.w ?? 0) / 2, 0) / 3;
  expect(meanX).toBeCloseTo((at.x - canvas.x) / scale, -1);
  // One drop is one undo step.
  await page.keyboard.press("Control+z");
  await expect(images(page)).toHaveCount(0);
});

test("a PDF in the batch is reported while the PNG is added", async ({ page }) => {
  await page.goto("/");
  await dropFiles(page, ["C:\\logo.png", "C:\\smlouva.pdf"], { x: 400, y: 300 });

  await expect(images(page)).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText("„smlouva.pdf“ není podporovaný obrázek");
});

test("pastes an image from the clipboard", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "x.png", { type: "image/png" }),
    );
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }));
  });
  await expect(images(page)).toHaveCount(1);
});

test("picks images in the file dialog", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "cil.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  });
  await expect(images(page)).toHaveCount(1);
  // The empty state's image button opens the same picker.
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Obrázek" })).toBeVisible();
});

test.describe("restart", () => {
  const media: Media = {
    id: "m1",
    fileName: "m1.webp",
    thumbName: "m1_t.webp",
    width: 800,
    height: 600,
    bytes: 1000,
  };
  const image: Item = {
    id: "i1",
    x: 300,
    y: 200,
    w: 460,
    h: 345,
    rotation: 0,
    z: 1,
    content: { kind: "image", mediaId: "m1" },
  };
  test.use({ board: { items: [image], media: [media] } });

  test("shows stored images after a restart", async ({ page }) => {
    await page.goto("/");
    const img = page.locator("[data-item-id=i1] img");
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(800);
  });
});

test("critical flow: add an image, move it, restart, it is still there", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "dum-snu.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  });
  const image = images(page).first();
  await expect(image).toBeVisible();
  await expect.poll(async () => (await storedItems(page)).length).toBe(1);
  const before = (await storedItems(page))[0].x;

  const box = await image.boundingBox();
  if (!box) throw new Error("image not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 - 80, { steps: 10 });
  await page.mouse.up();
  const moved = await image.boundingBox();

  // Wait until the move is stored, then "restart" (reload keeps the mocked database).
  await expect.poll(async () => (await storedItems(page))[0].x).not.toBe(before);
  await page.reload();

  const after = images(page).first();
  await expect(after).toBeVisible();
  const restored = await after.boundingBox();
  expect(restored?.x).toBeCloseTo(moved?.x ?? NaN, 0);
  expect(restored?.y).toBeCloseTo(moved?.y ?? NaN, 0);
});
