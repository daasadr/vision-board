import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

/**
 * Renders the control widget (src/app/control, the design source) to the PNGs the native
 * Windows widget shows: `pnpm control:render`. Run it after changing the widget's look.
 */
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "render-control.spec.ts",
  reporter: "list",
  projects: [{ name: "render" }],
  // Paths in the base config are relative to the project root.
  webServer: { ...base.webServer, cwd: ".." } as typeof base.webServer,
});
