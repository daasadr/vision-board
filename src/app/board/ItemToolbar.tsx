import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import { useEntitlement } from "../../lib/entitlements";
import { FRAMES, isPremiumFrame } from "../../lib/frames";
import type { FrameStyle, Item } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { useBoardActions } from "./boardContext";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Fit } from "./geometry";
import { placeToolbar } from "./toolbarPlacement";
import styles from "./ItemToolbar.module.css";

const BOARD_DEFAULT = "default";

/**
 * The frame of one image: the board default or its own. Premium frames without the
 * entitlement are listed but cannot be picked (the settings explain how to unlock them).
 */
function FrameSelect({ item }: { item: Item }) {
  const { t } = useTranslation();
  const actions = useBoardActions();
  const boardFrame = useSettings((s) => s.settings.frame);
  const premium = useEntitlement("premiumFrames");
  const name = (frame: FrameStyle) => t(`settings.frames.${frame}`);

  return (
    <label className={styles.frame}>
      {t("board.item.frame")}
      <select
        className={styles.frameSelect}
        value={item.style?.frame ?? BOARD_DEFAULT}
        onChange={(event) => {
          const value = event.currentTarget.value;
          const frame = value === BOARD_DEFAULT ? null : (value as FrameStyle);
          actions.update(item.id, { style: { ...item.style, frame } });
        }}
      >
        <option value={BOARD_DEFAULT}>
          {t("board.item.frameDefault", { name: name(boardFrame) })}
        </option>
        {FRAMES.map((frame) => {
          const locked = isPremiumFrame(frame) && premium !== true;
          return (
            <option key={frame} value={frame} disabled={locked}>
              {locked ? `${name(frame)} (${t("settings.frames.premium")})` : name(frame)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/** Space between the item top and the toolbar: clears the rotate handle above the item. */
const GAP = 96;

/** Actions for the selected item, floating above it in screen space (not scaled), always fully
 * inside the board area. */
export function ItemToolbar({
  item,
  fit,
  onEdit,
  hotspotsEditing,
  onToggleHotspots,
}: {
  item: Item;
  fit: Fit;
  onEdit: () => void;
  hotspotsEditing: boolean;
  onToggleHotspots: () => void;
}) {
  const { t } = useTranslation();
  const actions = useBoardActions();
  const ref = useRef<HTMLDivElement>(null);
  // The toolbar's own size (it differs for images and texts and wraps in a narrow window);
  // null until measured before the first paint.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setSize((previous) =>
        previous?.width === element.offsetWidth && previous.height === element.offsetHeight
          ? previous
          : { width: element.offsetWidth, height: element.offsetHeight },
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const viewport = {
    width: CANVAS_WIDTH * fit.scale + 2 * fit.offsetX,
    height: CANVAS_HEIGHT * fit.scale + 2 * fit.offsetY,
  };
  const onScreen = {
    x: item.x * fit.scale + fit.offsetX,
    y: item.y * fit.scale + fit.offsetY,
    w: item.w * fit.scale,
    h: item.h * fit.scale,
  };
  const position = placeToolbar(onScreen, viewport, size ?? { width: 0, height: 0 }, GAP);

  return (
    <div
      ref={ref}
      className={styles.toolbar}
      role="toolbar"
      aria-label={t("board.item.actions")}
      // Hidden until measured, so it never flashes at a clipped position.
      style={{ left: position.x, top: position.y, visibility: size ? undefined : "hidden" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button size="sm" variant="ghost" onClick={() => actions.bringToFront(item.id)}>
        {t("board.item.bringToFront")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => actions.sendToBack(item.id)}>
        {t("board.item.sendToBack")}
      </Button>
      {item.content.kind === "image" ? (
        <>
          <FrameSelect item={item} />
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={hotspotsEditing}
            onClick={onToggleHotspots}
          >
            {hotspotsEditing ? t("board.item.hotspotsDone") : t("board.item.hotspots")}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={onEdit}>
          {t("board.item.edit")}
        </Button>
      )}
      <span className={styles.divider} aria-hidden="true" />
      <Button size="sm" variant="ghost" onClick={() => actions.remove(item.id)}>
        {t("board.item.delete")}
      </Button>
    </div>
  );
}
