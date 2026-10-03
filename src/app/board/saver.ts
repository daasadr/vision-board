import type { BoardOp } from "../../lib/ipc";

export interface SaverOptions {
  /** Save once edits pause for this long. */
  idleMs?: number;
  /** …but never later than this after the first unsaved edit. */
  maxDelayMs?: number;
  /** Wait before retrying a failed save. */
  retryMs?: number;
  onError?: (error: unknown) => void;
}

const opKey = (op: BoardOp) => (op.op === "upsert" ? op.item.id : op.id);

/**
 * Batches board edits and writes them with `apply`. Ops for the same item collapse to the
 * latest one, so a drag that touches an item many times is stored once. A failed batch is
 * kept and retried; newer ops for the same item win over the failed ones.
 */
export function createSaver(apply: (ops: BoardOp[]) => Promise<void>, options: SaverOptions = {}) {
  const { idleMs = 300, maxDelayMs = 1000, retryMs = 2000, onError } = options;
  let pending = new Map<string, BoardOp>();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  function clearTimers() {
    clearTimeout(idleTimer);
    clearTimeout(maxTimer);
    idleTimer = maxTimer = undefined;
  }

  function schedule(delay = idleMs) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void flush(), delay);
    maxTimer ??= setTimeout(() => void flush(), Math.max(delay, maxDelayMs));
  }

  async function flush(): Promise<void> {
    clearTimers();
    // One write at a time keeps batches in order.
    if (inFlight) await inFlight;
    if (pending.size === 0) return;

    const batch = pending;
    pending = new Map();
    inFlight = apply([...batch.values()])
      .catch((error: unknown) => {
        for (const [key, op] of batch) if (!pending.has(key)) pending.set(key, op);
        onError?.(error);
        schedule(retryMs);
      })
      .finally(() => {
        inFlight = undefined;
      });
    await inFlight;
  }

  return {
    enqueue(ops: BoardOp[]) {
      for (const op of ops) pending.set(opKey(op), op);
      if (ops.length > 0) schedule();
    },
    /** Writes everything now; resolves once nothing is pending or in flight. */
    flush,
    hasPending: () => pending.size > 0 || inFlight !== undefined,
  };
}

export type Saver = ReturnType<typeof createSaver>;
