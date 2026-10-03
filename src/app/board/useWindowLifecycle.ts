import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { ipc } from "../../lib/ipc";
import type { Saver } from "./saver";

/** Matches lifecycle::QUIT_REQUESTED_EVENT in Rust. */
const QUIT_REQUESTED_EVENT = "app://quit-requested";

/**
 * Keeps edits safe across window close and app quit:
 * - closing the window saves pending edits first; the very first close is held back to tell
 *   the user the app keeps running in the tray,
 * - Quit from the tray asks this window to save, then lets the app exit.
 */
export function useWindowLifecycle(saver: Saver) {
  const [trayNoticeOpen, setTrayNoticeOpen] = useState(false);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    let disposed = false;
    const keep = (unlisten: () => void) => (disposed ? unlisten() : cleanups.push(unlisten));

    try {
      getCurrentWindow()
        .onCloseRequested(async (event) => {
          await saver.flush();
          if (!(await ipc.flagIsSet("trayNoticeShown"))) {
            event.preventDefault();
            setTrayNoticeOpen(true);
          }
        })
        .then(keep)
        .catch(() => {});
      listen(QUIT_REQUESTED_EVENT, async () => {
        await saver.flush().catch(() => {});
        await ipc.readyToQuit();
      })
        .then(keep)
        .catch(() => {});
    } catch {
      // Not running inside Tauri (browser dev server, tests).
    }

    // Last resort when the page goes away without a close request (reload, crash recovery).
    const onPageHide = () => void saver.flush();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [saver]);

  /** The user acknowledged the tray notice: remember it and finish closing the window. */
  const acknowledgeTrayNotice = useCallback(async () => {
    setTrayNoticeOpen(false);
    await ipc.setFlag("trayNoticeShown");
    await getCurrentWindow().destroy();
  }, []);

  return { trayNoticeOpen, acknowledgeTrayNotice };
}
