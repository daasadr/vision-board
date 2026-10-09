import { useTranslation } from "react-i18next";
import { SegmentedControl, Switch } from "../../design/components";
import type { ThemePreference } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import { FramePicker } from "./FramePicker";
import styles from "./SettingsApp.module.css";
import { useSaveSettings, type Notify } from "./useSaveSettings";

const THEMES: ThemePreference[] = ["system", "galerie", "noc"];

/** Theme, the default image frame and the images-only mode. */
export function AppearanceSection({ notify }: { notify: Notify }) {
  const { t } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const save = useSaveSettings(notify);

  return (
    <>
      <SegmentedControl
        label={t("settings.theme.label")}
        value={settings.theme}
        options={THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }))}
        onChange={(theme) => void save({ theme })}
      />
      <div className={styles.group}>
        <FramePicker
          value={settings.frame}
          onChange={(frame) => void save({ frame })}
          onLocked={(frame) =>
            notify({
              tone: "info",
              message: t("settings.frames.locked", { name: t(`settings.frames.${frame}`) }),
            })
          }
        />
        <p className={styles.hint}>{t("settings.frames.hint")}</p>
      </div>
      <div className={styles.group}>
        <Switch
          label={t("settings.imagesOnly.label")}
          checked={settings.imagesOnly}
          onCheckedChange={(imagesOnly) => void save({ imagesOnly })}
        />
        <p className={styles.hint}>{t("settings.imagesOnly.hint")}</p>
      </div>
    </>
  );
}
