import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { Saver } from "./saver";
import type { BoardState, BoardStore } from "./store";

export interface BoardServices {
  store: BoardStore;
  saver: Saver;
  /** URL of a stored image, or null while it is unknown. */
  mediaUrl: (mediaId: string, variant: "full" | "thumb") => string | null;
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
