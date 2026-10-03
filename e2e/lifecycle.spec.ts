import type { Page } from "@playwright/test";
import { emitTauriEvent, expect, storedItems, test } from "./support/ipc";

type Call = { cmd: string; args: Record<string, unknown> };
const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __E2E_IPC_CALLS__: Call[] }).__E2E_IPC_CALLS__);

async function addQuote(page: Page, text: string) {
  await page.getByRole("button", { name: "Citát" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Citát" }).fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Přidat" }).click();
}

test.describe("first window close", () => {
  test.use({
    ipc: { app_flag_get: false, app_flag_set: null, "plugin:window|destroy": null },
  });

  test("explains that the app keeps running in the tray", async ({ page }) => {
    await page.goto("/");
    await emitTauriEvent(page, "tauri://close-requested", {});

    const notice = page.getByRole("dialog", { name: "Vision Board poběží dál" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Rozumím" }).click();
    await expect(notice).toBeHidden();

    await expect
      .poll(async () => (await calls(page)).map((c) => c.cmd))
      .toEqual(expect.arrayContaining(["app_flag_set", "plugin:window|destroy"]));
    const flag = (await calls(page)).find((c) => c.cmd === "app_flag_set");
    expect(flag?.args).toEqual({ flag: "trayNoticeShown" });
  });
});

test.describe("quit", () => {
  test.use({ ipc: { app_ready_to_quit: null } });

  test("saves pending edits before telling the backend it may quit", async ({ page }) => {
    await page.goto("/");
    await addQuote(page, "Nic se neztratí");
    // Quit right away, well within the 300 ms save delay.
    await emitTauriEvent(page, "app://quit-requested", null);

    await expect
      .poll(async () => (await calls(page)).map((c) => c.cmd))
      .toContain("app_ready_to_quit");
    const order = (await calls(page)).map((c) => c.cmd);
    expect(order.lastIndexOf("board_apply_ops")).toBeLessThan(order.indexOf("app_ready_to_quit"));
    expect((await storedItems(page)).map((i) => i.content)).toEqual([
      { kind: "quote", text: "Nic se neztratí", author: null },
    ]);
  });
});
