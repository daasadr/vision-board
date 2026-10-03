import { describe, expect, it } from "vitest";
import { formatDate, formatTime } from "./format";

const afternoon = new Date(2026, 8, 26, 14, 30);

describe("formatTime", () => {
  it("uses the 24-hour clock in German and Czech", () => {
    expect(formatTime(afternoon, "de")).toBe("14:30");
    expect(formatTime(afternoon, "cs")).toBe("14:30");
  });

  it("uses the 12-hour clock in English", () => {
    expect(formatTime(afternoon, "en")).toMatch(/^2:30\sPM$/);
  });
});

describe("formatDate", () => {
  it("follows each language's date convention", () => {
    expect(formatDate(afternoon, "cs")).toBe("26. 9. 2026");
    expect(formatDate(afternoon, "de")).toBe("26.9.2026");
    expect(formatDate(afternoon, "en")).toBe("9/26/2026");
  });
});
