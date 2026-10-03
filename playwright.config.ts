import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A hung run must fail instead of holding the CI runner.
  globalTimeout: process.env.CI ? 10 * 60_000 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Czech UI by default (the app follows the browser language); tests can override it.
    locale: "cs-CZ",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Serves the production build (`pnpm e2e` builds it first) without Tauri; the Rust backend is
  // replaced by e2e/support/ipc.ts. Vite runs directly under node, not through pnpm or a shell
  // chain, so Playwright can stop it: otherwise teardown hangs on Linux CI.
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
