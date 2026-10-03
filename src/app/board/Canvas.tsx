import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useBoard, useBoardActions } from "./boardContext";
import { BoardItemView, type ItemCallbacks } from "./BoardItemView";
import styles from "./Canvas.module.css";
import { CANVAS_HEIGHT, CANVAS_WIDTH, fitCanvas, type Fit } from "./geometry";
import { ItemToolbar } from "./ItemToolbar";
import { itemsInOrder } from "./store";

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
export function Canvas({ overlay }: { overlay?: ReactNode }) {
  const { t } = useTranslation();
  const { ref, fit } = useFit();
  const items = useBoard(useShallow(itemsInOrder));
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

  const selected = items.find((i) => i.id === selectedId);

  return (
    <div ref={ref} className={styles.viewport}>
      <section
        className={styles.stage}
        aria-label={t("board.label")}
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
      </section>
      {selected && !interacting && editingId !== selected.id && (
        <ItemToolbar item={selected} fit={fit} onEdit={() => onEditStart(selected.id)} />
      )}
      {overlay}
    </div>
  );
}
