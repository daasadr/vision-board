import { useCallback } from "react";
import { ipc } from "../../lib/ipc";
import { HotspotContext } from "../board/hotspotContext";
import { BoardView } from "../popup/BoardView";

/** The wallpaper cannot be clicked, so it shows no hotspots. */
const NO_HOTSPOTS = { mode: "hidden", onActivate: () => {} } as const;

/**
 * Draws the board edge to edge in the off-screen window the backend snapshots for the
 * wallpaper. Nobody sees this window; it exists for a second or two.
 */
export default function WallpaperApp() {
  const ready = useCallback(() => void ipc.wallpaperRendered(), []);
  return (
    <main style={{ height: "100%" }}>
      <HotspotContext.Provider value={NO_HOTSPOTS}>
        <BoardView flat onReady={ready} />
      </HotspotContext.Provider>
    </main>
  );
}
