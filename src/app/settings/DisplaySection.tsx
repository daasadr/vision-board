import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedControl, Slider, Switch } from "../../design/components";
import { useEntitlement } from "../../lib/entitlements";
import type { Anchor, Placement, PlacementMode } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import styles from "./DisplaySection.module.css";
import { placementRect } from "./placement";
import sectionStyles from "./SettingsApp.module.css";
import { useSaveSettings, type Notify } from "./useSaveSettings";

const MODES: PlacementMode[] = ["full", "partial"];
const ANCHORS: Anchor[] = ["topLeft", "topRight", "center", "bottomLeft", "bottomRight"];
/** The preview screen, in the same units as `placementRect` (a 16:9 screen). */
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };

/** Where the board shows outside the main window (scheduled display, wallpaper). */
export function DisplaySection({ notify }: { notify: Notify }) {
  const { t } = useTranslation();
  const stored = useSettings((s) => s.settings.placement);
  const save = useSaveSettings(notify);
  // While the slider moves, the preview follows a local value; it is stored on release.
  const [draftSize, setDraftSize] = useState<number | null>(null);
  const placement: Placement = { ...stored, size: draftSize ?? stored.size };
  const update = (patch: Partial<Placement>) => void save({ placement: { ...stored, ...patch } });

  return (
    <>
      <WallpaperSwitch notify={notify} />
      <div className={sectionStyles.group}>
        <SegmentedControl
          label={t("settings.placement.mode")}
          value={placement.mode}
          options={MODES.map((value) => ({ value, label: t(`settings.placement.${value}`) }))}
          onChange={(mode) => update({ mode })}
        />
        <p className={sectionStyles.hint}>{t("settings.placement.hint")}</p>
      </div>
      {placement.mode === "partial" && (
        <div className={styles.controls}>
          <Slider
            label={t("settings.placement.size")}
            min={30}
            max={90}
            step={5}
            value={placement.size}
            valueText={t("settings.placement.sizeValue", { value: placement.size })}
            onChange={setDraftSize}
            onCommit={(size) => {
              setDraftSize(null);
              if (size !== stored.size) update({ size });
            }}
          />
          <AnchorPicker value={placement.anchor} onChange={(anchor) => update({ anchor })} />
        </div>
      )}
      <PlacementPreview placement={placement} />
    </>
  );
}

/** The wallpaper works on Windows for now (macOS and Linux follow). */
const WALLPAPER_SUPPORTED = /Windows/i.test(navigator.userAgent);

/** The board as the desktop wallpaper, behind the icons. */
function WallpaperSwitch({ notify }: { notify: Notify }) {
  const { t } = useTranslation();
  const startup = useSettings((s) => s.settings.startup);
  const save = useSaveSettings(notify);
  const unlocked = useEntitlement("wallpaper");
  const available = unlocked === true && WALLPAPER_SUPPORTED;
  return (
    <div className={sectionStyles.group}>
      <Switch
        label={t("settings.wallpaper.label")}
        checked={startup.wallpaper && available}
        disabled={!available}
        onCheckedChange={(wallpaper) => void save({ startup: { ...startup, wallpaper } })}
      />
      <p className={sectionStyles.hint}>
        {unlocked === false
          ? t("settings.wallpaper.locked")
          : WALLPAPER_SUPPORTED
            ? t("settings.wallpaper.hint")
            : t("settings.wallpaper.windowsOnly")}
      </p>
    </div>
  );
}

/** The five anchors as positions on a small screen. */
function AnchorPicker({ value, onChange }: { value: Anchor; onChange: (a: Anchor) => void }) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className={styles.anchors}>
      <legend className={styles.legend}>{t("settings.placement.anchor")}</legend>
      <div className={styles.anchorGrid}>
        {ANCHORS.map((anchor) => (
          <label key={anchor} className={styles.anchor} data-anchor={anchor}>
            <input
              type="radio"
              className={styles.anchorRadio}
              name={name}
              value={anchor}
              checked={value === anchor}
              aria-label={t(`settings.placement.${anchor}`)}
              onChange={() => onChange(anchor)}
            />
            <span className={styles.anchorDot} aria-hidden="true" />
          </label>
        ))}
      </div>
      <p className={styles.anchorName}>{t(`settings.placement.${value}`)}</p>
    </fieldset>
  );
}

/** A screen outline with the board drawn where it will appear. */
function PlacementPreview({ placement }: { placement: Placement }) {
  const { t } = useTranslation();
  const rect = placementRect(SCREEN, placement);
  const percent = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <figure className={styles.preview}>
      <div className={styles.screen} role="img" aria-label={t("settings.placement.preview")}>
        <div
          className={styles.board}
          data-testid="placement-preview-board"
          style={{
            left: percent(rect.x, SCREEN.width),
            top: percent(rect.y, SCREEN.height),
            width: percent(rect.width, SCREEN.width),
            height: percent(rect.height, SCREEN.height),
          }}
        />
      </div>
    </figure>
  );
}
