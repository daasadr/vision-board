import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Frame } from "../../design/components";
import { useEntitlement } from "../../lib/entitlements";
import { FRAMES, isPremiumFrame } from "../../lib/frames";
import type { FrameStyle } from "../../lib/ipc";
import styles from "./FramePicker.module.css";

interface Props {
  value: FrameStyle;
  onChange: (frame: FrameStyle) => void;
  /** A locked premium frame was chosen; it is not applied. */
  onLocked: (frame: FrameStyle) => void;
}

/**
 * Frame styles as cards with a small framed sample. Premium frames without the entitlement
 * stay visible with a lock; choosing one explains how to unlock it instead of applying it.
 */
export function FramePicker({ value, onChange, onLocked }: Props) {
  const { t } = useTranslation();
  const name = useId();
  const premium = useEntitlement("premiumFrames");

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{t("settings.frames.label")}</legend>
      <div className={styles.cards}>
        {FRAMES.map((frame) => {
          const isPremium = isPremiumFrame(frame);
          // Unknown yet (null) counts as locked, so a premium frame never flashes as available.
          const locked = isPremium && premium !== true;
          return (
            <label key={frame} className={styles.card} data-locked={locked || undefined}>
              <input
                type="radio"
                className={styles.radio}
                name={name}
                value={frame}
                checked={value === frame}
                aria-describedby={locked ? `${name}-${frame}-lock` : undefined}
                onChange={() => (locked ? onLocked(frame) : onChange(frame))}
              />
              <span className={styles.sample} aria-hidden="true">
                <Frame frame={frame} width={96}>
                  <span className={styles.photo} />
                </Frame>
              </span>
              <span className={styles.name}>{t(`settings.frames.${frame}`)}</span>
              {isPremium && (
                <span className={styles.badge} id={`${name}-${frame}-lock`}>
                  {locked && <LockIcon />}
                  {t("settings.frames.premium")}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lock} viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="5.5" width="8" height="5.5" rx="1.2" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
    </svg>
  );
}
