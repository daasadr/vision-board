import {
  memo,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { Item } from "../../lib/ipc";
import styles from "./BoardItemView.module.css";
import {
  angleAround,
  clampRotation,
  keepOnCanvas,
  resizeFromCorner,
  type Corner,
  type Rect,
} from "./geometry";
import { ItemContentView, type TextEdit } from "./ItemContentView";

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
/** Pointer travel (screen px) before a press on an item counts as a drag. */
const DRAG_THRESHOLD = 3;
const KEY_STEP = 10;
const KEY_STEP_FINE = 1;

export interface ItemCallbacks {
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<Omit<Item, "id">>) => void;
  /** A correction that should not become an undo step (measured text height). */
  onMeasure: (id: string, h: number) => void;
  onRemove: (id: string) => void;
  onEditStart: (id: string) => void;
  onEditEnd: () => void;
  /** True while the item is being dragged, resized or rotated. */
  onInteraction: (active: boolean) => void;
}

interface Props extends ItemCallbacks {
  item: Item;
  selected: boolean;
  editing: boolean;
  /** Screen pixels per canvas unit. */
  scale: number;
}

type Gesture =
  | { kind: "move"; startX: number; startY: number; origin: Rect; moved: boolean }
  | { kind: "resize"; corner: Corner; startX: number; startY: number; origin: Rect }
  | { kind: "rotate"; center: { x: number; y: number }; grabOffset: number };

function itemLabel(item: Item, t: ReturnType<typeof useTranslation>["t"]): string {
  switch (item.content.kind) {
    case "quote":
      return t("board.item.quote", { text: item.content.text });
    case "text":
      return t("board.item.text", { text: item.content.text });
    case "image":
      return t("board.item.image");
  }
}

export const BoardItemView = memo(function BoardItemView({
  item,
  selected,
  editing,
  scale,
  onSelect,
  onChange,
  onMeasure,
  onRemove,
  onEditStart,
  onEditEnd,
  onInteraction,
}: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const live = useRef<Rect & { rotation: number }>({ ...item });
  const isText = item.content.kind !== "image";

  // Text items size to their content: keep the stored height in sync with the rendered one.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!isText || !content) return;
    const observer = new ResizeObserver(() => {
      if (gesture.current) return;
      const measured = content.offsetHeight;
      if (measured > 0 && Math.abs(measured - item.h) > 0.5) onMeasure(item.id, measured);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [isText, item.id, item.h, onMeasure]);

  function render(rect: Rect & { rotation: number }) {
    const el = ref.current;
    if (!el) return;
    live.current = rect;
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = isText ? "" : `${rect.h}px`;
    el.style.setProperty("--item-w", String(rect.w));
    el.style.transform = `rotate(${rect.rotation}deg)`;
  }

  function begin(event: ReactPointerEvent, next: Gesture) {
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    live.current = { x: item.x, y: item.y, w: item.w, h: item.h, rotation: item.rotation };
    gesture.current = next;
    if (next.kind !== "move") onInteraction(true);
  }

  function onBodyPointerDown(event: ReactPointerEvent) {
    if (event.button !== 0 || editing) return;
    onSelect(item.id);
    begin(event, {
      kind: "move",
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
      moved: false,
    });
  }

  function onResizePointerDown(event: ReactPointerEvent, corner: Corner) {
    if (event.button !== 0) return;
    begin(event, {
      kind: "resize",
      corner,
      startX: event.clientX,
      startY: event.clientY,
      origin: item,
    });
  }

  function onRotatePointerDown(event: ReactPointerEvent) {
    if (event.button !== 0 || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const pointerAngle = angleAround(center, { x: event.clientX, y: event.clientY });
    begin(event, { kind: "rotate", center, grabOffset: pointerAngle - item.rotation });
  }

  function onPointerMove(event: ReactPointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const current = live.current;
    if (g.kind === "move") {
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!g.moved) {
        g.moved = true;
        onInteraction(true);
      }
      render({ ...current, x: g.origin.x + dx / scale, y: g.origin.y + dy / scale });
    } else if (g.kind === "resize") {
      const dx = (event.clientX - g.startX) / scale;
      const dy = (event.clientY - g.startY) / scale;
      render({ ...resizeFromCorner(g.origin, g.corner, dx, dy), rotation: current.rotation });
    } else {
      const angle = angleAround(g.center, { x: event.clientX, y: event.clientY });
      render({ ...current, rotation: clampRotation(Math.round(angle - g.grabOffset)) });
    }
  }

  function onPointerUp() {
    const g = gesture.current;
    gesture.current = null;
    if (!g || (g.kind === "move" && !g.moved)) return;
    onInteraction(false);
    const { x, y, w, h, rotation } = live.current;
    const kept = keepOnCanvas({ x, y, w, h });
    onChange(item.id, { ...kept, rotation });
    // The store update re-renders with the committed values; reset inline geometry so
    // React-controlled styles win again.
    render({ ...kept, rotation });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (editing) return;
    const step = event.shiftKey ? KEY_STEP_FINE : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      onChange(item.id, keepOnCanvas({ ...item, x: item.x + move[0], y: item.y + move[1] }));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(item.id);
    } else if (event.key === "Enter" && isText) {
      event.preventDefault();
      onEditStart(item.id);
    }
  }

  function onEditDone(edit: TextEdit | null) {
    onEditEnd();
    if (!edit) return;
    const { content } = item;
    if (content.kind === "quote") {
      onChange(item.id, { content: { ...content, text: edit.text } });
    } else if (content.kind === "text") {
      onChange(item.id, { content: { ...content, text: edit.text } });
    }
    ref.current?.focus();
  }

  const style = {
    left: item.x,
    top: item.y,
    width: item.w,
    height: isText ? undefined : item.h,
    transform: `rotate(${item.rotation}deg)`,
    zIndex: item.z,
    "--item-w": item.w,
    "--handle": `${12 / Math.max(scale, 0.01)}px`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`${styles.item} ${selected ? styles.selected : ""}`}
      style={style}
      data-item-id={item.id}
      role="button"
      aria-pressed={selected}
      aria-roledescription={t("board.item.role")}
      aria-label={itemLabel(item, t)}
      tabIndex={0}
      onFocus={() => !selected && onSelect(item.id)}
      onPointerDown={onBodyPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={isText ? () => onEditStart(item.id) : undefined}
      onKeyDown={onKeyDown}
    >
      <div ref={contentRef} className={styles.content}>
        <ItemContentView item={item} editing={editing} onEditDone={onEditDone} />
      </div>
      {selected && !editing && (
        <>
          {CORNERS.map((corner) => (
            <span
              key={corner}
              className={`${styles.handle} ${styles[corner]}`}
              data-handle={corner}
              aria-hidden="true"
              onPointerDown={(e) => onResizePointerDown(e, corner)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          ))}
          <span
            className={styles.rotate}
            data-handle="rotate"
            aria-hidden="true"
            onPointerDown={onRotatePointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </>
      )}
    </div>
  );
});
