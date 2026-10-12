import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Notice } from "../../design/components";
import { ipc } from "../../lib/ipc";
import { useUpdateStatus } from "../../lib/updates";

/** Remembers in this browser profile which version the user was already told about. */
const SEEN_KEY = "vb.update-notice-seen";

function seen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function markSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // Without storage the notice may show again next time; harmless.
  }
}

/** Tells the user once per version that an update can be installed, with an Install button. */
export function useUpdateNotice(notify: (notice: Omit<Notice, "id">) => void) {
  const { t } = useTranslation();
  const [status] = useUpdateStatus();
  const shown = useRef<string | null>(null);
  const version = status?.available?.version ?? null;

  useEffect(() => {
    if (!version || shown.current === version || seen() === version) return;
    shown.current = version;
    markSeen(version);
    notify({
      message: t("updates.notice", { version }),
      persistent: true,
      action: {
        label: t("updates.install"),
        onClick: () => {
          ipc.installUpdate().catch((error: unknown) => {
            console.error("Installing the update failed", error);
            notify({ tone: "error", message: t("settings.updates.installFailed") });
          });
        },
      },
    });
  }, [version, notify, t]);
}
