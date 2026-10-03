import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { mediaUrl, type MediaStore } from "./mediaStore";
import type { Saver } from "./saver";
import type { BoardState, BoardStore } from "./store";

export interface BoardServices {
  store: BoardStore;
  saver: Saver;
  media: MediaStore;
}

export const BoardContext = createContext<BoardServices | null>(null);

export function useBoardServices(): BoardServices {
  const services = useContext(BoardContext);
  if (!services) throw new Error("useBoardServices must be used inside BoardContext");
  return services;
}

/** Subscribes to a slice of board state. */
export function useBoard<T>(selector: (state: BoardState) => T): T {
  return useStore(useBoardServices().store, selector);
}

/** Board actions; stable across renders. */
export function useBoardActions(): BoardState {
  return useBoardServices().store.getState();
}

/** Asset URL of a stored image; null until the media library has loaded. */
export function useMediaUrl(mediaId: string, variant: "full" | "thumb"): string | null {
  return useStore(useBoardServices().media, (s) => mediaUrl(s, mediaId, variant));
}
