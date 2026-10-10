import { createContext, useContext } from "react";
import { ipc, type Hotspot, type Item } from "../../lib/ipc";

/** Most hotspots on one image (domain::board::MAX_HOTSPOTS). */
export const MAX_HOTSPOTS = 5;

/** Editing callbacks of the board window while one image's hotspots are being edited. */
export interface HotspotEditing {
  itemId: string;
  onAdd: (item: Item, x: number, y: number) => void;
  onEdit: (item: Item, hotspot: Hotspot) => void;
  onMove: (item: Item, hotspotId: string, x: number, y: number) => void;
}

/**
 * How hotspots behave where the board is shown: `active` (board window, pop-up: a click opens
 * the link or the detail) or `hidden` (wallpaper). In the board window `editing` turns one
 * image's hotspots into an editor.
 */
export interface HotspotBehavior {
  mode: "active" | "hidden";
  onActivate: (item: Item, hotspot: Hotspot) => void;
  editing?: HotspotEditing | null;
}

/** Opens the link in the browser or the detail window. */
export function activateHotspot(item: Item, hotspot: Hotspot) {
  if (hotspot.action.kind === "link") void ipc.openLink(hotspot.action.url);
  else void ipc.openDetail(item.id, hotspot.id);
}

export const HotspotContext = createContext<HotspotBehavior>({
  mode: "active",
  onActivate: activateHotspot,
});

export function useHotspots(): HotspotBehavior {
  return useContext(HotspotContext);
}
