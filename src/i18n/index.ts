import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "./locales/cs.json";
import de from "./locales/de.json";
import en from "./locales/en.json";

export const LANGUAGES = ["cs", "en", "de"] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguagePreference = Language | "system";

const FALLBACK: Language = "en";

export const resources = {
  cs: { translation: cs },
  en: { translation: en },
  de: { translation: de },
} as const;

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Picks the first supported language from the user's preferred languages (most preferred first),
 * matching on the primary subtag so "de-AT" means German. Falls back to English.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split("-")[0];
    if (isLanguage(primary)) return primary;
  }
  return FALLBACK;
}

export function resolveLanguage(
  preference: LanguagePreference,
  preferred: readonly string[] = navigator.languages,
): Language {
  return preference === "system" ? detectLanguage(preferred) : preference;
}

/** Initializes translations synchronously (resources are bundled) before the first render. */
export function initI18n(language: Language) {
  document.documentElement.lang = language;
  return i18next.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: FALLBACK,
    initAsync: false,
    interpolation: { escapeValue: false }, // React already escapes.
    returnNull: false,
  });
}
