import { test as base, type Page } from "@playwright/test";
import type { BoardOp, Item, Media } from "../../src/lib/bindings";

/** Return values of mocked Rust commands, keyed by command name as invoked (snake_case). */
export type IpcHandlers = Record<string, unknown>;

const BOARD_STORAGE_KEY = "__e2e_board_items__";
const MEDIA_STORAGE_KEY = "__e2e_media__";

const defaultHandlers: IpcHandlers = {
  app_version: "0.0.0-e2e",
  entitlements_get: [
    { feature: "premiumFrames", enabled: true },
    { feature: "wallpaper", enabled: true },
    { feature: "scheduledPopup", enabled: true },
  ],
};

interface MockOptions {
  /** Static responses; override the built-in backends for the same command. */
  handlers: IpcHandlers;
  /** Items and media to start with. Applied only when the page has no stored board yet, so a
   *  reload keeps whatever the test changed (that is how E2E simulates an app restart). */
  seedItems: Item[];
  seedMedia: Media[];
}

/**
 * Installs a fake `window.__TAURI_INTERNALS__` before the app loads, so the frontend runs in a
 * plain browser:
 * - board and media commands are backed by localStorage,
 * - Tauri events work (`window.__E2E_EMIT__(event, payload)` fires them),
 * - other commands answer from `handlers`; unknown commands reject like unregistered ones.
 *
 * Mock media "import" accepts any file whose name does not end in .pdf and reports it as an
 * 800×600 image; image URLs resolve to an inline SVG.
 */
export async function mockIpc(page: Page, options: Partial<MockOptions> = {}) {
  const { handlers = {}, seedItems = [], seedMedia = [] } = options;
  await page.addInitScript(
    ({ responses, seed, keys }) => {
      const calls: { cmd: string; args: unknown }[] = [];
      if (localStorage.getItem(keys.board) === null) {
        localStorage.setItem(keys.board, JSON.stringify(seed.items));
        localStorage.setItem(keys.media, JSON.stringify(seed.media));
      }
      const read = <T>(key: string): T[] => JSON.parse(localStorage.getItem(key) ?? "[]");
      const write = (key: string, value: unknown) =>
        localStorage.setItem(key, JSON.stringify(value));

      let nextMedia = 0;
      const newMedia = (): Media => {
        const id = `media-${Date.now()}-${nextMedia++}`;
        const media = {
          id,
          fileName: `${id}.webp`,
          thumbName: `${id}_t.webp`,
          width: 800,
          height: 600,
          bytes: 1000,
        };
        write(keys.media, [...read<Media>(keys.media), media]);
        return media;
      };

      const backend: Record<string, (args: Record<string, unknown>) => unknown> = {
        board_load: () => ({
          id: "default",
          items: read<Item>(keys.board).sort((a, b) => a.z - b.z),
        }),
        board_apply_ops: ({ ops }) => {
          const items = new Map(read<Item>(keys.board).map((item) => [item.id, item]));
          for (const op of ops as BoardOp[]) {
            if (op.op === "upsert") items.set(op.item.id, op.item);
            else items.delete(op.id);
          }
          write(keys.board, [...items.values()]);
          return null;
        },
        media_list: () => ({ dir: "C:\\e2e\\media", items: read<Media>(keys.media) }),
        media_import_paths: ({ paths }) =>
          (paths as string[]).map((path) => {
            const name = path.split(/[\\/]/).pop() ?? path;
            return name.toLowerCase().endsWith(".pdf")
              ? { status: "error", kind: "unsupported", name }
              : { status: "ok", media: newMedia() };
          }),
        media_import_bytes: () => ({ status: "ok", media: newMedia() }),
      };

      // Minimal Tauri event system, enough for listen/unlisten and emitting from tests.
      const callbacks = new Map<number, (data: unknown) => void>();
      const listeners = new Map<string, number[]>();
      let nextCallback = 1;
      const events: Record<string, (args: Record<string, unknown>) => unknown> = {
        "plugin:event|listen": ({ event, handler }) => {
          const name = event as string;
          listeners.set(name, [...(listeners.get(name) ?? []), handler as number]);
          return handler;
        },
        "plugin:event|unlisten": ({ event, eventId }) => {
          const name = event as string;
          listeners.set(
            name,
            (listeners.get(name) ?? []).filter((id) => id !== eventId),
          );
          return null;
        },
      };

      const svg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#c9a27a"/><stop offset="1" stop-color="#5b6d8a"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>',
      );

      Object.assign(window, {
        __E2E_IPC_CALLS__: calls,
        __E2E_EMIT__: (event: string, payload: unknown) => {
          for (const id of listeners.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
        __TAURI_INTERNALS__: {
          metadata: { currentWindow: { label: "board" }, currentWebview: { label: "board" } },
          transformCallback: (callback: (data: unknown) => void) => {
            const id = nextCallback++;
            callbacks.set(id, callback);
            return id;
          },
          unregisterCallback: (id: number) => callbacks.delete(id),
          convertFileSrc: () => `data:image/svg+xml,${svg}`,
          invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
            calls.push({ cmd, args });
            if (cmd in responses) return responses[cmd];
            if (cmd in events) return events[cmd](args);
            if (cmd in backend) return backend[cmd](args);
            throw new Error(`Command ${cmd} not mocked`);
          },
        },
      });
    },
    {
      responses: { ...defaultHandlers, ...handlers },
      seed: { items: seedItems, media: seedMedia },
      keys: { board: BOARD_STORAGE_KEY, media: MEDIA_STORAGE_KEY },
    },
  );
}

/** Items currently stored by the mocked backend. */
export async function storedItems(page: Page): Promise<Item[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), BOARD_STORAGE_KEY);
}

/** Fires a Tauri event in the page, as the Rust side would. */
export async function emitTauriEvent(page: Page, event: string, payload: unknown) {
  await page.evaluate(
    ([e, p]) =>
      (window as unknown as { __E2E_EMIT__: (e: string, p: unknown) => void }).__E2E_EMIT__(e, p),
    [event, payload] as const,
  );
}

/** Board contents to start with. An object, because Playwright reads an array option value as
 *  a [value, options] tuple. */
export interface BoardSeed {
  items: Item[];
  media?: Media[];
}

export const test = base.extend<{ ipc: IpcHandlers; board: BoardSeed }>({
  ipc: [{}, { option: true }],
  board: [{ items: [] }, { option: true }],
  page: async ({ page, ipc, board }, use) => {
    await mockIpc(page, { handlers: ipc, seedItems: board.items, seedMedia: board.media ?? [] });
    await use(page);
  },
});

export { expect } from "@playwright/test";
