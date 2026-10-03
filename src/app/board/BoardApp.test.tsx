import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardApp } from "./BoardApp";

vi.mock("../../lib/ipc", () => ({
  ipc: {
    loadBoard: vi.fn().mockResolvedValue([]),
    applyBoardOps: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("BoardApp", () => {
  it("names the app for assistive technology", () => {
    render(<BoardApp />);
    expect(screen.getByRole("heading", { level: 1, name: "Vision Board" })).toBeInTheDocument();
  });

  it("invites the user to add content to an empty board", async () => {
    render(<BoardApp />);
    expect(await screen.findByRole("heading", { name: "Vaše vize začíná tady" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Citát" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Text" })).toBeEnabled();
  });
});
