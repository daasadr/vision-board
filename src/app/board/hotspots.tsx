import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Hotspot, Item } from "../../lib/ipc";
import { MAX_HOTSPOTS, useHotspots } from "./hotspotContext";
import styles from "./hotspots.module.css";

/** A point of the event as fractions (0–1) of the element's box. */
function fractionIn(element: Element, event: { clientX: number; clientY: number }) {
  const box = element.getBoundingClientRect();
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x: clamp((event.clientX - box.left) / box.width),
    y: clamp((event.clientY - box.top) / box.height),
  };
}

/** Pointer travel (CSS px) that turns a press on a hotspot into a drag. */
const DRAG_THRESHOLD = 4;

/** The hotspots of one image, over the image itself (inside its frame). */
export function HotspotLayer({ item, hotspots }: { item: Item; hotspots: Hotspot[] }) {
  const behavior = useHotspots();
  const layer = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const editing = behavior.editing?.itemId === item.id ? behavior.editing : null;
  if (behavior.mode === "hidden" || (hotspots.length === 0 && !editing)) return null;

  // In the editor, a press on the image adds a hotspot instead of dragging the image.
  function onLayerPointerDown(event: ReactPointerEvent) {
    if (!editing || event.target !== event.currentTarget) return;
    event.stopPropagation();
    if (hotspots.length >= MAX_HOTSPOTS || !layer.current) return;
    const { x, y } = fractionIn(layer.current, event);
    editing.onAdd(item, x, y);
  }

  function onHotspotPointerDown(event: ReactPointerEvent, hotspot: Hotspot) {
    event.stopPropagation();
    if (!editing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { id: hotspot.id, x: event.clientX, y: event.clientY, moved: false };
  }

  function onHotspotPointerMove(event: ReactPointerEvent) {
    const current = press.current;
    if (!editing || !current || !layer.current) return;
    if (
      !current.moved &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD
    ) {
      return;
    }
    current.moved = true;
    // Moves the button under the pointer at once; the store gets the result on release.
    const { x, y } = fractionIn(layer.current, event);
    const button = event.currentTarget as HTMLElement;
    button.style.left = `${x * 100}%`;
    button.style.top = `${y * 100}%`;
  }

  function onHotspotPointerUp(event: ReactPointerEvent, hotspot: Hotspot) {
    const current = press.current;
    press.current = null;
    if (!editing || !current || !layer.current) return;
    if (current.moved) {
      const { x, y } = fractionIn(layer.current, event);
      editing.onMove(item, hotspot.id, x, y);
    } else {
      editing.onEdit(item, hotspot);
    }
  }

  return (
    <div
      ref={layer}
      className={`${styles.layer} ${editing ? styles.editing : ""}`}
      onPointerDown={onLayerPointerDown}
    >
      {hotspots.map((hotspot) => (
        <button
          key={`${hotspot.id}-${hotspot.x ?? 0}-${hotspot.y ?? 0}`}
          type="button"
          className={styles.hotspot}
          style={
            {
              left: `${(hotspot.x ?? 0) * 100}%`,
              top: `${(hotspot.y ?? 0) * 100}%`,
            } as CSSProperties
          }
          aria-label={hotspot.label}
          title={hotspot.label}
          data-hotspot-id={hotspot.id}
          onPointerDown={(e) => onHotspotPointerDown(e, hotspot)}
          onPointerMove={onHotspotPointerMove}
          onPointerUp={(e) => onHotspotPointerUp(e, hotspot)}
          onClick={(event) => {
            event.stopPropagation();
            if (!editing) behavior.onActivate(item, hotspot);
          }}
          onKeyDown={(event) => {
            // In the editor, Enter edits the hotspot (the click above is ignored there).
            if (editing && event.key === "Enter") {
              event.preventDefault();
              editing.onEdit(item, hotspot);
            }
          }}
        >
          <span className={styles.dot} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
