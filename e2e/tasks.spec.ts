import type { Page } from "@playwright/test";
import type { Task } from "../src/lib/ipc";
import { expect, storedSettings, test } from "./support/ipc";

/** Saturday 10 October 2026, evening: "tomorrow" is the 11th. */
const EVENING = new Date(2026, 9, 10, 21, 0);

const storedTasks = (page: Page): Promise<Task[]> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("__e2e_tasks__") ?? "[]"));

const task = (id: string, day: string, text: string, done = false, position = 0): Task => ({
  id,
  day,
  text,
  done,
  position,
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(EVENING);
});

test.describe("split view in the board window", () => {
  test.use({ settings: { split: { board: true, popup: false, wallpaper: false, side: "left" } } });

  test("plans three steps for tomorrow in the evening", async ({ page }) => {
    await page.goto("/");
    const list = page.getByRole("complementary", { name: "Úkoly na dnes a zítra" });
    await expect(list).toBeVisible();
    const add = list.getByRole("textbox", { name: "Přidat úkol na Zítra" });
    for (const text of ["Zavolat do agentury", "Napsat plán", "Jít běhat"]) {
      await add.fill(text);
      await add.press("Enter");
    }
    await expect
      .poll(async () =>
        (await storedTasks(page))
          .sort((a, b) => a.position - b.position)
          .map((t) => [t.day, t.text]),
      )
      .toEqual([
        ["2026-10-11", "Zavolat do agentury"],
        ["2026-10-11", "Napsat plán"],
        ["2026-10-11", "Jít běhat"],
      ]);
  });

  test.describe("with tasks left from yesterday", () => {
    test.use({
      tasks: {
        items: [
          task("y1", "2026-10-09", "Odeslat přihlášku"),
          task("y2", "2026-10-09", "Koupit boty", false, 1),
          task("y3", "2026-10-09", "Hotovo včera", true, 2),
        ],
      },
    });

    test("offers to move the two unfinished ones to today", async ({ page }) => {
      await page.goto("/");
      const banner = page.getByText("Z minulých dnů zůstalo nedokončeno: 2. Přesunout na dnešek?");
      await expect(banner).toBeVisible();
      await page.getByRole("button", { name: "Přesunout na dnes" }).click();
      await expect(banner).toBeHidden();
      await expect
        .poll(async () =>
          (await storedTasks(page))
            .filter((t) => !t.done)
            .map((t) => t.day)
            .sort(),
        )
        .toEqual(["2026-10-10", "2026-10-10"]);
      await expect(page.getByRole("checkbox", { name: "Odeslat přihlášku" })).toBeVisible();
    });
  });
});

test.describe("tasks in the pop-up", () => {
  test.use({
    settings: { split: { board: false, popup: true, wallpaper: false, side: "right" } },
    tasks: { items: [task("t1", "2026-10-10", "Meditovat 10 minut")] },
  });

  test("can be ticked off", async ({ page }) => {
    await page.goto("/popup");
    await page.getByRole("checkbox", { name: "Meditovat 10 minut" }).check();
    await expect.poll(async () => (await storedTasks(page))[0].done).toBe(true);
    // No editing in the pop-up.
    await expect(page.getByRole("textbox", { name: /Přidat úkol/ })).toHaveCount(0);
  });
});

test.describe("tasks on the wallpaper", () => {
  test.use({
    settings: { split: { board: false, popup: false, wallpaper: true, side: "left" } },
    tasks: { items: [task("t1", "2026-10-10", "Meditovat 10 minut")] },
  });

  test("are shown without any controls before the snapshot", async ({ page }) => {
    await page.goto("/wallpaper");
    await expect(page.getByText("Meditovat 10 minut")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { __E2E_IPC_CALLS__: { cmd: string }[] }).__E2E_IPC_CALLS__.some(
            (c) => c.cmd === "wallpaper_rendered",
          ),
        ),
      )
      .toBe(true);
  });
});

test("split view is set per place in the settings", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Zobrazení" }).click();
  await page.getByRole("switch", { name: "V okně nástěnky" }).click();
  await page.getByRole("switch", { name: "Na tapetě (jen ke čtení)" }).click();
  await page.getByRole("radio", { name: "Vpravo" }).check();
  await expect
    .poll(async () => (await storedSettings(page)).split)
    .toEqual({ board: true, popup: false, wallpaper: true, side: "right" });
});
