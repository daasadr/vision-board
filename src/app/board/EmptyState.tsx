import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import styles from "./EmptyState.module.css";

export interface AddActions {
  onAddImage?: () => void;
  onAddQuote: () => void;
  onAddText: () => void;
}

/** Shown over an empty board: explains what to do and offers the first actions. */
export function EmptyState({ onAddImage, onAddQuote, onAddText }: AddActions) {
  const { t } = useTranslation();
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2 className={styles.title}>{t("board.empty.title")}</h2>
        <p className={styles.body}>{t("board.empty.body")}</p>
        <div className={styles.actions}>
          {onAddImage && (
            <Button variant="primary" onClick={onAddImage}>
              {t("board.add.image")}
            </Button>
          )}
          <Button variant={onAddImage ? "secondary" : "primary"} onClick={onAddQuote}>
            {t("board.add.quote")}
          </Button>
          <Button onClick={onAddText}>{t("board.add.text")}</Button>
        </div>
      </div>
    </div>
  );
}
