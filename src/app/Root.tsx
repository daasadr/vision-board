import { getCurrentWindow } from "@tauri-apps/api/window";
import { lazy, Suspense } from "react";
import { viewFor, type View } from "./view";

// Each window loads only its own code: the control widget runs all the time and stays light.
const views: Record<View, ReturnType<typeof lazy>> = {
  board: lazy(() => import("./board/BoardApp")),
  settings: lazy(() => import("./settings/SettingsApp")),
  control: lazy(() => import("./control/ControlApp")),
  // Design system specimen, reachable only by URL (dev server, E2E).
  design: lazy(() => import("./design/DesignPage")),
};

function windowLabel(): string | null {
  try {
    return getCurrentWindow().label;
  } catch {
    return null; // Not running inside Tauri.
  }
}

export function Root() {
  const view = viewFor(window.location.pathname, windowLabel());
  // The control widget is a shape floating on the desktop, without a window background.
  document.documentElement.toggleAttribute("data-transparent", view === "control");
  const View = views[view];
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
