use tauri::AppHandle;

use crate::updates::{self, AvailableUpdate, UpdateStatus};

/// The running version and the version that can be installed, if a check found one.
#[tauri::command]
#[specta::specta]
pub fn update_status(app: AppHandle) -> UpdateStatus {
    updates::status(&app)
}

/// "Check now": asks GitHub Releases right away, also with automatic checks off.
#[tauri::command]
#[specta::specta]
pub async fn update_check(app: AppHandle) -> Result<Option<AvailableUpdate>, String> {
    updates::check(&app).await
}

/// Installs the found version and restarts. Returns only when installing failed (or, on
/// macOS and Linux, never: the app restarts).
#[tauri::command]
#[specta::specta]
pub async fn update_install(app: AppHandle) -> Result<(), String> {
    updates::install(&app).await
}
