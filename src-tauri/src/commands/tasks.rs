use tauri::{AppHandle, State};

use crate::domain::tasks::{self, Task, TaskOp};
use crate::state::Db;

use super::now_ms;

fn day_or_error(day: &str) -> Result<(), String> {
    tasks::is_day(day)
        .then_some(())
        .ok_or_else(|| format!("not a day: {day}"))
}

/// Tasks of the days `from..=to` (`YYYY-MM-DD`), by day and position.
#[tauri::command]
#[specta::specta]
pub async fn tasks_list(db: State<'_, Db>, from: String, to: String) -> Result<Vec<Task>, String> {
    day_or_error(&from)?;
    day_or_error(&to)?;
    tasks::list(&db.lock(), &from, &to).map_err(|e| e.to_string())
}

/// Undone tasks of days before `day`, offered to be moved to it or dropped.
#[tauri::command]
#[specta::specta]
pub async fn tasks_unfinished_before(db: State<'_, Db>, day: String) -> Result<Vec<Task>, String> {
    day_or_error(&day)?;
    tasks::unfinished_before(&db.lock(), &day).map_err(|e| e.to_string())
}

/// Stores a batch of task edits atomically and tells the other windows (the board shows the
/// list in split view, the pop-up and the wallpaper too).
#[tauri::command]
#[specta::specta]
pub async fn tasks_apply(
    app: AppHandle,
    db: State<'_, Db>,
    ops: Vec<TaskOp>,
) -> Result<(), String> {
    tasks::apply(&mut db.lock(), &ops, now_ms()).map_err(|e| e.to_string())?;
    crate::preferences::tasks_changed(&app);
    Ok(())
}
