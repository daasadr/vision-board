import { useEffect } from "react";
import { Button } from "./Button";
import styles from "./Notices.module.css";

export interface Notice {
  id: string;
  message: string;
  tone?: "info" | "error";
  /** A button next to the message; using it also dismisses the notice. */
  action?: { label: string; onClick: () => void };
  /** Stays until dismissed, whatever the timeout. */
  persistent?: boolean;
}

interface Props {
  notices: Notice[];
  onDismiss: (id: string) => void;
  /** Auto-dismiss after this many ms; 0 keeps notices until dismissed. */
  timeoutMs?: number;
  dismissLabel: string;
}

/** Short, non-blocking messages stacked at the bottom of the window (polite live region). */
export function Notices({ notices, onDismiss, timeoutMs = 6000, dismissLabel }: Props) {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {notices.map((notice) => (
        <NoticeView
          key={notice.id}
          notice={notice}
          onDismiss={onDismiss}
          timeoutMs={timeoutMs}
          dismissLabel={dismissLabel}
        />
      ))}
    </div>
  );
}

function NoticeView({
  notice,
  onDismiss,
  timeoutMs,
  dismissLabel,
}: {
  notice: Notice;
  onDismiss: (id: string) => void;
  timeoutMs: number;
  dismissLabel: string;
}) {
  useEffect(() => {
    if (timeoutMs <= 0 || notice.persistent) return;
    const timer = setTimeout(() => onDismiss(notice.id), timeoutMs);
    return () => clearTimeout(timer);
  }, [notice.id, notice.persistent, onDismiss, timeoutMs]);

  return (
    <div className={`${styles.notice} ${notice.tone === "error" ? styles.error : ""}`}>
      <p className={styles.message}>{notice.message}</p>
      {notice.action && (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            notice.action?.onClick();
            onDismiss(notice.id);
          }}
        >
          {notice.action.label}
        </Button>
      )}
      <button
        type="button"
        className={styles.dismiss}
        aria-label={dismissLabel}
        onClick={() => onDismiss(notice.id)}
      >
        ×
      </button>
    </div>
  );
}
