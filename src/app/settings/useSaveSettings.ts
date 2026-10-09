import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Notice } from "../../design/components";
import type { Settings } from "../../lib/ipc";
import { settingsStore } from "../../lib/settings";

export type Notify = (notice: Omit<Notice, "id">) => void;

/** Stores a settings change and tells the user when it could not be saved (it is rolled back). */
export function useSaveSettings(notify: Notify) {
  const { t } = useTranslation();
  return useCallback(
    async (patch: Partial<Settings> | "reset") => {
      const state = settingsStore.getState();
      const saved = patch === "reset" ? await state.reset() : await state.update(patch);
      if (!saved) notify({ tone: "error", message: t("settings.saveError") });
    },
    [notify, t],
  );
}
