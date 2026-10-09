import type { FrameStyle } from "./ipc";

export const FRAMES: readonly FrameStyle[] = ["none", "line", "passepartout", "polaroid", "glass"];

/** Frames that need the PremiumFrames entitlement. */
const PREMIUM: ReadonlySet<FrameStyle> = new Set(["polaroid", "glass"]);

export function isPremiumFrame(frame: FrameStyle): boolean {
  return PREMIUM.has(frame);
}

/**
 * The frame an image shows: its own, otherwise the board default. A premium frame without the
 * entitlement shows as no frame but stays stored, so it returns when the entitlement does.
 * While the entitlement is still loading (`null`) the stored frame shows, so boards do not
 * flicker on open.
 */
export function effectiveFrame(
  itemFrame: FrameStyle | null | undefined,
  boardFrame: FrameStyle,
  premium: boolean | null,
): FrameStyle {
  const frame = itemFrame ?? boardFrame;
  return isPremiumFrame(frame) && premium === false ? "none" : frame;
}
