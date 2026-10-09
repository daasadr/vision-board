import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import { useEntitlement } from "../../lib/entitlements";
import { FRAMES, isPremiumFrame } from "../../lib/frames";
import type { FrameStyle, Item } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { useBoardActions } from "./boardContext";
import type { Fit } from "./geometry";
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

/** Actions for the selected item, floating above it in screen space (not scaled). */
export function ItemToolbar({ item, fit, onEdit }: { item: Item; fit: Fit; onEdit: () => void }) {
  const { t } = useTranslation();
  const actions = useBoardActions();
  const centerX = (item.x + item.w / 2) * fit.scale + fit.offsetX;
  const top = item.y * fit.scale + fit.offsetY;
  // Flip below the item when there is no room above.
  const y = top > GAP ? top - GAP : (item.y + item.h) * fit.scale + fit.offsetY + GAP / 3;

  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label={t("board.item.actions")}
      style={{ left: centerX, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button size="sm" variant="ghost" onClick={() => actions.bringToFront(item.id)}>
        {t("board.item.bringToFront")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => actions.sendToBack(item.id)}>
        {t("board.item.sendToBack")}
      </Button>
      {item.content.kind === "image" ? (
        <FrameSelect item={item} />
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
