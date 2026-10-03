import { describe, expect, it } from "vitest";
import {
  angleAround,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clampRotation,
  fitCanvas,
  keepOnCanvas,
  MIN_ITEM_SIZE,
  resizeFromCorner,
  viewportToCanvas,
} from "./geometry";

describe("fitCanvas", () => {
  it("scales to the limiting dimension and centers the rest", () => {
    expect(fitCanvas(960, 1000)).toEqual({ scale: 0.5, offsetX: 0, offsetY: 230 });
    expect(fitCanvas(3000, 1080)).toEqual({ scale: 1, offsetX: 540, offsetY: 0 });
  });

  it("keeps relative positions when the window shrinks", () => {
    const point = { x: 480, y: 270 };
    for (const [w, h] of [
      [1920, 1080],
      [960, 540],
      [700, 900],
    ]) {
      const fit = fitCanvas(w, h);
      const viewport = {
        x: point.x * fit.scale + fit.offsetX,
        y: point.y * fit.scale + fit.offsetY,
      };
      const back = viewportToCanvas(viewport, fit);
      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    }
  });

  it("handles a collapsed viewport", () => {
    expect(viewportToCanvas({ x: 10, y: 10 }, fitCanvas(0, 0))).toEqual({ x: 0, y: 0 });
  });
});

describe("keepOnCanvas", () => {
  const area = (r: { x: number; y: number; w: number; h: number }) => {
    const ow = Math.min(r.x + r.w, CANVAS_WIDTH) - Math.max(r.x, 0);
    const oh = Math.min(r.y + r.h, CANVAS_HEIGHT) - Math.max(r.y, 0);
    return (Math.max(0, ow) * Math.max(0, oh)) / (r.w * r.h);
  };

  it("leaves an item that is on the canvas alone", () => {
    const rect = { x: 100, y: 100, w: 300, h: 200 };
    expect(keepOnCanvas(rect)).toBe(rect);
  });

  it("pulls an item dropped completely off the canvas back to 10 % visible", () => {
    for (const rect of [
      { x: 5000, y: 300, w: 300, h: 200 },
      { x: -900, y: -900, w: 300, h: 200 },
      { x: 2500, y: 2000, w: 400, h: 400 },
    ]) {
      const kept = keepOnCanvas(rect);
      expect(area(kept)).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(area(kept)).toBeLessThan(0.5);
    }
  });

  it("keeps extra fields", () => {
    expect(keepOnCanvas({ id: "a", x: 9999, y: 0, w: 100, h: 100 }).id).toBe("a");
  });
});

describe("resizeFromCorner", () => {
  const rect = { x: 100, y: 100, w: 400, h: 200 };

  it("keeps the aspect ratio", () => {
    const r = resizeFromCorner(rect, "se", 200, 0);
    expect(r.w / r.h).toBeCloseTo(2);
    expect(r.w).toBeGreaterThan(rect.w);
  });

  it("pins the opposite corner", () => {
    const r = resizeFromCorner(rect, "nw", -100, -50);
    expect(r.x + r.w).toBeCloseTo(rect.x + rect.w);
    expect(r.y + r.h).toBeCloseTo(rect.y + rect.h);
    expect(r.w).toBeGreaterThan(rect.w);
  });

  it("shrinks when dragging inwards but not below the minimum size", () => {
    expect(resizeFromCorner(rect, "se", -100, -50).w).toBeLessThan(rect.w);
    const tiny = resizeFromCorner(rect, "se", -5000, -5000);
    expect(Math.min(tiny.w, tiny.h)).toBeCloseTo(MIN_ITEM_SIZE);
  });
});

describe("rotation", () => {
  it("is limited to ±15°", () => {
    expect(clampRotation(40)).toBe(15);
    expect(clampRotation(-40)).toBe(-15);
    expect(clampRotation(7)).toBe(7);
  });

  it("measures angles clockwise from straight up", () => {
    const c = { x: 0, y: 0 };
    expect(angleAround(c, { x: 0, y: -10 })).toBeCloseTo(0);
    expect(angleAround(c, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(angleAround(c, { x: -10, y: 0 })).toBeCloseTo(-90);
  });
});
