use chrono::Local;
use tauri::AppHandle;

use crate::domain::entitlements::{self, Feature};
use crate::{popup, preferences};

/// Shows the pop-up now, regardless of the schedule and the user's activity ("Try it").
#[tauri::command]
#[specta::specta]
pub async fn popup_show_now(app: AppHandle) -> Result<(), String> {
    popup::show(&app).map_err(|e| e.to_string())
}

/// Closes the pop-up on all monitors; with `snooze_minutes` it comes back after that long.
#[tauri::command]
#[specta::specta]
pub async fn popup_close(app: AppHandle, snooze_minutes: Option<u16>) {
    popup::close(&app, snooze_minutes);
}

/// The next planned showing as local date-time `YYYY-MM-DDTHH:MM:SS`, or none when the
/// schedule is off, locked or has no day enabled.
#[tauri::command]
#[specta::specta]
pub async fn schedule_next(app: AppHandle) -> Result<Option<String>, String> {
    let settings = preferences::current(&app).map_err(|e| e.to_string())?;
    if !settings.startup.scheduled_popup || !entitlements::is_enabled(Feature::ScheduledPopup) {
        return Ok(None);
    }
    Ok(settings
        .schedule
        .next_after(Local::now().naive_local())
        .map(|next| next.format("%Y-%m-%dT%H:%M:%S").to_string()))
}
