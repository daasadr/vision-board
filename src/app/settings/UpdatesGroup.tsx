import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch } from "../../design/components";
import { ipc } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { useUpdateStatus } from "../../lib/updates";
import styles from "./SettingsApp.module.css";
import { useSaveSettings, type Notify } from "./useSaveSettings";

type Activity = "idle" | "checking" | "upToDate" | "installing";

/** The running version, automatic checks, "Check now" and installing a found version. */
export function UpdatesGroup({ notify }: { notify: Notify }) {
  const { t } = useTranslation();
  const autoCheck = useSettings((s) => s.settings.updates.autoCheck);
  const save = useSaveSettings(notify);
  const [status, setStatus] = useUpdateStatus();
  const [activity, setActivity] = useState<Activity>("idle");
  const available = status?.available ?? null;

  async function check() {
    if (!status) return;
    setActivity("checking");
    try {
      const found = await ipc.checkForUpdate();
      setStatus({ ...status, available: found });
      setActivity(found ? "idle" : "upToDate");
    } catch (error) {
      console.error("Checking for updates failed", error);
      setActivity("idle");
      notify({ tone: "error", message: t("settings.updates.checkFailed") });
    }
  }

  async function install() {
    setActivity("installing");
    try {
      await ipc.installUpdate();
    } catch (error) {
      console.error("Installing the update failed", error);
      notify({ tone: "error", message: t("settings.updates.installFailed") });
    }
    setActivity("idle");
  }

  return (
    <section className={styles.group} aria-labelledby="updates-title">
      <h3 id="updates-title" className={styles.subheading}>
        {t("settings.updates.title")}
      </h3>
      {status && (
        <p className={styles.hint}>{t("settings.updates.version", { version: status.current })}</p>
      )}
      <Switch
        label={t("settings.updates.autoCheck")}
        checked={autoCheck}
        onCheckedChange={(value) => void save({ updates: { autoCheck: value } })}
      />
      <p className={styles.hint}>{t("settings.updates.hint")}</p>
      <div role="status" aria-live="polite">
        {available ? (
          <div className={styles.update}>
            <p className={styles.updateTitle}>
              {t("settings.updates.available", { version: available.version })}
            </p>
            {available.notes && (
              <details>
                <summary>{t("settings.updates.notes")}</summary>
                <p className={styles.notes}>{available.notes}</p>
              </details>
            )}
          </div>
        ) : (
          activity === "upToDate" && <p className={styles.hint}>{t("settings.updates.upToDate")}</p>
        )}
      </div>
      <div className={styles.actions}>
        {available ? (
          <Button
            variant="primary"
            disabled={activity === "installing"}
            onClick={() => void install()}
          >
            {activity === "installing"
              ? t("settings.updates.installing")
              : t("settings.updates.install")}
          </Button>
        ) : (
          <Button disabled={!status || activity === "checking"} onClick={() => void check()}>
            {activity === "checking" ? t("settings.updates.checking") : t("settings.updates.check")}
          </Button>
        )}
      </div>
    </section>
  );
}
