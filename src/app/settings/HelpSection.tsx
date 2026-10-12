import { useTranslation } from "react-i18next";
import styles from "./HelpSection.module.css";

/** Topics in reading order; the texts are in the locales under `help.topics.<id>`. */
const TOPICS = [
  "start",
  "board",
  "hotspots",
  "tasks",
  "popup",
  "wallpaper",
  "control",
  "privacy",
  "updates",
] as const;

/** A short guide to the app: one collapsible topic per feature, the first one open. */
export function HelpSection() {
  const { t } = useTranslation();
  return (
    <div className={styles.help}>
      <p className={styles.intro}>{t("help.intro")}</p>
      {TOPICS.map((topic, index) => {
        const items = t(`help.topics.${topic}.items`, { returnObjects: true }) as string[];
        return (
          <details key={topic} className={styles.topic} open={index === 0}>
            <summary className={styles.summary}>{t(`help.topics.${topic}.title`)}</summary>
            <ul className={styles.items}>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
