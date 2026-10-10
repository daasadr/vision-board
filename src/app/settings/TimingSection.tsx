import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, SegmentedControl, Slider, Switch } from "../../design/components";
import { formatDate, formatTime } from "../../i18n/format";
import type { Language } from "../../i18n";
import { useEntitlement } from "../../lib/entitlements";
import { ipc, type Schedule } from "../../lib/ipc";
import { useSettings } from "../../lib/settings";
import styles from "./SettingsApp.module.css";
import { minutesToTime, parseLocal, timeToMinutes } from "./time";
import timing from "./TimingSection.module.css";
import { useSaveSettings, type Notify } from "./useSaveSettings";

const MAX_TIMES = 12;
const INTERVALS = [15, 30, 60, 90, 120, 180, 240, 480];
const DURATIONS = [15, 30, 60, 120, 300] as const;
const MAX_DELAYS = [15, 30, 60, 120] as const;
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** When the board pops up over all windows, and how. */
export function TimingSection({ notify }: { notify: Notify }) {
  const { t, i18n } = useTranslation();
  const settings = useSettings((s) => s.settings);
  const schedule = settings.schedule;
  const enabled = settings.startup.scheduledPopup;
  const save = useSaveSettings(notify);
  const unlocked = useEntitlement("scheduledPopup");
  const next = useNextShowing(settings);
  const [draftPause, setDraftPause] = useState<number | null>(null);

  const update = (patch: Partial<Schedule>) => void save({ schedule: { ...schedule, ...patch } });
  const language = i18n.language as Language;

  return (
    <>
      <div className={styles.group}>
        <Switch
          label={t("settings.timing.enabled")}
          checked={enabled && unlocked === true}
          disabled={unlocked !== true}
          onCheckedChange={(on) =>
            void save({ startup: { ...settings.startup, scheduledPopup: on } })
          }
        />
        <p className={styles.hint}>
          {unlocked === false ? t("settings.timing.locked") : t("settings.timing.hint")}
        </p>
        <div className={timing.row}>
          <Button size="sm" onClick={() => void ipc.showPopupNow()}>
            {t("settings.timing.tryIt")}
          </Button>
          {enabled && unlocked && (
            <span className={timing.next} role="status">
              {next
                ? t("settings.timing.next", {
                    date: formatDate(next, language),
                    time: formatTime(next, language),
                  })
                : t("settings.timing.noNext")}
            </span>
          )}
        </div>
      </div>

      {enabled && unlocked && (
        <>
          <fieldset className={timing.fieldset}>
            <legend className={timing.legend}>{t("settings.timing.times")}</legend>
            <div className={timing.times}>
              {schedule.times.map((minutes, index) => (
                <span key={`${minutes}-${index}`} className={timing.time}>
                  <input
                    type="time"
                    className={timing.input}
                    aria-label={t("settings.timing.timeN", { n: index + 1 })}
                    defaultValue={minutesToTime(minutes)}
                    onBlur={(event) => {
                      const value = timeToMinutes(event.currentTarget.value);
                      if (value === null || value === minutes) return;
                      update({ times: schedule.times.map((m, i) => (i === index ? value : m)) });
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("settings.timing.removeTime", { time: minutesToTime(minutes) })}
                    onClick={() => update({ times: schedule.times.filter((_, i) => i !== index) })}
                  >
                    ×
                  </Button>
                </span>
              ))}
              {schedule.times.length < MAX_TIMES && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({ times: [...schedule.times, nextFreeTime(schedule.times)] })
                  }
                >
                  {t("settings.timing.addTime")}
                </Button>
              )}
            </div>
          </fieldset>

          <div className={styles.group}>
            <Switch
              label={t("settings.timing.repeat")}
              checked={schedule.interval !== null}
              onCheckedChange={(on) => update({ interval: on ? 60 : null })}
            />
            {schedule.interval !== null && (
              <div className={timing.row}>
                <label className={timing.inline}>
                  {t("settings.timing.every")}
                  <select
                    className={timing.input}
                    value={schedule.interval}
                    onChange={(e) => update({ interval: Number(e.currentTarget.value) })}
                  >
                    {INTERVALS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {formatMinutes(minutes, t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={timing.inline}>
                  {t("settings.timing.from")}
                  <input
                    type="time"
                    className={timing.input}
                    defaultValue={minutesToTime(schedule.windowStart)}
                    onBlur={(e) => {
                      const value = timeToMinutes(e.currentTarget.value);
                      if (value !== null) update({ windowStart: value });
                    }}
                  />
                </label>
                <label className={timing.inline}>
                  {t("settings.timing.to")}
                  <input
                    type="time"
                    className={timing.input}
                    defaultValue={minutesToTime(schedule.windowEnd)}
                    onBlur={(e) => {
                      const value = timeToMinutes(e.currentTarget.value);
                      if (value !== null) update({ windowEnd: value });
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          <fieldset className={timing.fieldset}>
            <legend className={timing.legend}>{t("settings.timing.days")}</legend>
            <div className={timing.days}>
              {DAY_KEYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={timing.day}
                  aria-pressed={schedule.days[index]}
                  aria-label={t(`settings.timing.dayNames.${day}`)}
                  onClick={() =>
                    update({
                      days: schedule.days.map((on, i) =>
                        i === index ? !on : on,
                      ) as Schedule["days"],
                    })
                  }
                >
                  {t(`settings.timing.dayShort.${day}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <SegmentedControl
            label={t("settings.timing.duration")}
            value={String(nearest(DURATIONS, schedule.durationSecs))}
            options={DURATIONS.map((secs) => ({
              value: String(secs),
              label:
                secs < 60
                  ? t("settings.timing.seconds", { count: secs })
                  : formatMinutes(secs / 60, t),
            }))}
            onChange={(value) => update({ durationSecs: Number(value) })}
          />

          <div className={styles.group}>
            <Slider
              label={t("settings.timing.pause")}
              min={2}
              max={30}
              value={draftPause ?? schedule.pauseSecs}
              valueText={t("settings.timing.seconds", { count: draftPause ?? schedule.pauseSecs })}
              onChange={setDraftPause}
              onCommit={(pauseSecs) => {
                setDraftPause(null);
                if (pauseSecs !== schedule.pauseSecs) update({ pauseSecs });
              }}
            />
            <p className={styles.hint}>{t("settings.timing.pauseHint")}</p>
          </div>

          <div className={styles.group}>
            <SegmentedControl
              label={t("settings.timing.maxDelay")}
              value={String(nearest(MAX_DELAYS, schedule.maxDelayMin))}
              options={MAX_DELAYS.map((minutes) => ({
                value: String(minutes),
                label: formatMinutes(minutes, t),
              }))}
              onChange={(value) => update({ maxDelayMin: Number(value) })}
            />
            <p className={styles.hint}>{t("settings.timing.maxDelayHint")}</p>
          </div>
        </>
      )}
    </>
  );
}

/** The next planned showing, refreshed whenever the settings change. */
function useNextShowing(settings: unknown): Date | null {
  const [next, setNext] = useState<Date | null>(null);
  useEffect(() => {
    let active = true;
    ipc
      .nextShowing()
      .then((value) => active && setNext(value ? parseLocal(value) : null))
      .catch(() => active && setNext(null));
    return () => {
      active = false;
    };
  }, [settings]);
  return next;
}

function nearest<T extends number>(options: readonly T[], value: number): T {
  return options.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best));
}

/** A free time for a new entry: an hour after the last one, wrapping around midnight. */
function nextFreeTime(times: number[]): number {
  let candidate = times.length ? (Math.max(...times) + 60) % 1440 : 9 * 60;
  while (times.includes(candidate)) candidate = (candidate + 15) % 1440;
  return candidate;
}

function formatMinutes(minutes: number, t: TFunction): string {
  return minutes % 60 === 0
    ? t("settings.timing.hours", { count: minutes / 60 })
    : t("settings.timing.minutes", { count: minutes });
}
