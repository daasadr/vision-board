import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "../../design/components";
import { formatDate } from "../../i18n/format";
import type { Language } from "../../i18n";
import type { Task } from "../../lib/ipc";
import { addDays, MAX_TASK_LEN, tasksOfDay, type TaskStore } from "../../lib/tasks";
import styles from "./TaskList.module.css";

/**
 * `edit`: everything (board window); `check`: only ticking off (pop-up);
 * `read`: no controls at all (wallpaper).
 */
export type TaskListMode = "edit" | "check" | "read";

/** Today's and tomorrow's steps toward the vision. */
export function TaskList({ store, mode }: { store: TaskStore; mode: TaskListMode }) {
  const { t, i18n } = useTranslation();
  const today = useStore(store, (s) => s.today);
  const tasks = useStore(store, (s) => s.tasks);
  const leftover = useStore(store, (s) => s.leftover);
  const tomorrow = addDays(today, 1);
  const language = i18n.language as Language;
  const dateOf = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return formatDate(new Date(y, m - 1, d), language);
  };

  return (
    <aside
      className={`${styles.list} ${mode === "read" ? styles.read : ""}`}
      aria-label={t("tasks.label")}
    >
      <h2 className={styles.title}>{t("tasks.title")}</h2>
      {mode === "edit" && leftover.length > 0 && (
        <div className={styles.leftover} role="status">
          <p>{t("tasks.leftover", { count: leftover.length })}</p>
          <div className={styles.leftoverActions}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => store.getState().moveLeftoverToToday()}
            >
              {t("tasks.moveToToday")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => store.getState().dropLeftover()}>
              {t("tasks.drop")}
            </Button>
          </div>
        </div>
      )}
      {[
        { day: today, heading: t("tasks.today") },
        { day: tomorrow, heading: t("tasks.tomorrow") },
      ].map(({ day, heading }) => (
        <DaySection
          key={day}
          store={store}
          mode={mode}
          day={day}
          heading={heading}
          date={dateOf(day)}
          tasks={tasksOfDay(tasks, day)}
        />
      ))}
    </aside>
  );
}

function DaySection({
  store,
  mode,
  day,
  heading,
  date,
  tasks,
}: {
  store: TaskStore;
  mode: TaskListMode;
  day: string;
  heading: string;
  date: string;
  tasks: Task[];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  function add(event: FormEvent) {
    event.preventDefault();
    store.getState().add(day, draft);
    setDraft("");
  }

  return (
    <section className={styles.day} aria-labelledby={`day-${day}`}>
      <h3 id={`day-${day}`} className={styles.dayHeading}>
        {heading} <span className={styles.date}>{date}</span>
      </h3>
      {tasks.length === 0 && mode !== "edit" && <p className={styles.empty}>{t("tasks.none")}</p>}
      <ul className={styles.tasks}>
        {tasks.map((task, index) => (
          <TaskRow
            key={task.id}
            store={store}
            mode={mode}
            task={task}
            first={index === 0}
            last={index === tasks.length - 1}
          />
        ))}
      </ul>
      {mode === "edit" && (
        <form className={styles.addForm} onSubmit={add}>
          <input
            className={styles.addInput}
            value={draft}
            maxLength={MAX_TASK_LEN}
            placeholder={t("tasks.addPlaceholder")}
            aria-label={t("tasks.addTo", { day: heading })}
            onChange={(e) => setDraft(e.currentTarget.value)}
          />
        </form>
      )}
    </section>
  );
}

function TaskRow({
  store,
  mode,
  task,
  first,
  last,
}: {
  store: TaskStore;
  mode: TaskListMode;
  task: Task;
  first: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const actions = store.getState();

  function onEditKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      actions.edit(task.id, event.currentTarget.value);
      setEditing(false);
    } else if (event.key === "Escape") {
      setEditing(false);
    }
  }

  // Alt+arrows on the checkbox move the task within its day.
  function onRowKey(event: KeyboardEvent<HTMLInputElement>) {
    if (mode !== "edit" || !event.altKey) return;
    if (event.key === "ArrowUp" && !first) actions.move(task.id, -1);
    else if (event.key === "ArrowDown" && !last) actions.move(task.id, 1);
  }

  return (
    <li className={`${styles.task} ${task.done ? styles.done : ""}`}>
      {mode === "read" ? (
        <span className={styles.mark} aria-hidden="true">
          {task.done ? "✓" : "•"}
        </span>
      ) : (
        <input
          type="checkbox"
          className={styles.check}
          checked={task.done}
          aria-label={task.text}
          aria-keyshortcuts={mode === "edit" ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
          onChange={() => actions.toggle(task.id)}
          onKeyDown={onRowKey}
        />
      )}
      {editing ? (
        <input
          className={styles.editInput}
          defaultValue={task.text}
          maxLength={MAX_TASK_LEN}
          aria-label={t("tasks.editLabel")}
          // Editing starts from an explicit action, so focusing the field is expected.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onKeyDown={onEditKey}
          onBlur={(e) => {
            actions.edit(task.id, e.currentTarget.value);
            setEditing(false);
          }}
        />
      ) : (
        <span className={styles.text}>{task.text}</span>
      )}
      {mode === "edit" && !editing && (
        <span className={styles.rowActions}>
          <button
            type="button"
            className={styles.icon}
            aria-label={t("tasks.edit")}
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t("tasks.up")}
            disabled={first}
            onClick={() => actions.move(task.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t("tasks.down")}
            disabled={last}
            onClick={() => actions.move(task.id, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={t("tasks.remove")}
            onClick={() => actions.remove(task.id)}
          >
            ×
          </button>
        </span>
      )}
    </li>
  );
}
