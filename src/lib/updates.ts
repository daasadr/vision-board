import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { ipc, type AvailableUpdate, type UpdateStatus } from "./ipc";

/** Matches updates::UPDATE_AVAILABLE_EVENT in Rust. */
export const UPDATE_AVAILABLE_EVENT = "update://available";

/**
 * The running version and a newer one, if the backend found it: read once, then kept up to
 * date by the backend's event (a daily check may find a version while the window is open).
 * `null` until the first answer.
 */
export function useUpdateStatus(): [UpdateStatus | null, (status: UpdateStatus) => void] {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    ipc
      .updateStatus()
      .then((value) => !disposed && setStatus(value))
      .catch((error: unknown) => console.error("Reading the update status failed", error));
    listen<AvailableUpdate>(UPDATE_AVAILABLE_EVENT, (event) => {
      setStatus((current) => (current ? { ...current, available: event.payload } : current));
    })
      .then((fn) => (disposed ? fn() : (unlisten = fn)))
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  return [status, setStatus];
}
