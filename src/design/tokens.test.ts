import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEMES } from "./theme";

// Vitest runs from the project root.
const tokensCss = readFileSync(resolve("src/design/tokens.css"), "utf8");

function themeTokens(theme: string): Map<string, string> {
  const block = tokensCss.match(new RegExp(String.raw`\[data-theme="${theme}"\]\s*\{([^}]*)\}`));
  if (!block) throw new Error(`Theme ${theme} not found in tokens.css`);
  const tokens = new Map<string, string>();
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

function token(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Token ${name} is not defined`);
  return value;
}

type Rgb = [number, number, number];

/** Parses `#rrggbb` or `rgb(r g b / a)`; translucent colors are composited over `backdrop`. */
function parseColor(value: string, backdrop?: Rgb): Rgb {
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [hex[1], hex[2], hex[3]].map((c) => parseInt(c, 16)) as Rgb;

  const rgb = value.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/);
  if (!rgb) throw new Error(`Unsupported color ${value}`);
  const color = [rgb[1], rgb[2], rgb[3]].map(Number) as Rgb;
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (alpha === 1) return color;
  if (!backdrop) throw new Error(`Translucent ${value} needs an opaque backdrop`);
  return color.map((c, i) => c * alpha + backdrop[i] * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast of `fg` on `bg`, with translucent surfaces composited over the page background. */
function tokenContrast(tokens: Map<string, string>, fg: string, bg: string): number {
  const page = parseColor(token(tokens, "--color-bg"));
  const background = parseColor(token(tokens, bg), page);
  return contrast(parseColor(token(tokens, fg), background), background);
}

describe("design tokens", () => {
  it("defines the same tokens in every theme", () => {
    const [first, ...rest] = THEMES.map((t) => [...themeTokens(t).keys()].sort());
    expect(first.length).toBeGreaterThan(20);
    for (const names of rest) expect(names).toEqual(first);
  });

  // WCAG AA: 4.5:1 for text (all ink tokens are used for small text, incl. placeholders),
  // 3:1 for UI components such as focus rings and accent borders.
  const pairs: [fg: string, bg: string, min: number][] = [
    ["--color-ink", "--color-bg", 4.5],
    ["--color-ink", "--color-surface-raised", 4.5],
    ["--color-ink-muted", "--color-bg", 4.5],
    ["--color-ink-muted", "--color-surface-raised", 4.5],
    ["--color-ink-subtle", "--color-bg", 4.5],
    ["--color-ink-subtle", "--color-surface-sunken", 4.5],
    ["--color-on-accent", "--color-accent", 4.5],
    ["--color-on-danger", "--color-danger", 4.5],
    ["--color-danger", "--color-bg", 4.5],
    ["--color-accent", "--color-bg", 3],
    ["--color-focus", "--color-bg", 3],
  ];

  for (const theme of THEMES) {
    for (const [fg, bg, min] of pairs) {
      it(`${theme}: ${fg} on ${bg} has contrast ≥ ${min}`, () => {
        expect(tokenContrast(themeTokens(theme), fg, bg)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});
