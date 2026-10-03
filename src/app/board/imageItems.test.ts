import { describe, expect, it } from "vitest";
import type { Media } from "../../lib/ipc";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./geometry";
import { imageSize, newImageItems } from "./imageItems";
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

describe("mediaUrl", () => {
  it("is unknown until the library is loaded", () => {
    expect(mediaUrl({ dir: null, items: {} }, "a", "full")).toBeNull();
  });
});
