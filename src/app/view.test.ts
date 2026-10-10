import { describe, expect, it } from "vitest";
import { viewFor } from "./view";

describe("viewFor", () => {
  it("picks the view by window label inside Tauri", () => {
    expect(viewFor("/", "settings")).toBe("settings");
    expect(viewFor("/", "control")).toBe("control");
    expect(viewFor("/", "board")).toBe("board");
    expect(viewFor("/", "popup-1")).toBe("popup");
  });

  it("picks the view by path in a browser", () => {
    expect(viewFor("/settings", null)).toBe("settings");
    expect(viewFor("/design/", "board")).toBe("design");
  });

  it("falls back to the board", () => {
    expect(viewFor("/", null)).toBe("board");
    expect(viewFor("/unknown", "wallpaper")).toBe("board");
  });
});
