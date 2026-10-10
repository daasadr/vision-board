import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Notices, type Notice } from "../../design/components";
import { AppearanceSection } from "./AppearanceSection";
import { DisplaySection } from "./DisplaySection";
import { GeneralSection } from "./GeneralSection";
import styles from "./SettingsApp.module.css";
import { TimingSection } from "./TimingSection";
import type { Notify } from "./useSaveSettings";

const SECTIONS = ["general", "appearance", "timing", "display"] as const;
type Section = (typeof SECTIONS)[number];

/**
 * The settings window. Every change is stored right away (no Save button) and reaches all open
 * windows through the backend's settings event.
 */
export default function SettingsApp() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("general");
  const tabs = useRef<Record<Section, HTMLButtonElement | null>>({
    general: null,
    appearance: null,
    timing: null,
    display: null,
  });
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback<Notify>(
    (notice) => setNotices((list) => [...list, { ...notice, id: crypto.randomUUID() }]),
    [],
  );
  const dismiss = useCallback(
    (id: string) => setNotices((list) => list.filter((n) => n.id !== id)),
    [],
  );

  // Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
  function onTabKeyDown(event: KeyboardEvent) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = SECTIONS[(SECTIONS.indexOf(section) + step + SECTIONS.length) % SECTIONS.length];
    setSection(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <h1 className={styles.title}>{t("settings.title")}</h1>
        <div
          role="tablist"
          aria-label={t("settings.sections.label")}
          aria-orientation="vertical"
          className={styles.tabs}
        >
          {SECTIONS.map((name) => (
            <button
              key={name}
              ref={(el) => {
                tabs.current[name] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${name}`}
              aria-selected={section === name}
              aria-controls={`panel-${name}`}
              tabIndex={section === name ? 0 : -1}
              className={styles.tab}
              onClick={() => setSection(name)}
              onKeyDown={onTabKeyDown}
            >
              {t(`settings.sections.${name}`)}
            </button>
          ))}
        </div>
      </nav>
      <main
        className={styles.panel}
        role="tabpanel"
        id={`panel-${section}`}
        aria-labelledby={`tab-${section}`}
      >
        <h2 className={styles.heading}>{t(`settings.sections.${section}`)}</h2>
        {section === "general" && <GeneralSection notify={notify} />}
        {section === "appearance" && <AppearanceSection notify={notify} />}
        {section === "timing" && <TimingSection notify={notify} />}
        {section === "display" && <DisplaySection notify={notify} />}
      </main>
      <Notices notices={notices} onDismiss={dismiss} dismissLabel={t("common.dismiss")} />
    </div>
  );
}
