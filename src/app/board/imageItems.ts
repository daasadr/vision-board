import type { ImportResult, Item, Media } from "../../lib/ipc";
import { keepOnCanvas, type Point } from "./geometry";

/** Longest side of a newly added image, in canvas units. */
const NEW_IMAGE_EDGE = 460;
/** Offset between images added together, so a batch fans out instead of stacking exactly. */
const BATCH_OFFSET = 48;

/** Size of a new image item: fits NEW_IMAGE_EDGE and keeps the image's aspect ratio. */
export function imageSize(media: Pick<Media, "width" | "height">): { w: number; h: number } {
  const scale = NEW_IMAGE_EDGE / Math.max(media.width, media.height);
  return { w: media.width * scale, h: media.height * scale };
}

/**
 * Image items for freshly imported media, fanned out around `center` (canvas units) with a
 * slight alternating tilt, the way photos land when dropped on a table.
 */
export function newImageItems(media: Media[], center: Point, firstZ: number): Item[] {
  const spread = ((media.length - 1) * BATCH_OFFSET) / 2;
  return media.map((m, i) => {
    const { w, h } = imageSize(m);
    const offset = i * BATCH_OFFSET - spread;
    const rect = keepOnCanvas({
      x: center.x - w / 2 + offset,
      y: center.y - h / 2 + offset,
      w,
      h,
    });
    return {
      id: crypto.randomUUID(),
      ...rect,
      rotation: media.length > 1 ? (i % 2 === 0 ? -3 : 3) : 0,
      z: firstZ + i,
      content: { kind: "image", mediaId: m.id },
    };
  });
}

/** Largest accepted file, as in the backend (domain::media::MAX_INPUT_BYTES). */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

/**
 * Imports picked or pasted files one at a time, so only one file is held in memory as base64,
 * and rejects files over the limit without reading them. The backend does not know the names
 * of files sent as bytes, so errors get them here.
 */
export async function importFilesInTurn(
  files: File[],
  importBytes: (base64: string) => Promise<ImportResult>,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const file of files) {
    const result: ImportResult =
      file.size > MAX_IMAGE_BYTES
        ? { status: "error", kind: "tooLarge", name: file.name }
        : await importBytes(await fileToBase64(file));
    results.push(result.status === "error" ? { ...result, name: file.name } : result);
  }
  return results;
}

/** Reads a File as base64 without the data-URL prefix. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("file could not be read"));
    reader.readAsDataURL(file);
  });
}
