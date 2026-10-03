import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectLanguage, LANGUAGES, resolveLanguage } from ".";

describe("detectLanguage", () => {
  it("uses the system language when it is supported", () => {
    expect(detectLanguage(["cs-CZ", "en-US"])).toBe("cs");
    expect(detectLanguage(["de-AT"])).toBe("de");
  });

  it("uses the first supported language from the preference list", () => {
    expect(detectLanguage(["fr-FR", "de-DE", "en"])).toBe("de");
  });

  it("falls back to English for unsupported languages", () => {
    expect(detectLanguage(["fr-FR"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
  });

  it("keeps an explicit user choice over the system language", () => {
    expect(resolveLanguage("de", ["cs-CZ"])).toBe("de");
    expect(resolveLanguage("system", ["cs-CZ"])).toBe("cs");
  });
});

type Messages = { [key: string]: string | Messages };

function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`),
  );
}

function flattenValues(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flattenValues(value, `${prefix}${key}.`),
  );
}

// Vitest runs from the project root.
const localesDir = resolve("src/i18n/locales");

function loadLocale(language: string): Messages {
  return JSON.parse(readFileSync(resolve(localesDir, `${language}.json`), "utf8")) as Messages;
}

/** Keys present in one locale but missing in another, as "de: app.title". */
function missingKeys(locales: Record<string, Messages>): string[] {
  const keysByLocale = Object.entries(locales).map(
    ([lang, m]) => [lang, new Set(flattenKeys(m))] as const,
  );
  const allKeys = new Set(keysByLocale.flatMap(([, keys]) => [...keys]));
  return keysByLocale.flatMap(([lang, keys]) =>
    [...allKeys].filter((key) => !keys.has(key)).map((key) => `${lang}: ${key}`),
  );
}

describe("translations", () => {
  it("has a locale file for every supported language and nothing else", () => {
    const files = readdirSync(localesDir).map((f) => f.replace(/\.json$/, ""));
    expect(files.sort()).toEqual([...LANGUAGES].sort());
  });

  it("defines every key in every language", () => {
    const locales = Object.fromEntries(LANGUAGES.map((lang) => [lang, loadLocale(lang)]));
    expect(missingKeys(locales)).toEqual([]);
  });

  it("reports a key missing from one language", () => {
    expect(
      missingKeys({
        cs: { app: { title: "A", subtitle: "B" } },
        de: { app: { title: "A" } },
      }),
    ).toEqual(["de: app.subtitle"]);
  });

  it("has no empty translations", () => {
    for (const lang of LANGUAGES) {
      const empty = flattenValues(loadLocale(lang)).filter(([, value]) => value.trim() === "");
      expect(empty.map(([key]) => `${lang}: ${key}`)).toEqual([]);
    }
  });
});
