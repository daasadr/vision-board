// The only module that talks to the Rust backend. Everything else imports from here,
// which keeps IPC typed in one place and lets E2E tests swap it for a mock.
import {
  commands,
  type BoardOp,
  type Entitlement,
  type Feature,
  type ImportResult,
  type Media,
  type MediaLibrary,
  type Item as RawItem,
  type ItemContent,
  type TextVariant,
} from "./bindings";

export type {
  BoardOp,
  Entitlement,
  Feature,
  ImportResult,
  ItemContent,
  Media,
  MediaLibrary,
  TextVariant,
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
};
