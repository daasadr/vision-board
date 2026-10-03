import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Item } from "../src/lib/ipc";
import { expect, storedItems, test } from "./support/ipc";

const quote: Item = {
  id: "q1",
  x: 600,
  y: 400,
  w: 600,
  h: 220,
  rotation: 0,
  z: 1,
  content: { kind: "quote", text: "Cíl bez plánu je jen přání.", author: null },
};
const note: Item = {
  id: "n1",
  x: 200,
  y: 200,
  w: 480,
  h: 140,
  rotation: 0,
  z: 2,
  content: { kind: "text", text: "Běhat každé ráno", variant: "note" },
};

const stored = (page: Page, id: string) =>
  expect.poll(async () => (await storedItems(page)).find((i) => i.id === id));

/** Screen pixels per canvas unit. */
async function canvasScale(page: Page) {
  const box = await page.getByRole("region", { name: "Nástěnka" }).boundingBox();
  if (!box) throw new Error("canvas not visible");
  return box.width / 1920;
}

async function dragBy(page: Page, selector: string, dx: number, dy: number) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} not visible`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

test.describe("first run", () => {
  test("shows an invitation with actions on an empty board", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Vaše vize začíná tady" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Citát" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Text" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("adds a quote in the middle of the board", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Citát" }).click();
    const dialog = page.getByRole("dialog", { name: "Přidat citát" });
    const add = dialog.getByRole("button", { name: "Přidat" });
    await expect(add).toBeDisabled();

    await dialog.getByRole("textbox", { name: "Citát" }).fill("Kdo chce, hledá způsoby.");
    await dialog.getByRole("textbox", { name: "Autor" }).fill("Seneca");
    await add.click();

    await expect(dialog).toBeHidden();
    const item = page.getByRole("button", { name: /Citát: Kdo chce, hledá způsoby/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Seneca");

    // Centered on the canvas.
    const canvas = await page.getByRole("region", { name: "Nástěnka" }).boundingBox();
    const box = await item.boundingBox();
    if (!canvas || !box) throw new Error("not visible");
    expect(Math.abs(box.x + box.width / 2 - (canvas.x + canvas.width / 2))).toBeLessThan(2);

    await expect
      .poll(async () => (await storedItems(page)).map((i) => i.content))
      .toEqual([{ kind: "quote", text: "Kdo chce, hledá způsoby.", author: "Seneca" }]);
    // The empty state is gone and the toolbar took its place.
    await expect(page.getByRole("heading", { name: "Vaše vize začíná tady" })).toBeHidden();
    await expect(page.getByRole("toolbar", { name: "Přidat na nástěnku" })).toBeVisible();
  });

  test("does not create an item from empty text", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Text" }).click();
    const dialog = page.getByRole("dialog", { name: "Přidat text" });
    const field = dialog.getByRole("textbox", { name: "Text" });
    await field.fill("   ");
    await expect(dialog.getByRole("button", { name: "Přidat" })).toBeDisabled();
    await field.press("Control+Enter");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Zrušit" }).click();
    await expect(dialog).toBeHidden();
    expect(await storedItems(page)).toEqual([]);
  });

  test("adds a heading with Ctrl+Enter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Text" }).click();
    const dialog = page.getByRole("dialog", { name: "Přidat text" });
    await dialog.getByRole("textbox", { name: "Text" }).fill("Rok 2027");
    await dialog.getByRole("textbox", { name: "Text" }).press("Control+Enter");
    await expect(page.getByRole("button", { name: "Text: Rok 2027" })).toBeVisible();
    await stored(page, (await storedItems(page))[0]?.id ?? "").toMatchObject({
      content: { kind: "text", text: "Rok 2027", variant: "heading" },
    });
  });
});

test.describe("editing items", () => {
  test.use({ board: { items: [quote, note] } });

  test("moves an item by dragging and keeps it after a restart", async ({ page }) => {
    await page.goto("/");
    const scale = await canvasScale(page);
    await dragBy(page, "[data-item-id=q1]", 200, 100);
    await stored(page, "q1").toMatchObject({
      x: expect.closeTo(quote.x + 200 / scale, 0) as unknown as number,
      y: expect.closeTo(quote.y + 100 / scale, 0) as unknown as number,
    });

    await page.reload();
    const box = await page.locator("[data-item-id=q1]").boundingBox();
    const canvas = await page.getByRole("region", { name: "Nástěnka" }).boundingBox();
    if (!box || !canvas) throw new Error("not visible");
    expect((box.x - canvas.x) / scale).toBeCloseTo(quote.x + 200 / scale, -1);
  });

  test("an item dropped off the canvas stays 10 % visible", async ({ page }) => {
    await page.goto("/");
    await dragBy(page, "[data-item-id=n1]", 3000, 0);
    await expect
      .poll(async () => (await storedItems(page)).find((i) => i.id === "n1")?.x)
      .toBeGreaterThan(1700);
    const item = (await storedItems(page)).find((i) => i.id === "n1");
    expect(item?.x).toBeLessThanOrEqual(1920 - Math.sqrt(0.1) * note.w + 0.01);
  });

  test("resizes from a corner and rotates with the handle", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-item-id=q1]").click();
    await dragBy(page, "[data-item-id=q1] [data-handle=se]", 120, 60);
    await expect
      .poll(async () => (await storedItems(page)).find((i) => i.id === "q1")?.w)
      .toBeGreaterThan(quote.w);

    await dragBy(page, "[data-item-id=q1] [data-handle=rotate]", 400, 0);
    await expect
      .poll(async () => (await storedItems(page)).find((i) => i.id === "q1")?.rotation)
      .toBe(15);
  });

  test("toolbar reorders and deletes; undo restores", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-item-id=q1]").click();
    const toolbar = page.getByRole("toolbar", { name: "Úpravy položky" });
    await toolbar.getByRole("button", { name: "Do popředí" }).click();
    await expect.poll(async () => (await storedItems(page)).find((i) => i.id === "q1")?.z).toBe(3);

    await toolbar.getByRole("button", { name: "Smazat" }).click();
    await expect(page.locator("[data-item-id=q1]")).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.locator("[data-item-id=q1]")).toBeVisible();
    await page.keyboard.press("Control+Shift+z");
    await expect(page.locator("[data-item-id=q1]")).toHaveCount(0);
    await expect.poll(async () => (await storedItems(page)).map((i) => i.id)).toEqual(["n1"]);
  });

  test("edits text in place", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-item-id=n1]").dblclick();
    const editor = page.getByRole("textbox");
    await expect(editor).toBeFocused();
    await page.keyboard.type("Běhat každý den");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Text: Běhat každý den" })).toBeVisible();
    await stored(page, "n1").toMatchObject({ content: { text: "Běhat každý den" } });
  });

  test("works with the keyboard alone", async ({ page }) => {
    await page.goto("/");
    const item = page.getByRole("button", { name: "Text: Běhat každé ráno" });
    await item.focus();
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await stored(page, "n1").toMatchObject({ x: note.x + 10, y: note.y + 1 });
    await page.keyboard.press("Delete");
    await expect(item).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
