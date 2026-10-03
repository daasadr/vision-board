import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardOp, Item } from "../../lib/ipc";
import { createSaver } from "./saver";

const item = (id: string, x: number): Item => ({
  id,
  x,
  y: 0,
  w: 100,
  h: 100,
  rotation: 0,
  z: 0,
  content: { kind: "text", text: "t", variant: "note" },
});
const move = (id: string, x: number): BoardOp => ({ op: "upsert", item: item(id, x) });

describe("saver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves 300 ms after edits stop", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const saver = createSaver(apply);
    saver.enqueue([move("a", 1)]);
    await vi.advanceTimersByTimeAsync(299);
    expect(apply).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(apply).toHaveBeenCalledWith([move("a", 1)]);
  });

  it("saves at most 1 s after the first edit even while edits continue", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const saver = createSaver(apply);
    for (let t = 0; t < 1000; t += 100) {
      saver.enqueue([move("a", t)]);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("collapses ops for the same item to the latest", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    const saver = createSaver(apply);
    saver.enqueue([move("a", 1), move("b", 1)]);
    saver.enqueue([move("a", 2), { op: "delete", id: "b" }]);
    await saver.flush();
    expect(apply).toHaveBeenCalledWith([move("a", 2), { op: "delete", id: "b" }]);
  });

  it("flush writes immediately and waits for the write", async () => {
    let resolve!: () => void;
    const apply = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const saver = createSaver(apply);
    saver.enqueue([move("a", 1)]);
    const done = saver.flush();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(saver.hasPending()).toBe(true);
    resolve();
    await done;
    expect(saver.hasPending()).toBe(false);
  });

  it("retries a failed save, letting newer edits win", async () => {
    const onError = vi.fn();
    const apply = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const saver = createSaver(apply, { onError });
    saver.enqueue([move("a", 1), move("b", 1)]);
    await saver.flush();
    expect(onError).toHaveBeenCalledOnce();

    saver.enqueue([move("a", 2)]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(apply).toHaveBeenLastCalledWith([move("a", 2), move("b", 1)]);
    expect(saver.hasPending()).toBe(false);
  });

  it("does nothing when there is nothing to save", async () => {
    const apply = vi.fn();
    await createSaver(apply).flush();
    expect(apply).not.toHaveBeenCalled();
  });
});
