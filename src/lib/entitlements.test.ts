import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isEnabled, resetEntitlementsCache, useEntitlement } from "./entitlements";
import { ipc } from "./ipc";

vi.mock("./ipc", () => ({
  ipc: {
    entitlements: vi.fn(),
  },
}));

const allUnlocked = [
  { feature: "premiumFrames", enabled: true },
  { feature: "wallpaper", enabled: true },
  { feature: "scheduledPopup", enabled: true },
] as const;

describe("entitlements", () => {
  beforeEach(() => {
    resetEntitlementsCache();
    vi.mocked(ipc.entitlements).mockReset();
  });

  it("treats features outside the premium list as free", () => {
    expect(isEnabled([{ feature: "wallpaper", enabled: false }], "addQuote")).toBe(true);
  });

  it("follows the backend for premium features", () => {
    expect(isEnabled([{ feature: "wallpaper", enabled: false }], "wallpaper")).toBe(false);
    expect(isEnabled([...allUnlocked], "wallpaper")).toBe(true);
  });

  it("reports wallpaper as available before licensing exists", async () => {
    vi.mocked(ipc.entitlements).mockResolvedValue([...allUnlocked]);
    const { result } = renderHook(() => useEntitlement("wallpaper"));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("asks the backend once per session", async () => {
    vi.mocked(ipc.entitlements).mockResolvedValue([...allUnlocked]);
    const a = renderHook(() => useEntitlement("wallpaper"));
    const b = renderHook(() => useEntitlement("premiumFrames"));
    await waitFor(() => expect(a.result.current).toBe(true));
    await waitFor(() => expect(b.result.current).toBe(true));
    expect(ipc.entitlements).toHaveBeenCalledTimes(1);
  });

  it("keeps premium features locked when the backend cannot be reached", async () => {
    vi.mocked(ipc.entitlements).mockRejectedValue(new Error("ipc down"));
    const { result } = renderHook(() => useEntitlement("wallpaper"));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
