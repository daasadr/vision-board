import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../design/components";
import { ipc } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { SplitView } from "../tasks/SplitView";
import { useTaskStore } from "../tasks/useTaskStore";
import { TaskList } from "../tasks/TaskList";
import { BoardView } from "./BoardView";
import styles from "./PopupApp.module.css";

const SNOOZE_MINUTES = [5, 15, 60] as const;

/**
 * The pop-up: the board over all windows for the set duration. The countdown is a CSS
 * animation (no timers); hovering pauses it. Close, Snooze or Esc fade the pop-up out and the
 * backend closes it on every monitor.
 */
export default function PopupApp() {
  const { t } = useTranslation();
  const duration = useSettings((s) => s.settings.schedule.durationSecs);
  const full = useSettings((s) => s.settings.placement.mode === "full");
  const split = useSettings((s) => s.settings.split);
  const tasks = useTaskStore();
  const [leaving, setLeaving] = useState<{ snooze: number | null } | null>(null);
  const closed = useRef(false);

  const finish = useCallback((snooze: number | null) => {
    if (closed.current) return;
    closed.current = true;
    void ipc.closePopup(snooze);
  }, []);

  const leave = useCallback(
    (snooze: number | null) => {
      if (leaving) return;
      // Without motion there is no fade-out to wait for.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish(snooze);
      else setLeaving({ snooze });
    },
    [leaving, finish],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && leave(null);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leave]);

  return (
    <div
      className={`${styles.popup} ${full ? styles.full : styles.partial} ${leaving ? styles.leaving : ""}`}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) finish(leaving.snooze);
      }}
    >
      <main className={styles.board}>
        <h1 className={styles.srOnly}>{t("app.title")}</h1>
        {split.popup ? (
          <SplitView
            side={split.side}
            board={<BoardView />}
            tasks={<TaskList store={tasks} mode="check" />}
          />
        ) : (
          <BoardView />
        )}
      </main>
      <div className={styles.bar} role="toolbar" aria-label={t("popup.actions")}>
        <span
          className={styles.countdown}
          style={{ "--duration": `${duration}s` } as CSSProperties}
          data-testid="popup-countdown"
          aria-hidden="true"
          onAnimationEnd={(event) => {
            event.stopPropagation();
            leave(null);
          }}
        />
        <Button size="sm" variant="primary" onClick={() => leave(null)}>
          {t("popup.close")}
        </Button>
        <span className={styles.snoozeLabel}>{t("popup.snooze")}</span>
        {SNOOZE_MINUTES.map((minutes) => (
          <Button key={minutes} size="sm" variant="ghost" onClick={() => leave(minutes)}>
            {t("popup.minutes", { count: minutes })}
          </Button>
        ))}
      </div>
    </div>
  );
}
