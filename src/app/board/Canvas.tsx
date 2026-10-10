import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useSettings } from "../../lib/settings";
import { useBoard, useBoardActions } from "./boardContext";
import { BoardItemView, type ItemCallbacks } from "./BoardItemView";
import styles from "./Canvas.module.css";
import { CANVAS_HEIGHT, CANVAS_WIDTH, fitCanvas, type Fit } from "./geometry";
import { HotspotContext } from "./hotspotContext";
import { ItemToolbar } from "./ItemToolbar";
import { itemsInOrder } from "./store";
import { useHotspotEditor } from "./useHotspotEditor";
import type { Placeholder } from "./useImageImport";

/** Tracks an element's size and the canvas fit for it. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>({ scale: 0, offsetX: 0, offsetY: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFit(fitCanvas(el.clientWidth, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, fit };
}

/** The board: a fixed 1920×1080 logical stage scaled to fit the available space. */
export function Canvas({
  overlay,
  placeholders = [],
}: {
  overlay?: ReactNode;
  /** Images being processed, shown where they will appear. */
  placeholders?: Placeholder[];
}) {
  const { t } = useTranslation();
  const { ref, fit } = useFit();
  const allItems = useBoard(useShallow(itemsInOrder));
  const imagesOnly = useSettings((s) => s.settings.imagesOnly);
  // "Images only" hides quotes and texts; they stay in the store and the database.
  const items = useMemo(
    () => (imagesOnly ? allItems.filter((i) => i.content.kind === "image") : allItems),
    [allItems, imagesOnly],
  );
  const selectedId = useBoard((s) => s.selectedId);
  const actions = useBoardActions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [interacting, setInteracting] = useState(false);

  const onEditStart = useCallback(
    (id: string) => {
      actions.select(id);
      setEditingId(id);
    },
    [actions],
  );
  const onEditEnd = useCallback(() => setEditingId(null), []);

  const callbacks: ItemCallbacks = useMemo(
    () => ({
      onSelect: actions.select,
      onChange: actions.update,
      onMeasure: (id, h) => actions.amend(id, { h }),
      onRemove: actions.remove,
      onEditStart,
      onEditEnd,
      onInteraction: setInteracting,
    }),
    [actions, onEditStart, onEditEnd],
  );

  const itemsById = useBoard((s) => s.items);
  const hotspots = useHotspotEditor(itemsById, selectedId);

  const selected = items.find((i) => i.id === selectedId);
  // A selection that just got hidden must not stay selected (keyboard actions would hit it).
  useEffect(() => {
    if (selectedId && !selected) actions.select(null);
  }, [selectedId, selected, actions]);

  return (
    <HotspotContext.Provider value={hotspots.behavior}>
      <div ref={ref} className={styles.viewport}>
        <section
          className={styles.stage}
          aria-label={t("board.label")}
          data-board-stage
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(${fit.offsetX}px, ${fit.offsetY}px) scale(${fit.scale})`,
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) actions.select(null);
          }}
        >
          {items.map((item) => (
            <BoardItemView
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              editing={item.id === editingId}
              scale={fit.scale}
              {...callbacks}
            />
          ))}
          {placeholders.map((p) => (
            <div
              key={p.id}
              className={styles.placeholder}
              style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
              role="img"
              aria-label={t("board.import.processing")}
            />
          ))}
        </section>
        {selected && !interacting && editingId !== selected.id && (
          <ItemToolbar
            item={selected}
            fit={fit}
            onEdit={() => onEditStart(selected.id)}
            hotspotsEditing={hotspots.editingItemId === selected.id}
            onToggleHotspots={() => hotspots.toggle(selected.id)}
          />
        )}
        {hotspots.editingItemId && (
          <p className={styles.hotspotHint} role="status">
            {t("board.hotspots.hint")}
          </p>
        )}
        {hotspots.dialog}
        {overlay}
      </div>
    </HotspotContext.Provider>
  );
}
