import type { Item } from "../src/lib/bindings";
import { expect, storedItems, test } from "./support/ipc";

const quote: Item = {
  id: "q1",
  x: 100,
  y: 200,
  w: 400,
  h: 160,
  rotation: 0,
  z: 0,
  content: { kind: "quote", text: "Cíl bez plánu je jen přání.", author: null },
};

test.describe("board backend mock", () => {
  test.use({ board: { items: [quote] } });

  test("loads seeded items and keeps edits across a reload", async ({ page }) => {
    // /design does not load the board, so the app cannot write to the mock behind our back.
    await page.goto("/design");
    const invoke = (cmd: string, args?: unknown) =>
      page.evaluate(
        ([c, a]) =>
          (
            window as unknown as {
              __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
            }
          ).__TAURI_INTERNALS__.invoke(c as string, a),
        [cmd, args] as const,
      );

    expect(await invoke("board_load")).toEqual({ id: "default", items: [quote] });

    await invoke("board_apply_ops", {
      ops: [{ op: "upsert", item: { ...quote, x: 900 } }],
    });
    await page.reload();

    expect(await storedItems(page)).toEqual([{ ...quote, x: 900 }]);
  });
});
