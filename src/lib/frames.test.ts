import { describe, expect, it } from "vitest";
import { effectiveFrame, isPremiumFrame } from "./frames";

describe("effectiveFrame", () => {
  it("uses the board default for images without their own frame", () => {
    expect(effectiveFrame(undefined, "polaroid", true)).toBe("polaroid");
    expect(effectiveFrame(null, "line", true)).toBe("line");
  });

  it("lets an image override the board default, also with no frame", () => {
    expect(effectiveFrame("none", "polaroid", true)).toBe("none");
    expect(effectiveFrame("passepartout", "none", true)).toBe("passepartout");
  });

  it("shows a premium frame as no frame without the entitlement", () => {
    expect(effectiveFrame("glass", "none", false)).toBe("none");
    expect(effectiveFrame(undefined, "polaroid", false)).toBe("none");
    expect(effectiveFrame("line", "polaroid", false)).toBe("line");
  });

  it("shows the stored frame while the entitlement is loading", () => {
    expect(effectiveFrame(undefined, "polaroid", null)).toBe("polaroid");
  });

  it("marks polaroid and glass as premium", () => {
    expect(isPremiumFrame("polaroid")).toBe(true);
    expect(isPremiumFrame("glass")).toBe(true);
    expect(isPremiumFrame("passepartout")).toBe(false);
  });
});
