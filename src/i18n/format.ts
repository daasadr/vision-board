import type { Language } from ".";

/** Wall-clock time in the UI language's convention, always 24-hour for cs and de. */
export function formatTime(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(date);
}

/** Calendar date without the weekday, e.g. "26. 9. 2026" (cs), "26.9.2026" (de), "9/26/2026" (en). */
export function formatDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}
