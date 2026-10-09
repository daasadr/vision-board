import { describe, expect, it, vi } from "vitest";
import type { ImportResult, Media } from "../../lib/ipc";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./geometry";
import { imageSize, importFilesInTurn, MAX_IMAGE_BYTES, newImageItems } from "./imageItems";
import { mediaUrl } from "./mediaStore";

const media = (id: string, width: number, height: number): Media => ({
  id,
  fileName: `${id}.webp`,
  thumbName: `${id}_t.webp`,
  width,
  height,
  bytes: 1000,
});

describe("image items", () => {
  it("sizes new images to fit while keeping the aspect ratio", () => {
    expect(imageSize({ width: 4000, height: 3000 })).toEqual({ w: 460, h: 345 });
    expect(imageSize({ width: 1000, height: 2000 })).toEqual({ w: 230, h: 460 });
  });

  it("places a single image centered on the drop point", () => {
    const [item] = newImageItems([media("a", 800, 600)], { x: 500, y: 400 }, 7);
    expect(item.x + item.w / 2).toBeCloseTo(500);
    expect(item.y + item.h / 2).toBeCloseTo(400);
    expect(item.rotation).toBe(0);
    expect(item.z).toBe(7);
    expect(item.content).toEqual({ kind: "image", mediaId: "a" });
  });

  it("fans out a batch around the drop point, each above the previous", () => {
    const items = newImageItems(
      [media("a", 800, 600), media("b", 800, 600), media("c", 800, 600)],
      { x: 960, y: 540 },
      1,
    );
    expect(items.map((i) => i.z)).toEqual([1, 2, 3]);
    expect(new Set(items.map((i) => i.x)).size).toBe(3);
    const centers = items.map((i) => i.x + i.w / 2);
    expect((centers[0] + centers[2]) / 2).toBeCloseTo(960);
  });

  it("keeps images dropped at the edge on the canvas", () => {
    const [item] = newImageItems(
      [media("a", 800, 600)],
      { x: CANVAS_WIDTH + 500, y: CANVAS_HEIGHT },
      1,
    );
    expect(item.x).toBeLessThan(CANVAS_WIDTH);
    expect(item.y).toBeLessThan(CANVAS_HEIGHT);
  });
});

describe("importFilesInTurn", () => {
  it("sends files one at a time and names errors", async () => {
    let running = 0;
    let maxRunning = 0;
    const importBytes = vi.fn(async (base64: string): Promise<ImportResult> => {
      maxRunning = Math.max(maxRunning, ++running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return atob(base64) === "bad"
        ? { status: "error", kind: "unsupported", name: "" }
        : { status: "ok", media: media("m", 10, 10) };
    });

    const results = await importFilesInTurn(
      [new File(["ok"], "a.jpg"), new File(["bad"], "b.pdf")],
      importBytes,
    );
    expect(maxRunning).toBe(1);
    expect(results[0].status).toBe("ok");
    expect(results[1]).toEqual({ status: "error", kind: "unsupported", name: "b.pdf" });
  });

  it("rejects an oversized file without reading it", async () => {
    const huge = new File(["x"], "huge.png");
    Object.defineProperty(huge, "size", { value: MAX_IMAGE_BYTES + 1 });
    const importBytes = vi.fn();

    const results = await importFilesInTurn([huge], importBytes);
    expect(importBytes).not.toHaveBeenCalled();
    expect(results).toEqual([{ status: "error", kind: "tooLarge", name: "huge.png" }]);
  });
});

describe("mediaUrl", () => {
  it("is unknown until the library is loaded", () => {
    expect(mediaUrl({ dir: null, items: {} }, "a", "full")).toBeNull();
  });
});
