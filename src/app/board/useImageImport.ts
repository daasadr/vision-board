import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Notice } from "../../design/components";
import { ipc, type ImportResult, type Media } from "../../lib/ipc";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Point, type Rect } from "./geometry";
import { fileToBase64, imageSize, newImageItems } from "./imageItems";
import type { MediaStore } from "./mediaStore";
import { topZ, type BoardStore } from "./store";

export interface Placeholder extends Rect {
  id: string;
}

const CENTER: Point = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
const PLACEHOLDER = imageSize({ width: 4, height: 3 });

/** Converts a point in CSS pixels of the window to canvas units, using the rendered stage. */
export function clientToCanvas(clientX: number, clientY: number): Point {
  const stage = document.querySelector<HTMLElement>("[data-board-stage]");
  const box = stage?.getBoundingClientRect();
  if (!box || box.width === 0) return CENTER;
  const scale = box.width / CANVAS_WIDTH;
  return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))
  );
}

/**
 * Brings images onto the board from three sources: files dropped from the OS, images pasted
 * from the clipboard, and the file picker. Shows a placeholder per image while it is processed
 * and a notice for every file that could not be imported.
 */
export function useImageImport(
  store: BoardStore,
  media: MediaStore,
  notify: (notice: Omit<Notice, "id">) => void,
) {
  const { t } = useTranslation();
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const run = useCallback(
    async (count: number, at: Point, importer: () => Promise<ImportResult[]>) => {
      const batch = Array.from({ length: count }, (_, i) => ({
        id: crypto.randomUUID(),
        x: at.x - PLACEHOLDER.w / 2 + i * 48,
        y: at.y - PLACEHOLDER.h / 2 + i * 48,
        ...PLACEHOLDER,
      }));
      setPlaceholders((p) => [...p, ...batch]);
      try {
        const results = await importer();
        const imported: Media[] = [];
        for (const result of results) {
          if (result.status === "ok") {
            media.getState().add(result.media);
            imported.push(result.media);
          } else {
            const name = result.name || t("board.import.pasted");
            notify({ tone: "error", message: t(`board.import.${result.kind}`, { name }) });
          }
        }
        const state = store.getState();
        state.addMany(newImageItems(imported, at, topZ(state) + 1));
      } catch (error) {
        console.error("Image import failed", error);
        notify({ tone: "error", message: t("board.import.failed") });
      } finally {
        const ids = new Set<string>(batch.map((b) => b.id));
        setPlaceholders((p) => p.filter((x) => !ids.has(x.id)));
      }
    },
    [media, notify, store, t],
  );

  const importFiles = useCallback(
    (files: File[], at: Point = CENTER) => {
      if (files.length === 0) return;
      void run(files.length, at, () =>
        Promise.all(
          files.map(async (f) =>
            withName(await ipc.importImageBytes(await fileToBase64(f)), f.name),
          ),
        ),
      );
    },
    [run],
  );

  const importPaths = useCallback(
    (paths: string[], at: Point = CENTER) => {
      if (paths.length === 0) return;
      void run(paths.length, at, () => ipc.importImagePaths(paths));
    },
    [run],
  );

  // Files dropped from the OS arrive as a Tauri event with paths and a physical position.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          if (event.payload.type !== "drop") return;
          const ratio = window.devicePixelRatio || 1;
          const { x, y } = event.payload.position;
          importPaths(event.payload.paths, clientToCanvas(x / ratio, y / ratio));
        })
        .then((fn) => (disposed ? fn() : (unlisten = fn)))
        .catch(() => {});
    } catch {
      // Not running inside Tauri.
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [importPaths]);

  // Images pasted from the clipboard (Ctrl/Cmd+V), unless the user is typing.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      event.preventDefault();
      importFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importFiles]);

  return { placeholders, importFiles, importPaths };
}

/** Pasted or picked files are sent as bytes, so the backend does not know their name. */
function withName(result: ImportResult, name: string): ImportResult {
  return result.status === "error" ? { ...result, name } : result;
}
