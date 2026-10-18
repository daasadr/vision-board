import type { Point, Rect } from "./geometry";

/** Space kept between the toolbar and the edges of the board area, in screen pixels. */
export const TOOLBAR_MARGIN = 8;

/**
 * Where the toolbar of a selected item goes (its top-left corner, in screen pixels), so that
 * it is always fully visible: centred above the item, shifted sideways at the edges, below the
 * item when there is no room above, and inside the item's top when there is room for neither.
 *
 * `item` is the item's rectangle on screen, `gap` the space between the item top and the
 * toolbar top (it clears the rotate handle above the item).
 */
export function placeToolbar(
  item: Rect,
  viewport: { width: number; height: number },
  toolbar: { width: number; height: number },
  gap: number,
): Point {
  const maxX = viewport.width - toolbar.width - TOOLBAR_MARGIN;
  const maxY = viewport.height - toolbar.height - TOOLBAR_MARGIN;
  const x = clamp(item.x + item.w / 2 - toolbar.width / 2, TOOLBAR_MARGIN, maxX);

  const above = item.y - gap;
  const below = item.y + item.h + gap / 3;
  let y: number;
  if (above >= TOOLBAR_MARGIN) y = above;
  else if (below <= maxY) y = below;
  else y = clamp(item.y + TOOLBAR_MARGIN, TOOLBAR_MARGIN, maxY);
  return { x, y };
}

/** Like Math.min(Math.max(...)), but a range that is too small keeps the start visible. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
