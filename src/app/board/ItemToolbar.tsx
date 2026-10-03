import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import type { Item } from "../../lib/ipc";
import { useBoardActions } from "./boardContext";
import type { Fit } from "./geometry";
import styles from "./ItemToolbar.module.css";

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
      {item.content.kind !== "image" && (
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
