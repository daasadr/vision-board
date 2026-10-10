import { describe, expect, it, vi } from "vitest";
import type { Task, TaskOp } from "./ipc";
import { addDays, createTaskStore, dayOf, tasksOfDay } from "./tasks";

/** An in-memory backend with the same rules as domain::tasks. */
function fakeBackend(initial: Task[] = []) {
  let stored = [...initial];
  return {
    listTasks: vi.fn(async (from: string, to: string) =>
      stored.filter((t) => t.day >= from && t.day <= to),
    ),
    unfinishedTasks: vi.fn(async (day: string) => stored.filter((t) => t.day < day && !t.done)),
    applyTasks: vi.fn(async (ops: TaskOp[]) => {
      for (const op of ops) {
        stored = stored.filter((t) => t.id !== (op.op === "upsert" ? op.task.id : op.id));
        if (op.op === "upsert") stored.push(op.task);
      }
    }),
    stored: () => stored,
  };
}

const evening = () => new Date(2026, 9, 10, 21, 30);
const task = (id: string, day: string, position: number, done = false): Task => ({
  id,
  day,
  text: `Úkol ${id}`,
  done,
  position,
});

describe("days", () => {
  it("formats and shifts local days", () => {
    expect(dayOf(evening())).toBe("2026-10-10");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("task store", () => {
  it("plans tasks for tomorrow in the order they were added", async () => {
    const backend = fakeBackend();
    const store = createTaskStore(backend, evening);
    await store.getState().load();
    for (const text of ["Zavolat", "Napsat", "Běhat"]) store.getState().add("2026-10-11", text);

    const tomorrow = tasksOfDay(store.getState().tasks, "2026-10-11");
    expect(tomorrow.map((t) => t.text)).toEqual(["Zavolat", "Napsat", "Běhat"]);
    await vi.waitFor(() => expect(backend.stored()).toHaveLength(3));
  });

  it("checks, edits, reorders and removes", async () => {
    const backend = fakeBackend([task("a", "2026-10-10", 0), task("b", "2026-10-10", 1)]);
    const store = createTaskStore(backend, evening);
    await store.getState().load();
    const s = () => store.getState();

    s().toggle("a");
    s().edit("b", "  Nový text  ");
    s().move("b", -1);
    expect(tasksOfDay(s().tasks, "2026-10-10").map((t) => [t.id, t.done, t.text])).toEqual([
      ["b", false, "Nový text"],
      ["a", true, "Úkol a"],
    ]);
    s().remove("a");
    expect(s().tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("offers yesterday's unfinished tasks and moves them to today", async () => {
    const backend = fakeBackend([
      task("y1", "2026-10-09", 0),
      task("y2", "2026-10-09", 1),
      task("done", "2026-10-09", 2, true),
      task("t1", "2026-10-10", 0),
    ]);
    const store = createTaskStore(backend, evening);
    await store.getState().load();
    expect(store.getState().leftover.map((t) => t.id)).toEqual(["y1", "y2"]);

    store.getState().moveLeftoverToToday();
    expect(store.getState().leftover).toEqual([]);
    expect(tasksOfDay(store.getState().tasks, "2026-10-10").map((t) => t.id)).toEqual([
      "t1",
      "y1",
      "y2",
    ]);
  });

  it("drops unfinished tasks when asked", async () => {
    const backend = fakeBackend([task("y1", "2026-10-09", 0)]);
    const store = createTaskStore(backend, evening);
    await store.getState().load();
    store.getState().dropLeftover();
    await vi.waitFor(() => expect(backend.stored()).toEqual([]));
  });

  it("ignores empty text and cuts it to 200 characters", async () => {
    const store = createTaskStore(fakeBackend(), evening);
    await store.getState().load();
    store.getState().add("2026-10-11", "   ");
    store.getState().add("2026-10-11", "x".repeat(250));
    expect(store.getState().tasks.map((t) => t.text.length)).toEqual([200]);
  });
});
