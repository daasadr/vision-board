import { useRef, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "../../lib/ipc";
import styles from "./ControlApp.module.css";

/** Strongest tilt at the edge of the bar, in degrees. */
const MAX_TILT = 14;

/**
 * The control widget: a small 3D bar in the corner of the screen. A click opens the settings,
 * a right click the native menu (open board, settings, hide). It only moves while the pointer
 * is over it, so it costs no CPU at rest.
 */
export default function ControlApp() {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);

  // Tilt follows the pointer through CSS variables, without re-rendering React.
  function onPointerMove(event: PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    el.style.setProperty("--tilt-x", `${(-y * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--glare-x", `${(x * 50).toFixed(1)}%`);
  }

  function onPointerLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--tilt-x");
    el.style.removeProperty("--tilt-y");
    el.style.removeProperty("--glare-x");
  }

  return (
    <div className={styles.stage}>
      <button
        ref={ref}
        type="button"
        className={styles.bar}
        aria-label={t("control.label")}
        title={t("control.label")}
        onClick={() => void ipc.openSettings()}
        onContextMenu={(event) => {
          event.preventDefault();
          void ipc.controlMenu();
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <span className={styles.label} aria-hidden="true">
          {t("app.title")}
        </span>
      </button>
    </div>
  );
}
