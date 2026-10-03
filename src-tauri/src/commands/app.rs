use tauri::{AppHandle, State};

use crate::domain::app_state::{self, AppFlag};
use crate::lifecycle::{self, Lifecycle};
use crate::state::Db;

/// Version of the running app, as declared in Cargo.toml.
#[tauri::command]
#[specta::specta]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

#[tauri::command]
#[specta::specta]
pub async fn app_flag_get(db: State<'_, Db>, flag: AppFlag) -> Result<bool, String> {
    app_state::is_set(&db.lock(), flag).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn app_flag_set(db: State<'_, Db>, flag: AppFlag) -> Result<(), String> {
    app_state::set(&db.lock(), flag).map_err(|e| e.to_string())
}

/// The board window stored its pending edits; quitting may continue.
#[tauri::command]
#[specta::specta]
pub fn app_ready_to_quit(lifecycle: State<'_, Lifecycle>) {
    lifecycle.frontend_saved();
}

/// Quits the app the same way the tray menu does: pending work finishes first.
#[tauri::command]
#[specta::specta]
pub fn app_quit(app: AppHandle) {
    lifecycle::request_quit(&app);
}
