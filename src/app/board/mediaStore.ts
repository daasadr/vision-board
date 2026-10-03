import { convertFileSrc } from "@tauri-apps/api/core";
import { createStore } from "zustand/vanilla";
import type { Media } from "../../lib/ipc";

export interface MediaState {
  dir: string | null;
  items: Record<string, Media>;
  setLibrary(dir: string, items: Media[]): void;
  add(media: Media): void;
}

export function createMediaStore() {
  return createStore<MediaState>()((set) => ({
    dir: null,
    items: {},
    setLibrary(dir, items) {
      set({ dir, items: Object.fromEntries(items.map((m) => [m.id, m])) });
    },
    add(media) {
      set((s) => ({ items: { ...s.items, [media.id]: media } }));
    },
  }));
}

export type MediaStore = ReturnType<typeof createMediaStore>;

/** Asset URL of a stored image, or null while the library is not loaded yet. */
export function mediaUrl(
  state: Pick<MediaState, "dir" | "items">,
  mediaId: string,
  variant: "full" | "thumb",
): string | null {
  const media = state.items[mediaId];
  if (!media || !state.dir) return null;
  const separator = state.dir.includes("\\") ? "\\" : "/";
  const name = variant === "full" ? media.fileName : media.thumbName;
  return convertFileSrc(`${state.dir}${separator}${name}`);
}
