import type { Item, TextVariant } from "../../lib/ipc";
import { centeredOnCanvas } from "./geometry";

// Initial widths in canvas units. Text heights are estimates; the rendered height replaces
// them right after the item appears (see BoardItemView).
const QUOTE_WIDTH = 720;
const HEADING_WIDTH = 760;
const NOTE_WIDTH = 480;

function base(w: number, h: number, z: number) {
  return { id: crypto.randomUUID(), ...centeredOnCanvas(w, h), rotation: 0, z };
}

export function newQuote(text: string, author: string | null, z: number): Item {
  return { ...base(QUOTE_WIDTH, 260, z), content: { kind: "quote", text, author } };
}

export function newText(text: string, variant: TextVariant, z: number): Item {
  const w = variant === "heading" ? HEADING_WIDTH : NOTE_WIDTH;
  return { ...base(w, w * 0.25, z), content: { kind: "text", text, variant } };
}
