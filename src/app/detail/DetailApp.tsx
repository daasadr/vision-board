import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import { ipc, type Hotspot, type Item, type MediaLibrary } from "../../lib/ipc";
import { mediaUrl } from "../board/mediaStore";
import styles from "./DetailApp.module.css";

/** Which hotspot to show; set by the backend when it opens or reuses the window. */
interface Target {
  itemId: string;
  hotspotId: string;
}

declare global {
  interface Window {
    __VB_DETAIL__?: Target;
  }
}

/** Matches window_manager::DETAIL_SHOW_EVENT in Rust. */
const SHOW_EVENT = "detail://show";

function close() {
  try {
    void getCurrentWindow().destroy();
  } catch {
    // Not running inside Tauri (browser dev server, E2E).
  }
}

/**
 * The detail of a hotspot: title, text and a gallery of further photos to page through with
 * the arrow keys. Esc closes the window.
 */
export default function DetailApp() {
  const { t } = useTranslation();
  const [target, setTarget] = useState<Target | null>(window.__VB_DETAIL__ ?? null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [library, setLibrary] = useState<MediaLibrary | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    Promise.all([ipc.loadBoard(), ipc.mediaLibrary()])
      .then(([loaded, media]) => {
        setItems(loaded);
        setLibrary(media);
      })
      .catch(() => setItems([]));
  }, [target]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<Target>(SHOW_EVENT, ({ payload }) => {
      setTarget(payload);
      setIndex(0);
    })
      .then((fn) => (unlisten = fn))
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  const detail = useMemo(() => {
    const item = items?.find((i) => i.id === target?.itemId);
    if (item?.content.kind !== "image") return null;
    const hotspot = (item.content.hotspots ?? []).find((h: Hotspot) => h.id === target?.hotspotId);
    return hotspot?.action.kind === "detail" ? hotspot.action : null;
  }, [items, target]);

  const photos = useMemo(() => {
    if (!detail || !library) return [];
    const state = {
      dir: library.dir,
      items: Object.fromEntries(library.items.map((m) => [m.id, m])),
    };
    return detail.media
      .map((id) => ({ id, full: mediaUrl(state, id, "full"), thumb: mediaUrl(state, id, "thumb") }))
      .filter((p): p is { id: string; full: string; thumb: string } => !!p.full && !!p.thumb);
  }, [detail, library]);

  const go = useCallback(
    (step: number) => photos.length && setIndex((i) => (i + step + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  if (items === null) return null;
  if (!detail) {
    return (
      <main className={styles.app}>
        <p className={styles.missing} role="alert">
          {t("detail.missing")}
        </p>
      </main>
    );
  }

  const current = photos[Math.min(index, photos.length - 1)];
  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>{detail.title}</h1>
        <Button size="sm" variant="ghost" onClick={close}>
          {t("common.close")}
        </Button>
      </header>
      {current && (
        <section className={styles.gallery} aria-label={t("detail.gallery")}>
          <img className={styles.photo} src={current.full} alt="" />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                className={`${styles.nav} ${styles.prev}`}
                aria-label={t("detail.previous")}
                onClick={() => go(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={`${styles.nav} ${styles.next}`}
                aria-label={t("detail.next")}
                onClick={() => go(1)}
              >
                ›
              </button>
              <p className={styles.counter} aria-live="polite">
                {t("detail.counter", { n: index + 1, count: photos.length })}
              </p>
            </>
          )}
        </section>
      )}
      {photos.length > 1 && (
        <div className={styles.thumbs}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className={styles.thumb}
              aria-label={t("detail.photoN", { n: i + 1 })}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              <img src={photo.thumb} alt="" />
            </button>
          ))}
        </div>
      )}
      {detail.text && <p className={styles.text}>{detail.text}</p>}
    </main>
  );
}
