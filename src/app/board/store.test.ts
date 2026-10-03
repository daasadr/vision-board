import { describe, expect, it } from "vitest";
import type { BoardOp, Item } from "../../lib/ipc";
import { createBoardStore, HISTORY_LIMIT, itemsInOrder } from "./store";

function quote(id: string, z = 0, x = 100): Item {
  return {
    id,
    x,
    y: 100,
    w: 400,
    h: 160,
    rotation: 0,
    z,
    content: { kind: "quote", text: `Quote ${id}`, author: null },
  };
}

function setup(initial: Item[] = []) {
  const ops: BoardOp[][] = [];
  const store = createBoardStore((batch) => ops.push(batch));
  store.getState().load(initial);
  return { store, ops, state: () => store.getState() };
}

describe("board store", () => {
  it("loads items and orders them back to front", () => {
    const { state } = setup([quote("a", 2), quote("b", 0), quote("c", 1)]);
    expect(itemsInOrder(state()).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(state().loaded).toBe(true);
  });

  it("reports every edit as backend ops", () => {
    const { state, ops } = setup();
    state().add(quote("a"));
    state().update("a", { x: 500 });
    state().remove("a");
    expect(ops).toEqual([
      [{ op: "upsert", item: quote("a") }],
      [{ op: "upsert", item: quote("a", 0, 500) }],
      [{ op: "delete", id: "a" }],
    ]);
  });

  it("ignores edits that change nothing", () => {
    const { state, ops } = setup([quote("a")]);
    state().update("a", { x: 100 });
    state().update("missing", { x: 1 });
    expect(ops).toEqual([]);
    expect(state().past).toEqual([]);
  });

  // Every command type must round-trip through undo and redo.
  const commands: [name: string, run: (s: ReturnType<typeof setup>["state"]) => void][] = [
    ["add", (s) => s().add(quote("new", 5))],
    ["move", (s) => s().update("a", { x: 900, y: 400 })],
    ["resize", (s) => s().update("a", { w: 800, h: 320 })],
    ["rotate", (s) => s().update("a", { rotation: -12 })],
    [
      "edit text",
      (s) => s().update("a", { content: { kind: "quote", text: "New", author: "Me" } }),
    ],
    ["delete", (s) => s().remove("a")],
    ["bring to front", (s) => s().bringToFront("a")],
    ["send to back", (s) => s().sendToBack("b")],
  ];

  for (const [name, run] of commands) {
    it(`undoes and redoes "${name}"`, () => {
      const { state, ops } = setup([quote("a", 0), quote("b", 1)]);
      const initial = state().items;
      run(state);
      const edited = state().items;
      expect(edited).not.toEqual(initial);

      state().undo();
      expect(state().items).toEqual(initial);
      state().redo();
      expect(state().items).toEqual(edited);

      // The backend received the same sequence: edit, revert, re-apply.
      expect(ops).toHaveLength(3);
    });
  }

  it("restores a deleted item with its position, size and stacking order", () => {
    const { state } = setup([quote("a", 3, 700)]);
    state().remove("a");
    state().undo();
    expect(state().items.a).toEqual(quote("a", 3, 700));
  });

  it("a new edit clears the redo stack", () => {
    const { state } = setup([quote("a")]);
    state().update("a", { x: 1 });
    state().undo();
    state().update("a", { x: 2 });
    expect(state().future).toEqual([]);
    state().redo();
    expect(state().items.a.x).toBe(2);
  });

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    const { state } = setup([quote("a")]);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) state().update("a", { x: i });
    expect(state().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) state().undo();
    expect(state().items.a.x).toBe(10);
  });

  it("amend changes an item without an undo step", () => {
    const { state, ops } = setup([quote("a")]);
    state().amend("a", { h: 222 });
    expect(state().items.a.h).toBe(222);
    expect(state().past).toEqual([]);
    expect(ops).toHaveLength(1);
  });

  it("selects added items and deselects removed ones, including via undo", () => {
    const { state } = setup();
    state().add(quote("a"));
    expect(state().selectedId).toBe("a");
    state().undo();
    expect(state().selectedId).toBeNull();
    state().redo();
    state().select("a");
    state().remove("a");
    expect(state().selectedId).toBeNull();
  });

  it("bringing the front item forward is a no-op", () => {
    const { state, ops } = setup([quote("a", 0), quote("b", 1)]);
    state().bringToFront("b");
    state().sendToBack("a");
    expect(ops).toEqual([]);
  });
});
