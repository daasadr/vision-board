export const THEMES = ["galerie", "noc"] as const;
export type ThemeName = (typeof THEMES)[number];
export type ThemePreference = ThemeName | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Galerie is the light theme and Noc the dark one, so "system" follows the OS color scheme. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeName {
  if (preference !== "system") return preference;
  return prefersDark ? "noc" : "galerie";
}

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
}

/**
 * Applies the theme for the preference right away and, for "system", keeps following OS changes.
 * Returns a function that stops following.
 */
export function followTheme(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
): () => void {
  const media = window.matchMedia(DARK_QUERY);
  applyTheme(resolveTheme(preference, media.matches), root);
  if (preference !== "system") return () => {};

  const onChange = (event: MediaQueryListEvent) =>
    applyTheme(resolveTheme("system", event.matches), root);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
