import { test as base, type Page } from "@playwright/test";
import type { BoardOp, Item } from "../../src/lib/bindings";

/** Return values of mocked Rust commands, keyed by command name as invoked (snake_case). */
export type IpcHandlers = Record<string, unknown>;

const BOARD_STORAGE_KEY = "__e2e_board_items__";

const defaultHandlers: IpcHandlers = {
  app_version: "0.0.0-e2e",
};

interface MockOptions {
  /** Static responses; override the built-in board backend for the same command. */
  handlers: IpcHandlers;
  /** Items to start with. Applied only when the page has no stored board yet, so a reload
   *  keeps whatever the test changed (that is how E2E simulates an app restart). */
  seedItems: Item[];
}

/**
 * Installs a fake `window.__TAURI_INTERNALS__` before the app loads, so the frontend runs in a
 * plain browser. Board commands are backed by localStorage; other commands answer from
 * `handlers`. Unknown commands reject, the same way Tauri rejects unregistered commands.
 */
export async function mockIpc(page: Page, options: Partial<MockOptions> = {}) {
  const { handlers = {}, seedItems = [] } = options;
  await page.addInitScript(
    ({ responses, seed, storageKey }) => {
      const calls: { cmd: string; args: unknown }[] = [];
      if (localStorage.getItem(storageKey) === null) {
        localStorage.setItem(storageKey, JSON.stringify(seed));
      }
      const readItems = (): Item[] => JSON.parse(localStorage.getItem(storageKey) ?? "[]");

      const board: Record<string, (args: Record<string, unknown>) => unknown> = {
        board_load: () => ({
          id: "default",
          items: readItems().sort((a, b) => a.z - b.z),
        }),
        board_apply_ops: ({ ops }) => {
          const items = new Map(readItems().map((item) => [item.id, item]));
          for (const op of ops as BoardOp[]) {
            if (op.op === "upsert") items.set(op.item.id, op.item);
            else items.delete(op.id);
          }
          localStorage.setItem(storageKey, JSON.stringify([...items.values()]));
          return null;
        },
      };

      Object.assign(window, {
        __E2E_IPC_CALLS__: calls,
        __TAURI_INTERNALS__: {
          metadata: { currentWindow: { label: "board" }, currentWebview: { label: "board" } },
          transformCallback: () => 0,
          convertFileSrc: (path: string) => `/e2e-media/${path}`,
          invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
            calls.push({ cmd, args });
            if (cmd in responses) return responses[cmd];
            if (cmd in board) return board[cmd](args);
            throw new Error(`Command ${cmd} not mocked`);
          },
        },
      });
    },
    {
      responses: { ...defaultHandlers, ...handlers },
      seed: seedItems,
      storageKey: BOARD_STORAGE_KEY,
    },
  );
}

/** Items currently stored by the mocked backend. */
export async function storedItems(page: Page): Promise<Item[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), BOARD_STORAGE_KEY);
}

export const test = base.extend<{ ipc: IpcHandlers; seedItems: Item[] }>({
  ipc: [{}, { option: true }],
  seedItems: [[], { option: true }],
  page: async ({ page, ipc, seedItems }, use) => {
    await mockIpc(page, { handlers: ipc, seedItems });
    await use(page);
  },
});

export { expect } from "@playwright/test";
