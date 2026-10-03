import { expect, test } from "./support/ipc";

test("app loads and shows its name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vision Board" })).toBeVisible();
});

test("IPC calls reach the mocked backend", async ({ page }) => {
  await page.goto("/");
  const version = await page.evaluate(() => {
    const internals = (
      window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<string> } }
    ).__TAURI_INTERNALS__;
    return internals.invoke("app_version");
  });
  expect(version).toBe("0.0.0-e2e");
});
