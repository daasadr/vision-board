import { createStore } from "zustand/vanilla";
import type { BoardOp, Item } from "../../lib/ipc";

export const HISTORY_LIMIT = 50;

/** One item's state before and after an edit; null means "does not exist". */
export interface Change {
  id: string;
  before: Item | null;
  after: Item | null;
}

/** A user action as a list of item changes. Undo applies the `before` states, redo `after`. */
export type Command = Change[];

export interface BoardState {
  items: Record<string, Item>;
  selectedId: string | null;
  past: Command[];
  future: Command[];
  loaded: boolean;

  load(items: Item[]): void;
  select(id: string | null): void;
  add(item: Item): void;
  update(id: string, patch: Partial<Omit<Item, "id">>): void;
  remove(id: string): void;
  bringToFront(id: string): void;
  sendToBack(id: string): void;
  /** Corrects an item without an undo step, e.g. a measured text height. */
  amend(id: string, patch: Partial<Omit<Item, "id">>): void;
  undo(): void;
  redo(): void;
}

/** Items back to front. */
export function itemsInOrder(state: Pick<BoardState, "items">): Item[] {
  return Object.values(state.items).sort((a, b) => a.z - b.z);
}

export function topZ(state: Pick<BoardState, "items">): number {
  return Math.max(0, ...Object.values(state.items).map((i) => i.z));
}

function toOps(changes: Change[], pick: "before" | "after"): BoardOp[] {
  return changes.map((c) => {
    const item = c[pick];
    return item ? { op: "upsert", item } : { op: "delete", id: c.id };
  });
}

function applyTo(items: Record<string, Item>, changes: Change[], pick: "before" | "after") {
  const next = new Map(Object.entries(items));
  for (const change of changes) {
    const item = change[pick];
    if (item) next.set(change.id, item);
    else next.delete(change.id);
  }
  return Object.fromEntries(next);
}

/**
 * Board state with undo/redo. Every edit is reported to `persist` as backend ops; the store
 * itself never talks to the backend, which keeps it synchronous and easy to test.
 */
export function createBoardStore(persist: (ops: BoardOp[]) => void) {
  return createStore<BoardState>()((set, get) => {
    function commit(changes: Change[]) {
      const effective = changes.filter((c) => JSON.stringify(c.before) !== JSON.stringify(c.after));
      if (effective.length === 0) return;
      set((s) => ({
        items: applyTo(s.items, effective, "after"),
        past: [...s.past, effective].slice(-HISTORY_LIMIT),
        future: [],
      }));
      persist(toOps(effective, "after"));
    }

    function change(id: string, patch: Partial<Omit<Item, "id">>): Change | null {
      const before = get().items[id];
      return before ? { id, before, after: { ...before, ...patch } } : null;
    }

    return {
      items: {},
      selectedId: null,
      past: [],
      future: [],
      loaded: false,

      load(items) {
        set({
          items: Object.fromEntries(items.map((i) => [i.id, i])),
          selectedId: null,
          past: [],
          future: [],
          loaded: true,
        });
      },

      select(id) {
        set({ selectedId: id });
      },

      add(item) {
        commit([{ id: item.id, before: null, after: item }]);
        set({ selectedId: item.id });
      },

      update(id, patch) {
        const c = change(id, patch);
        if (c) commit([c]);
      },

      remove(id) {
        const before = get().items[id];
        if (!before) return;
        commit([{ id, before, after: null }]);
        if (get().selectedId === id) set({ selectedId: null });
      },

      bringToFront(id) {
        const item = get().items[id];
        if (!item || (item.z === topZ(get()) && countAtZ(get().items, item.z) === 1)) return;
        const c = change(id, { z: topZ(get()) + 1 });
        if (c) commit([c]);
      },

      sendToBack(id) {
        const item = get().items[id];
        if (!item) return;
        const bottom = Math.min(...Object.values(get().items).map((i) => i.z));
        if (item.z === bottom && countAtZ(get().items, item.z) === 1) return;
        const c = change(id, { z: bottom - 1 });
        if (c) commit([c]);
      },

      amend(id, patch) {
        const c = change(id, patch);
        if (!c) return;
        set((s) => ({ items: applyTo(s.items, [c], "after") }));
        persist(toOps([c], "after"));
      },

      undo() {
        const { past } = get();
        const command = past[past.length - 1];
        if (!command) return;
        set((s) => ({
          items: applyTo(s.items, command, "before"),
          past: s.past.slice(0, -1),
          future: [command, ...s.future],
          selectedId:
            s.selectedId && !command.some((c) => c.id === s.selectedId && !c.before)
              ? s.selectedId
              : null,
        }));
        persist(toOps(command, "before"));
      },

      redo() {
        const command = get().future[0];
        if (!command) return;
        set((s) => ({
          items: applyTo(s.items, command, "after"),
          past: [...s.past, command].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          selectedId:
            s.selectedId && !command.some((c) => c.id === s.selectedId && !c.after)
              ? s.selectedId
              : null,
        }));
        persist(toOps(command, "after"));
      },
    };
  });
}

function countAtZ(items: Record<string, Item>, z: number): number {
  return Object.values(items).filter((i) => i.z === z).length;
}

export type BoardStore = ReturnType<typeof createBoardStore>;
