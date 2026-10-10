export const VIEWS = ["board", "settings", "control", "popup", "wallpaper", "design"] as const;
export type View = (typeof VIEWS)[number];

function isView(name: string): name is View {
  return (VIEWS as readonly string[]).includes(name);
}

/**
 * Which view a window shows: by its Tauri label, or in a plain browser (dev server, E2E) by
 * the path, e.g. /settings.
 */
export function viewFor(pathname: string, label: string | null): View {
  const fromPath = pathname.replace(/^\/+|\/+$/g, "");
  if (isView(fromPath)) return fromPath;
  // One pop-up window per monitor: popup-0, popup-1, …
  if (label?.startsWith("popup-")) return "popup";
  // The off-screen renderer of the wallpaper image.
  if (label === "wallpaper-render") return "wallpaper";
  return label && isView(label) ? label : "board";
}
