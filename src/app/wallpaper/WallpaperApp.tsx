import { useCallback, useEffect, useState } from "react";
import { ipc } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { HotspotContext } from "../board/hotspotContext";
import { BoardView } from "../popup/BoardView";
import { SplitView } from "../tasks/SplitView";
import { useTaskStore } from "../tasks/useTaskStore";
import { TaskList } from "../tasks/TaskList";

/** The wallpaper cannot be clicked, so it shows no hotspots. */
const NO_HOTSPOTS = { mode: "hidden", onActivate: () => {} } as const;

/**
 * Draws the board edge to edge (with read-only tasks in split view) in the off-screen window
 * the backend snapshots for the wallpaper. Nobody sees this window; it exists for a second or
 * two. The snapshot is taken once the board and the tasks are both drawn.
 */
export default function WallpaperApp() {
  const split = useSettings((s) => s.settings.split);
  const [boardReady, setBoardReady] = useState(false);
  const [tasksReady, setTasksReady] = useState(false);
  const tasks = useTaskStore(() => setTasksReady(true));
  const onBoardReady = useCallback(() => setBoardReady(true), []);

  useEffect(() => {
    if (boardReady && (tasksReady || !split.wallpaper)) {
      // One more frame, so the task list is painted too.
      requestAnimationFrame(() => void ipc.wallpaperRendered());
    }
  }, [boardReady, tasksReady, split.wallpaper]);

  const board = <BoardView flat onReady={onBoardReady} />;
  return (
    <main style={{ height: "100%" }}>
      <HotspotContext.Provider value={NO_HOTSPOTS}>
        {split.wallpaper ? (
          <SplitView
            side={split.side}
            board={board}
            tasks={<TaskList store={tasks} mode="read" />}
          />
        ) : (
          board
        )}
      </HotspotContext.Provider>
    </main>
  );
}
