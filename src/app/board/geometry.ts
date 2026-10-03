/** Logical canvas size; item geometry is stored in these units (see domain/board.rs). */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const MAX_ROTATION = 15;
/** Smallest item edge, so handles stay usable. */
export const MIN_ITEM_SIZE = 48;
/** Share of an item's area that must stay on the canvas. */
export const MIN_VISIBLE_AREA = 0.1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** How the logical canvas maps onto a viewport: uniform scale, centered (letterboxed). */
export interface Fit {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function fitCanvas(viewportWidth: number, viewportHeight: number): Fit {
  const scale = Math.max(0, Math.min(viewportWidth / CANVAS_WIDTH, viewportHeight / CANVAS_HEIGHT));
  return {
    scale,
    offsetX: (viewportWidth - CANVAS_WIDTH * scale) / 2,
    offsetY: (viewportHeight - CANVAS_HEIGHT * scale) / 2,
  };
}

/** Converts a point in viewport pixels (relative to the viewport's top-left) to canvas units. */
export function viewportToCanvas(point: Point, fit: Fit): Point {
  if (fit.scale === 0) return { x: 0, y: 0 };
  return { x: (point.x - fit.offsetX) / fit.scale, y: (point.y - fit.offsetY) / fit.scale };
}

/**
 * Moves a rect the least amount needed so that at least MIN_VISIBLE_AREA of it overlaps the
 * canvas. Keeping √10 % of each axis on the canvas guarantees 10 % of the area even when the
 * rect hangs off a corner.
 */
export function keepOnCanvas<T extends Rect>(rect: T): T {
  const share = Math.sqrt(MIN_VISIBLE_AREA);
  const x = clamp(rect.x, -(1 - share) * rect.w, CANVAS_WIDTH - share * rect.w);
  const y = clamp(rect.y, -(1 - share) * rect.h, CANVAS_HEIGHT - share * rect.h);
  return x === rect.x && y === rect.y ? rect : { ...rect, x, y };
}

export type Corner = "nw" | "ne" | "sw" | "se";

/**
 * Resizes a rect by dragging one corner, keeping its aspect ratio and pinning the opposite
 * corner. The scale follows the drag projected onto the rect's diagonal, so the corner tracks
 * the pointer naturally in every direction.
 */
export function resizeFromCorner<T extends Rect>(
  rect: T,
  corner: Corner,
  dx: number,
  dy: number,
): T {
  const signX = corner === "ne" || corner === "se" ? 1 : -1;
  const signY = corner === "sw" || corner === "se" ? 1 : -1;
  const diagonal = Math.hypot(rect.w, rect.h);
  const growth = (dx * signX * rect.w + dy * signY * rect.h) / diagonal;
  const minScale = MIN_ITEM_SIZE / Math.min(rect.w, rect.h);
  const scale = Math.max(minScale, (diagonal + growth) / diagonal);
  const w = rect.w * scale;
  const h = rect.h * scale;
  return {
    ...rect,
    w,
    h,
    x: signX === 1 ? rect.x : rect.x + rect.w - w,
    y: signY === 1 ? rect.y : rect.y + rect.h - h,
  };
}

export function clampRotation(degrees: number): number {
  return clamp(degrees, -MAX_ROTATION, MAX_ROTATION);
}

/** Angle in degrees of `point` around `center`, 0° pointing straight up, clockwise positive. */
export function angleAround(center: Point, point: Point): number {
  return (Math.atan2(point.x - center.x, center.y - point.y) * 180) / Math.PI;
}

/** A rect of the given size centered on the canvas. */
export function centeredOnCanvas(w: number, h: number): Rect {
  return { x: (CANVAS_WIDTH - w) / 2, y: (CANVAS_HEIGHT - h) / 2, w, h };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
