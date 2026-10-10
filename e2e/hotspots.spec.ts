import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Hotspot, Item, Media } from "../src/lib/ipc";
import { expect, storedItems, test } from "./support/ipc";

const media = (id: string): Media => ({
  id,
  fileName: `${id}.webp`,
  thumbName: `${id}_t.webp`,
  width: 800,
  height: 600,
  bytes: 1000,
});

const image = (hotspots: Hotspot[]): Item => ({
  id: "sea",
  x: 600,
  y: 300,
  w: 640,
  h: 480,
  rotation: 0,
  z: 1,
  content: { kind: "image", mediaId: "m1", hotspots },
});

const linkHotspot: Hotspot = {
  id: "h1",
  x: 0.25,
  y: 0.5,
  label: "Ubytování",
  action: { kind: "link", url: "https://example.com/ubytovani" },
};

const detailHotspot: Hotspot = {
  id: "h2",
  x: 0.7,
  y: 0.3,
  label: "Dům snů",
  action: {
    kind: "detail",
    title: "Dům snů",
    text: "Terasa s výhledem na moře.",
    media: ["m2", "m3"],
  },
};

type Call = { cmd: string; args: Record<string, unknown> };
const callsOf = (page: Page, cmd: string) =>
  page.evaluate(
    (name) =>
      (window as unknown as { __E2E_IPC_CALLS__: Call[] }).__E2E_IPC_CALLS__.filter(
        (c) => c.cmd === name,
      ),
    cmd,
  );

test.describe("a board with hotspots", () => {
  test.use({
    board: {
      items: [image([linkHotspot, detailHotspot])],
      media: [media("m1"), media("m2"), media("m3")],
    },
  });

  test("a link hotspot opens the page in the browser", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ubytování" }).click();
    await expect
      .poll(() => callsOf(page, "open_link"))
      .toEqual([{ cmd: "open_link", args: { url: "https://example.com/ubytovani" } }]);
  });

  test("a detail hotspot opens the detail window", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Dům snů" }).click();
    await expect
      .poll(() => callsOf(page, "window_open_detail"))
      .toEqual([{ cmd: "window_open_detail", args: { itemId: "sea", hotspotId: "h2" } }]);
  });

  test("the detail window pages through the photos and is accessible", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __VB_DETAIL__: unknown }).__VB_DETAIL__ = {
        itemId: "sea",
        hotspotId: "h2",
      };
    });
    await page.goto("/detail");
    await expect(page.getByRole("heading", { name: "Dům snů" })).toBeVisible();
    await expect(page.getByText("Terasa s výhledem na moře.")).toBeVisible();
    await expect(page.getByText("1 / 2")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 2")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("editing hotspots", () => {
  test.use({ board: { items: [image([])], media: [media("m1")] } });

  async function startEditing(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Obrázek" }).first().click();
    await page.getByRole("button", { name: "Hotspoty" }).click();
    await expect(page.getByText(/Klikněte do obrázku a přidejte hotspot/)).toBeVisible();
    const box = await page.locator("[data-item-id=sea] [data-image-box]").boundingBox();
    if (!box) throw new Error("image not visible");
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.6);
    return page.getByRole("dialog", { name: "Hotspot" });
  }

  test("adds a link hotspot where the image was clicked, and undo removes it", async ({ page }) => {
    const dialog = await startEditing(page);
    await dialog.getByLabel("Název").fill("Ubytování");
    await dialog.getByLabel("Adresa").fill("https://example.com");
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole("button", { name: "Ubytování" })).toBeVisible();
    await expect
      .poll(async () => {
        const item = (await storedItems(page)).find((i) => i.id === "sea");
        return item?.content.kind === "image" ? item.content.hotspots : null;
      })
      .toMatchObject([
        { label: "Ubytování", action: { kind: "link", url: "https://example.com" } },
      ]);
    const [stored] = await storedItems(page);
    const [hotspot] = stored.content.kind === "image" ? (stored.content.hotspots ?? []) : [];
    expect(hotspot.x).toBeCloseTo(0.4, 1);
    expect(hotspot.y).toBeCloseTo(0.6, 1);

    await page.getByRole("button", { name: "Hotovo" }).click();
    await page.keyboard.press("Control+z");
    await expect(page.getByRole("button", { name: "Ubytování" })).toHaveCount(0);
  });

  test("refuses a link that is not http or https", async ({ page }) => {
    const dialog = await startEditing(page);
    await dialog.getByLabel("Název").fill("Systém");
    await dialog.getByLabel("Adresa").fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(
      dialog.getByText("Zadejte adresu začínající http:// nebo https://."),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    const [stored] = await storedItems(page);
    expect(stored.content.kind === "image" ? (stored.content.hotspots ?? []) : []).toEqual([]);
  });
});
