import { useCallback } from "react";
import { ipc } from "../../lib/ipc";
import { BoardView } from "../popup/BoardView";

/**
 * Draws the board edge to edge in the off-screen window the backend snapshots for the
 * wallpaper. Nobody sees this window; it exists for a second or two.
 */
export default function WallpaperApp() {
  const ready = useCallback(() => void ipc.wallpaperRendered(), []);
  return (
    <main style={{ height: "100%" }}>
      <BoardView flat onReady={ready} />
    </main>
  );
}
