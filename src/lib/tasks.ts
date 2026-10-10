import { listen } from "@tauri-apps/api/event";
import { createStore } from "zustand/vanilla";
import { ipc, type Task, type TaskOp } from "./ipc";

/** Matches preferences::TASKS_CHANGED_EVENT in Rust. */
export const TASKS_CHANGED_EVENT = "tasks://changed";

/** Most characters in a task (domain::tasks::MAX_TASK_LEN). */
export const MAX_TASK_LEN = 200;

/** A local calendar day as `YYYY-MM-DD`. */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayOf(new Date(y, m - 1, d + days));
}

export interface TaskState {
  today: string;
  tasks: Task[];
  /** Undone tasks of past days, offered to be moved to today or dropped. */
  leftover: Task[];
  loaded: boolean;
  load(): Promise<void>;
  add(day: string, text: string): void;
  toggle(id: string): void;
  edit(id: string, text: string): void;
  remove(id: string): void;
  /** Moves a task one place up or down within its day. */
  move(id: string, step: -1 | 1): void;
  moveLeftoverToToday(): void;
  dropLeftover(): void;
}

function lastOf<T>(list: T[]): T | undefined {
  return list[list.length - 1];
}

export function tasksOfDay(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => t.day === day).sort((a, b) => a.position - b.position);
}

/**
 * Today's and tomorrow's tasks. Edits show at once and are stored right after; a failed store
 * reloads what the backend has. `now` is injectable for tests.
 */
export function createTaskStore(
  backend: Pick<typeof ipc, "listTasks" | "unfinishedTasks" | "applyTasks"> = ipc,
  now: () => Date = () => new Date(),
) {
  return createStore<TaskState>()((set, get) => {
    function store(ops: TaskOp[], tasks: Task[]) {
      set({ tasks });
      backend.applyTasks(ops).catch((error: unknown) => {
        console.error("Saving tasks failed", error);
        void get().load();
      });
    }

    function upsert(changed: Task[], remaining: Task[] = get().tasks) {
      const ids = new Set(changed.map((t) => t.id));
      store(
        changed.map((task) => ({ op: "upsert", task })),
        [...remaining.filter((t) => !ids.has(t.id)), ...changed],
      );
    }

    return {
      today: dayOf(now()),
      tasks: [],
      leftover: [],
      loaded: false,

      async load() {
        const today = dayOf(now());
        const [tasks, leftover] = await Promise.all([
          backend.listTasks(today, addDays(today, 1)),
          backend.unfinishedTasks(today),
        ]);
        set({ today, tasks, leftover, loaded: true });
      },

      add(day, text) {
        const trimmed = text.trim().slice(0, MAX_TASK_LEN);
        if (!trimmed) return;
        const last = lastOf(tasksOfDay(get().tasks, day));
        upsert([
          {
            id: crypto.randomUUID(),
            day,
            text: trimmed,
            done: false,
            position: (last?.position ?? -1) + 1,
          },
        ]);
      },

      toggle(id) {
        const task = get().tasks.find((t) => t.id === id);
        if (task) upsert([{ ...task, done: !task.done }]);
      },

      edit(id, text) {
        const task = get().tasks.find((t) => t.id === id);
        const trimmed = text.trim().slice(0, MAX_TASK_LEN);
        if (task && trimmed && trimmed !== task.text) upsert([{ ...task, text: trimmed }]);
      },

      remove(id) {
        store(
          [{ op: "delete", id }],
          get().tasks.filter((t) => t.id !== id),
        );
      },

      move(id, step) {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const day = tasksOfDay(get().tasks, task.day);
        const index = day.findIndex((t) => t.id === id);
        const other = day[index + step];
        if (!other) return;
        upsert([
          { ...task, position: other.position },
          { ...other, position: task.position },
        ]);
      },

      moveLeftoverToToday() {
        const { leftover, today, tasks } = get();
        const start = (lastOf(tasksOfDay(tasks, today))?.position ?? -1) + 1;
        const moved = leftover.map((t, i) => ({ ...t, day: today, position: start + i }));
        set({ leftover: [] });
        upsert(moved);
      },

      dropLeftover() {
        const { leftover, tasks } = get();
        set({ leftover: [] });
        store(
          leftover.map((t) => ({ op: "delete", id: t.id })),
          tasks,
        );
      },
    };
  });
}

export type TaskStore = ReturnType<typeof createTaskStore>;

/** Reloads the store whenever another window changed the tasks. */
export function followTaskChanges(store: TaskStore): () => void {
  let unlisten: (() => void) | undefined;
  let disposed = false;
  listen(TASKS_CHANGED_EVENT, () => void store.getState().load())
    .then((fn) => (disposed ? fn() : (unlisten = fn)))
    .catch(() => {});
  return () => {
    disposed = true;
    unlisten?.();
  };
}
