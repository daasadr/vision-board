// The only module that talks to the Rust backend. Everything else imports from here,
// which keeps IPC typed in one place and lets E2E tests swap it for a mock.
import {
  commands,
  type Anchor,
  type AppFlag,
  type BoardOp,
  type ControlLayer,
  type Entitlement,
  type Feature,
  type FrameStyle,
  type ImportResult,
  type ItemContent,
  type LanguagePreference,
  type Media,
  type MediaLibrary,
  type Placement,
  type PlacementMode,
  type Item as RawItem,
  type Schedule,
  type Settings,
  type TextVariant,
  type ThemePreference,
} from "./bindings";

export type {
  Anchor,
  BoardOp,
  ControlLayer,
  Entitlement,
  Feature,
  FrameStyle,
  ImportResult,
  ItemContent,
  LanguagePreference,
  Media,
  MediaLibrary,
  Placement,
  PlacementMode,
  Schedule,
  Settings,
  TextVariant,
  ThemePreference,
};

/**
 * A board item with finite geometry. The generated binding types floats as `number | null`
 * (JSON turns NaN into null); the backend rejects non-finite values, so they never arrive.
 */
export type Item = Omit<RawItem, "x" | "y" | "w" | "h" | "rotation"> & {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

export class IpcError extends Error {
  constructor(command: string, message: string) {
    super(`${command}: ${message}`);
    this.name = "IpcError";
  }
}

function unwrap<T>(
  command: string,
  result: { status: "ok"; data: T } | { status: "error"; error: string },
): T {
  if (result.status === "error") throw new IpcError(command, result.error);
  return result.data;
}

function finite(command: string, item: RawItem): Item {
  const { x, y, w, h, rotation } = item;
  if ([x, y, w, h, rotation].some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new IpcError(command, `item ${item.id} has invalid geometry`);
  }
  return item as Item;
}

export const ipc = {
  appVersion: () => commands.appVersion(),

  /** Items of the board, back to front. */
  async loadBoard(): Promise<Item[]> {
    const board = unwrap("board_load", await commands.boardLoad());
    return board.items.map((item) => finite("board_load", item));
  },

  /** Availability of every premium feature; features not listed are free. */
  entitlements: () => commands.entitlementsGet(),

  /** Stores a batch of edits atomically; rejects with IpcError when nothing was stored. */
  async applyBoardOps(ops: BoardOp[]): Promise<void> {
    unwrap("board_apply_ops", await commands.boardApplyOps(ops));
  },

  /** Imports image files by path; one result per file. */
  async importImagePaths(paths: string[]): Promise<ImportResult[]> {
    return unwrap("media_import_paths", await commands.mediaImportPaths(paths));
  },

  /** Imports one image from bytes (clipboard, file picker), sent as base64. */
  async importImageBytes(base64: string): Promise<ImportResult> {
    return unwrap("media_import_bytes", await commands.mediaImportBytes(base64));
  },

  /** The media directory and all stored images. */
  async mediaLibrary(): Promise<MediaLibrary> {
    return unwrap("media_list", await commands.mediaList());
  },

  async flagIsSet(flag: AppFlag): Promise<boolean> {
    return unwrap("app_flag_get", await commands.appFlagGet(flag));
  },

  async setFlag(flag: AppFlag): Promise<void> {
    unwrap("app_flag_set", await commands.appFlagSet(flag));
  },

  /** Tells the backend this window saved its edits, so quitting can continue. */
  readyToQuit: () => commands.appReadyToQuit(),

  async settings(): Promise<Settings> {
    return unwrap("settings_get", await commands.settingsGet());
  },

  /** Stores the settings; resolves with the stored (validated) value. */
  async saveSettings(settings: Settings): Promise<Settings> {
    return unwrap("settings_set", await commands.settingsSet(settings));
  },

  async resetSettings(): Promise<Settings> {
    return unwrap("settings_reset", await commands.settingsReset());
  },

  /** Whether the app starts at login (as registered in the OS). */
  async autostart(): Promise<boolean> {
    return unwrap("autostart_get", await commands.autostartGet());
  },

  /** Turns starting at login on or off; resolves with the resulting state. */
  async setAutostart(enabled: boolean): Promise<boolean> {
    return unwrap("autostart_set", await commands.autostartSet(enabled));
  },

  async openSettings(): Promise<void> {
    unwrap("window_open_settings", await commands.windowOpenSettings());
  },

  /** Shows the pop-up now, regardless of the schedule ("Try it", tray). */
  async showPopupNow(): Promise<void> {
    unwrap("popup_show_now", await commands.popupShowNow());
  },

  /** Closes the pop-up on every monitor; with minutes it comes back after that long. */
  closePopup: (snoozeMinutes: number | null) => commands.popupClose(snoozeMinutes),

  /** The next planned showing as local `YYYY-MM-DDTHH:MM:SS`, or null when none. */
  async nextShowing(): Promise<string | null> {
    return unwrap("schedule_next", await commands.scheduleNext());
  },

  /** The wallpaper renderer has drawn the board; the backend captures it. */
  wallpaperRendered: () => commands.wallpaperRendered(),

  /** Native context menu of the control widget. */
  async controlMenu(): Promise<void> {
    unwrap("control_context_menu", await commands.controlContextMenu());
  },
};
