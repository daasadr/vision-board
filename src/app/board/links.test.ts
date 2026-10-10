import { describe, expect, it } from "vitest";
import { isWebLink } from "./links";

describe("isWebLink", () => {
  it("accepts http and https addresses", () => {
    expect(isWebLink("https://example.com/ubytovani")).toBe(true);
    expect(isWebLink("http://example.com")).toBe(true);
  });

  it("rejects every other scheme and incomplete addresses", () => {
    for (const bad of [
      "file:///C:/Windows",
      "javascript:alert(1)",
      "ftp://x.cz",
      "example.com",
      "https://",
      "",
    ]) {
      expect(isWebLink(bad), bad).toBe(false);
    }
  });
});
