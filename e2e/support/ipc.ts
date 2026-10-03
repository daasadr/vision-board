import { test as base, type Page } from "@playwright/test";

/** Return values of mocked Rust commands, keyed by command name as invoked (snake_case). */
export type IpcHandlers = Record<string, unknown>;

const defaultHandlers: IpcHandlers = {
  app_version: "0.0.0-e2e",
};

/**
 * Installs a fake `window.__TAURI_INTERNALS__` before the app loads, so the frontend runs in a
 * plain browser. Unknown commands reject, the same way Tauri rejects unregistered commands.
 */
export async function mockIpc(page: Page, handlers: IpcHandlers = {}) {
  await page.addInitScript(
    (responses: IpcHandlers) => {
      const calls: { cmd: string; args: unknown }[] = [];
      Object.assign(window, {
        __E2E_IPC_CALLS__: calls,
        __TAURI_INTERNALS__: {
          metadata: { currentWindow: { label: "board" }, currentWebview: { label: "board" } },
          transformCallback: () => 0,
          invoke: async (cmd: string, args: unknown) => {
            calls.push({ cmd, args });
            if (!(cmd in responses)) throw new Error(`Command ${cmd} not mocked`);
            return responses[cmd];
          },
        },
      });
    },
    { ...defaultHandlers, ...handlers },
  );
}

export const test = base.extend<{ ipc: IpcHandlers }>({
  ipc: [{}, { option: true }],
  page: async ({ page, ipc }, use) => {
    await mockIpc(page, ipc);
    await use(page);
  },
});

export { expect } from "@playwright/test";
