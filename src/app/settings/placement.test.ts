import { describe, expect, it } from "vitest";
import type { Anchor } from "../../lib/ipc";
import { placementRect, type Box } from "./placement";

const AREA: Box = { x: 0, y: 0, width: 1920, height: 1080 };
const partial = (size: number, anchor: Anchor) => ({ mode: "partial" as const, size, anchor });
const box = (x: number, y: number, width: number, height: number): Box => ({
  x,
  y,
  width,
  height,
});

// The same cases as domain::placement tests in Rust.
describe("placementRect", () => {
  it("full screen is the whole area", () => {
    const area = box(1920, 40, 2560, 1400);
    expect(placementRect(area, { mode: "full", size: 60, anchor: "center" })).toEqual(area);
  });

  it("places a partial board at every anchor", () => {
    expect(placementRect(AREA, partial(40, "bottomRight"))).toEqual(box(1114, 610, 768, 432));
    expect(placementRect(AREA, partial(40, "topLeft"))).toEqual(box(38, 38, 768, 432));
    expect(placementRect(AREA, partial(40, "topRight"))).toEqual(box(1114, 38, 768, 432));
    expect(placementRect(AREA, partial(40, "bottomLeft"))).toEqual(box(38, 610, 768, 432));
    expect(placementRect(AREA, partial(50, "center"))).toEqual(box(480, 270, 960, 540));
  });

  it("offsets the board with its monitor", () => {
    expect(placementRect(box(1920, 0, 1920, 1080), partial(40, "topLeft"))).toEqual(
      box(1958, 38, 768, 432),
    );
  });

  it("limits a wide board by a short screen", () => {
    expect(placementRect(box(0, 0, 3440, 1400), partial(90, "center"))).toEqual(
      box(476, 0, 2488, 1400),
    );
  });
});
