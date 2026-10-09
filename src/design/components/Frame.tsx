import type { CSSProperties, ReactNode } from "react";
import type { FrameStyle } from "../../lib/ipc";
import styles from "./Frame.module.css";

export interface FrameProps {
  frame: FrameStyle;
  /** Width of the framed area in its own units; frame borders scale with it. */
  width: number;
  children: ReactNode;
}

/**
 * Frames an image. The frame lives inside the given box, so switching frames never changes
 * an item's size; the image inside fills the remaining space (object-fit: cover).
 */
export function Frame({ frame, width, children }: FrameProps) {
  return (
    <div
      className={`${styles.frame} ${styles[frame]}`}
      style={{ "--frame-w": width } as CSSProperties}
      data-frame={frame}
    >
      {children}
    </div>
  );
}
