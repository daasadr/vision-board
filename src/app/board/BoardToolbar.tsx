import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import { ipc } from "../../lib/ipc";
import { settingsStore, useSettings } from "../../lib/settings";
import { useBoard, useBoardActions } from "./boardContext";
import styles from "./BoardToolbar.module.css";
import type { AddActions } from "./EmptyState";

/** Persistent bar for adding content, undo/redo, the images-only mode and the settings. */
export function BoardToolbar({ onAddImage, onAddQuote, onAddText }: AddActions) {
  const { t } = useTranslation();
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);
  const actions = useBoardActions();
  const imagesOnly = useSettings((s) => s.settings.imagesOnly);

  return (
    <div className={styles.bar} role="toolbar" aria-label={t("board.toolbar.label")}>
      {onAddImage && (
        <Button size="sm" variant="ghost" onClick={onAddImage}>
          {t("board.add.image")}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onAddQuote}>
        {t("board.add.quote")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onAddText}>
        {t("board.add.text")}
      </Button>
      <span className={styles.divider} aria-hidden="true" />
      <Button
        size="sm"
        variant="ghost"
        onClick={actions.undo}
        disabled={!canUndo}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        {t("board.toolbar.undo")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={actions.redo}
        disabled={!canRedo}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
      >
        {t("board.toolbar.redo")}
      </Button>
      <span className={styles.divider} aria-hidden="true" />
      <Button
        size="sm"
        variant="ghost"
        aria-pressed={imagesOnly}
        onClick={() => void settingsStore.getState().update({ imagesOnly: !imagesOnly })}
      >
        {t("board.toolbar.imagesOnly")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void ipc.openSettings()}>
        {t("board.toolbar.settings")}
      </Button>
    </div>
  );
}
