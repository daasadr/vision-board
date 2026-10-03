import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardApp } from "./BoardApp";

describe("BoardApp", () => {
  it("shows the app name", () => {
    render(<BoardApp />);
    expect(screen.getByRole("heading", { name: "Vision Board" })).toBeInTheDocument();
  });
});
