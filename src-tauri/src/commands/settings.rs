use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

use crate::domain::settings::{self, Settings};
use crate::preferences;
use crate::state::Db;

#[tauri::command]
#[specta::specta]
pub async fn settings_get(db: State<'_, Db>) -> Result<Settings, String> {
    settings::load(&db.lock()).map_err(|e| e.to_string())
}

/// Stores the whole settings document and applies it in every window. Returns the stored value,
/// which may differ from the input (values are brought into their allowed ranges).
#[tauri::command]
#[specta::specta]
pub async fn settings_set(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    preferences::store(&app, settings).map_err(|e| e.to_string())
}

/// Restores the default settings, which includes not starting at login. The board itself is
/// not touched.
#[tauri::command]
#[specta::specta]
pub async fn settings_reset(app: AppHandle) -> Result<Settings, String> {
    let stored = preferences::store(&app, Settings::default()).map_err(|e| e.to_string())?;
    if app.autolaunch().is_enabled().unwrap_or(false) {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }
    Ok(stored)
}

/// Whether the app is registered to start at login. The OS registration is the source of
/// truth, so a change made in the OS tools shows here too.
#[tauri::command]
#[specta::specta]
pub async fn autostart_get(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Registers or unregisters the app to start at login (in the tray, without a window).
#[tauri::command]
#[specta::specta]
pub async fn autostart_set(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let result = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    result.map_err(|e| e.to_string())?;
    launcher.is_enabled().map_err(|e| e.to_string())
}
