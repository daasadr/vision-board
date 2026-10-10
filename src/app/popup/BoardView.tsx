import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ipc, type Item } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { BoardContext, type BoardServices } from "../board/boardContext";
import { CANVAS_HEIGHT, CANVAS_WIDTH, fitCanvas, type Fit } from "../board/geometry";
import { ItemContentView } from "../board/ItemContentView";
import { createMediaStore } from "../board/mediaStore";
import { createSaver } from "../board/saver";
import { createBoardStore } from "../board/store";
import styles from "./BoardView.module.css";

function createServices(): BoardServices {
  // Read-only: nothing is ever edited, so nothing is saved.
  const saver = createSaver(async () => {});
  return { saver, store: createBoardStore(saver.enqueue), media: createMediaStore() };
}

/**
 * The board as it is, scaled to fit, without any editing. `flat`: no rounded frame or shadow
 * (the wallpaper adds its own). `onReady` is called once the board, its images and fonts are
 * drawn, e.g. to take a snapshot.
 */
export function BoardView({ flat = false, onReady }: { flat?: boolean; onReady?: () => void }) {
  const { t } = useTranslation();
  const [services] = useState(createServices);
  const [items, setItems] = useState<Item[] | null>(null);
  const imagesOnly = useSettings((s) => s.settings.imagesOnly);
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>({ scale: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    Promise.all([ipc.mediaLibrary(), ipc.loadBoard()])
      .then(([library, loaded]) => {
        services.media.getState().setLibrary(library.dir, library.items);
        setItems(loaded);
      })
      .catch((error: unknown) => {
        console.error("Loading the board failed", error);
        setItems([]);
      });
  }, [services]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFit(fitCanvas(el.clientWidth, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (items === null || !onReady) return;
    let active = true;
    const images = [...(ref.current?.querySelectorAll("img") ?? [])];
    void Promise.all([document.fonts.ready, ...images.map((img) => img.decode().catch(() => {}))])
      // Two frames, so the decoded images are also painted.
      .then(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      .then(() => active && onReady());
    return () => {
      active = false;
    };
  }, [items, onReady]);

  const shown = (items ?? []).filter((i) => !imagesOnly || i.content.kind === "image");

  return (
    <BoardContext.Provider value={services}>
      <div ref={ref} className={styles.viewport}>
        <section
          className={`${styles.stage} ${flat ? styles.flat : ""}`}
          aria-label={t("board.label")}
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(${fit.offsetX}px, ${fit.offsetY}px) scale(${fit.scale})`,
          }}
        >
          {shown.map((item) => (
            <div
              key={item.id}
              className={styles.item}
              style={
                {
                  left: item.x,
                  top: item.y,
                  width: item.w,
                  height: item.content.kind === "image" ? item.h : undefined,
                  transform: `rotate(${item.rotation}deg)`,
                  zIndex: item.z,
                  "--item-w": item.w,
                } as CSSProperties
              }
            >
              <ItemContentView
                item={item}
                editing={false}
                onEditDone={() => {}}
                screenWidth={item.w * fit.scale}
              />
            </div>
          ))}
        </section>
      </div>
    </BoardContext.Provider>
  );
}
