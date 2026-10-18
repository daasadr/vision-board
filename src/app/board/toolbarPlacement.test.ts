import { describe, expect, it } from "vitest";
import { placeToolbar, TOOLBAR_MARGIN } from "./toolbarPlacement";

const viewport = { width: 800, height: 600 };
const toolbar = { width: 500, height: 40 };
const GAP = 96;

describe("placeToolbar", () => {
  it("centres the toolbar above an item in the middle", () => {
    const item = { x: 300, y: 300, w: 200, h: 100 };
    expect(placeToolbar(item, viewport, toolbar, GAP)).toEqual({ x: 150, y: 204 });
  });

  it("stays inside at the left and right edges", () => {
    const left = { x: 0, y: 300, w: 100, h: 100 };
    expect(placeToolbar(left, viewport, toolbar, GAP).x).toBe(TOOLBAR_MARGIN);
    const right = { x: 700, y: 300, w: 100, h: 100 };
    expect(placeToolbar(right, viewport, toolbar, GAP).x).toBe(800 - 500 - TOOLBAR_MARGIN);
  });

  it("goes below an item at the top", () => {
    const item = { x: 300, y: 20, w: 200, h: 100 };
    expect(placeToolbar(item, viewport, toolbar, GAP).y).toBe(20 + 100 + GAP / 3);
  });

  it("goes inside an item that fills the height", () => {
    const item = { x: 300, y: 10, w: 200, h: 580 };
    const { y } = placeToolbar(item, viewport, toolbar, GAP);
    expect(y).toBe(10 + TOOLBAR_MARGIN);
    expect(y + toolbar.height).toBeLessThanOrEqual(viewport.height);
  });

  it("keeps the start visible when the toolbar is wider than the window", () => {
    const item = { x: 300, y: 300, w: 200, h: 100 };
    const narrow = { width: 400, height: 600 };
    expect(placeToolbar(item, narrow, toolbar, GAP).x).toBe(TOOLBAR_MARGIN);
  });
});
