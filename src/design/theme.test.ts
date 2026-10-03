import { afterEach, describe, expect, it, vi } from "vitest";
import { followTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("follows the OS color scheme for the system preference", () => {
    expect(resolveTheme("system", false)).toBe("galerie");
    expect(resolveTheme("system", true)).toBe("noc");
  });

  it("keeps an explicit choice regardless of the OS", () => {
    expect(resolveTheme("galerie", true)).toBe("galerie");
    expect(resolveTheme("noc", false)).toBe("noc");
  });
});

describe("followTheme", () => {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;

  function mockMatchMedia(dark: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: dark,
      media: query,
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => (listener = cb),
      removeEventListener: () => (listener = undefined),
    }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    listener = undefined;
  });

  it("switches to Noc when the OS turns dark at runtime", () => {
    mockMatchMedia(false);
    const root = document.createElement("html");
    followTheme("system", root);
    expect(root.dataset.theme).toBe("galerie");

    listener?.({ matches: true } as MediaQueryListEvent);
    expect(root.dataset.theme).toBe("noc");
  });

  it("ignores OS changes when the user chose a theme", () => {
    mockMatchMedia(true);
    const root = document.createElement("html");
    followTheme("galerie", root);
    expect(root.dataset.theme).toBe("galerie");
    expect(listener).toBeUndefined();
  });

  it("stops following after cleanup", () => {
    mockMatchMedia(false);
    const stop = followTheme("system", document.createElement("html"));
    stop();
    expect(listener).toBeUndefined();
  });
});
