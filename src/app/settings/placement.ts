import type { Placement } from "../../lib/ipc";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Gap between a partial board and the screen edge, in thousandths of the screen width. */
const MARGIN_PER_MILLE = 20;

/**
 * The part of a screen the board occupies, for the settings preview. Mirrors
 * `domain::placement::rect_in` in Rust (same test cases), including its integer rounding.
 */
export function placementRect(area: Box, placement: Placement): Box {
  if (placement.mode === "full") return area;
  let width = Math.floor((area.width * Math.min(placement.size, 100)) / 100);
  let height = Math.floor((width * 9) / 16);
  if (height > area.height) {
    height = area.height;
    width = Math.floor((height * 16) / 9);
  }
  const margin = Math.floor((area.width * MARGIN_PER_MILLE) / 1000);
  const freeX = area.width - width;
  const freeY = area.height - height;
  const near = (free: number) => Math.min(margin, free);
  const far = (free: number) => Math.max(free - margin, 0);
  const [dx, dy] = {
    center: [Math.floor(freeX / 2), Math.floor(freeY / 2)],
    topLeft: [near(freeX), near(freeY)],
    topRight: [far(freeX), near(freeY)],
    bottomLeft: [near(freeX), far(freeY)],
    bottomRight: [far(freeX), far(freeY)],
  }[placement.anchor];
  return { x: area.x + dx, y: area.y + dy, width, height };
}
