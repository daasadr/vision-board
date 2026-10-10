import { describe, expect, it } from "vitest";
import { minutesToTime, parseLocal, timeToMinutes } from "./time";

describe("time of day", () => {
  it("converts between minutes and HH:MM", () => {
    expect(minutesToTime(8 * 60 + 5)).toBe("08:05");
    expect(minutesToTime(0)).toBe("00:00");
    expect(timeToMinutes("08:05")).toBe(485);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("rejects empty and impossible times", () => {
    expect(timeToMinutes("")).toBeNull();
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("12:60")).toBeNull();
  });

  it("reads the backend's local date-time", () => {
    const date = parseLocal("2026-10-09T08:30:00");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 9]);
    expect([date.getHours(), date.getMinutes()]).toEqual([8, 30]);
  });
});
