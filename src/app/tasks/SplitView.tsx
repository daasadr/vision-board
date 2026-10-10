import type { ReactNode } from "react";
import type { SplitSide } from "../../lib/ipc";
import styles from "./SplitView.module.css";

/** Board and tasks side by side; the board takes the larger part on the chosen side. */
export function SplitView({
  side,
  board,
  tasks,
}: {
  side: SplitSide;
  board: ReactNode;
  tasks: ReactNode;
}) {
  return (
    <div className={`${styles.split} ${side === "right" ? styles.boardRight : ""}`}>
      <div className={styles.board}>{board}</div>
      <div className={styles.tasks}>{tasks}</div>
    </div>
  );
}
