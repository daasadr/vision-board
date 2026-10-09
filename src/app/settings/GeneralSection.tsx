import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogClose, SegmentedControl, Switch } from "../../design/components";
import { ipc, type LanguagePreference } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import styles from "./SettingsApp.module.css";
import { useSaveSettings, type Notify } from "./useSaveSettings";

const LANGUAGES: LanguagePreference[] = ["system", "cs", "en", "de"];

/**
 * Starting at login. The OS registration is the source of truth, so the switch reads it when
 * shown (and after a reset) instead of keeping it in the settings.
 */
function AutostartSwitch({ notify, resets }: { notify: Notify; resets: number }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    ipc
      .autostart()
      .then((value) => active && setEnabled(value))
      .catch((error: unknown) => {
        console.error("Reading autostart failed", error);
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [resets]);

  async function change(value: boolean) {
    setEnabled(value);
    try {
      setEnabled(await ipc.setAutostart(value));
    } catch (error) {
      console.error("Changing autostart failed", error);
      setEnabled(!value);
      notify({ tone: "error", message: t("settings.autostart.error") });
    }
  }

  return (
    <div className={styles.group}>
      <Switch
        label={t("settings.autostart.label")}
        checked={enabled ?? false}
        disabled={enabled === null}
        onCheckedChange={(value) => void change(value)}
      />
      <p className={styles.hint}>{t("settings.autostart.hint")}</p>
    </div>
  );
}

/** Language, the desktop control and restoring the defaults. */
export function GeneralSection({ notify }: { notify: Notify }) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings(notify);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resets, setResets] = useState(0);

  return (
    <>
      <SegmentedControl
        label={t("settings.language.label")}
        value={settings.language}
        options={LANGUAGES.map((value) => ({
          value,
          label:
            value === "system"
              ? t("settings.language.system")
              : t(`settings.language.names.${value}`),
        }))}
        onChange={(language) => void save({ language })}
      />
      <AutostartSwitch notify={notify} resets={resets} />
      <div className={styles.group}>
        <Switch
          label={t("settings.control.label")}
          checked={settings.controlWidget}
          onCheckedChange={(controlWidget) => void save({ controlWidget })}
        />
        <p className={styles.hint}>{t("settings.control.hint")}</p>
      </div>
      <div className={`${styles.group} ${styles.danger}`}>
        <Dialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          trigger={<Button>{t("settings.reset.button")}</Button>}
          title={t("settings.reset.title")}
          description={t("settings.reset.body")}
          actions={
            <>
              <DialogClose asChild>
                <Button variant="ghost">{t("common.cancel")}</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmReset(false);
                  // Resetting also turns autostart off; the switch reads it again afterwards.
                  void save("reset").then(() => setResets((n) => n + 1));
                }}
              >
                {t("settings.reset.confirm")}
              </Button>
            </>
          }
        />
      </div>
    </>
  );
}
