import { listen } from "@tauri-apps/api/event";
import i18next from "i18next";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { followTheme } from "../design/theme";
import { initI18n, resolveLanguage } from "../i18n";
import { ipc, type Settings } from "./ipc";

/** Matches commands::settings::SETTINGS_CHANGED_EVENT in Rust. */
export const SETTINGS_CHANGED_EVENT = "settings://changed";

/** Same as `Settings::default()` in Rust; used only when the backend cannot be reached. */
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  language: "system",
  frame: "none",
  imagesOnly: false,
  placement: { mode: "full", size: 60, anchor: "center" },
  controlWidget: true,
  controlLayer: "behind",
  controlPosition: null,
  startup: { wallpaper: false, scheduledPopup: false },
  schedule: {
    times: [9 * 60],
    interval: null,
    windowStart: 9 * 60,
    windowEnd: 18 * 60,
    days: [true, true, true, true, true, true, true],
    durationSecs: 30,
    pauseSecs: 5,
    maxDelayMin: 30,
  },
  split: { board: false, popup: false, wallpaper: false, side: "left" },
};

declare global {
  interface Window {
    /** Injected by the backend into every new window, so the first render is already right. */
    __VB_SETTINGS__?: Settings;
  }
}

export interface SettingsState {
  settings: Settings;
  /**
   * Applies a change right away and stores it; the stored (validated) value wins. Resolves to
   * false when storing failed and the change was rolled back.
   */
  update(patch: Partial<Settings>): Promise<boolean>;
  /** Restores the defaults (the board stays as it is). */
  reset(): Promise<boolean>;
}

let stopFollowingTheme = () => {};

/** Makes the window look and speak according to the settings. */
function apply(settings: Settings, previous?: Settings) {
  if (settings.theme !== previous?.theme) {
    stopFollowingTheme();
    stopFollowingTheme = followTheme(settings.theme);
  }
  if (settings.language !== previous?.language) {
    const language = resolveLanguage(settings.language);
    document.documentElement.lang = language;
    void i18next.changeLanguage(language);
  }
}

export const settingsStore = createStore<SettingsState>()((set, get) => {
  async function store(next: Settings, previous: Settings, save: () => Promise<Settings>) {
    set({ settings: next });
    apply(next, previous);
    try {
      const stored = await save();
      set({ settings: stored });
      apply(stored, next);
      return true;
    } catch (error) {
      console.error("Saving settings failed", error);
      set({ settings: previous });
      apply(previous, next);
      return false;
    }
  }

  return {
    settings: DEFAULT_SETTINGS,
    update(patch) {
      const previous = get().settings;
      const next = { ...previous, ...patch };
      return store(next, previous, () => ipc.saveSettings(next));
    },
    reset() {
      return store(DEFAULT_SETTINGS, get().settings, ipc.resetSettings);
    },
  };
});

/**
 * Loads the settings and applies theme and language before the first render. Afterwards the
 * window follows changes made in any window.
 */
export async function initSettings(): Promise<void> {
  const settings =
    window.__VB_SETTINGS__ ??
    (await ipc.settings().catch((error: unknown) => {
      console.error("Loading settings failed", error);
      return DEFAULT_SETTINGS;
    }));
  settingsStore.setState({ settings });
  stopFollowingTheme = followTheme(settings.theme);
  await initI18n(resolveLanguage(settings.language));

  try {
    await listen<Settings>(SETTINGS_CHANGED_EVENT, ({ payload }) => {
      const previous = settingsStore.getState().settings;
      settingsStore.setState({ settings: payload });
      apply(payload, previous);
    });
  } catch {
    // Not running inside Tauri (browser dev server, unit tests).
  }
}

export function useSettings<T>(selector: (state: SettingsState) => T): T {
  return useStore(settingsStore, selector);
}
