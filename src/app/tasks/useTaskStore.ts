import { useEffect, useState } from "react";
import { createTaskStore, followTaskChanges, type TaskStore } from "../../lib/tasks";

/**
 * A task store for this window: loaded at once and reloaded whenever any window changes the
 * tasks. `onLoaded` runs after the first load (the wallpaper waits for it before its snapshot).
 */
export function useTaskStore(onLoaded?: () => void): TaskStore {
  const [store] = useState(() => createTaskStore());
  useEffect(() => {
    void store
      .getState()
      .load()
      .catch((error: unknown) => console.error("Loading tasks failed", error))
      .finally(() => onLoaded?.());
    return followTaskChanges(store);
    // The callback only matters for the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);
  return store;
}
