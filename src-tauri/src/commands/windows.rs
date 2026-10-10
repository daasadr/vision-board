use tauri::{AppHandle, WebviewWindow};

use crate::window_manager;

// Window commands are async: creating a window from a synchronous command can deadlock on
// Windows.

/// Opens (or focuses) the settings window.
#[tauri::command]
#[specta::specta]
pub async fn window_open_settings(app: AppHandle) -> Result<(), String> {
    window_manager::open_settings(&app).map_err(|e| e.to_string())
}

/// Opens the detail window of a hotspot (it loads the data itself from the stored board).
#[tauri::command]
#[specta::specta]
pub async fn window_open_detail(
    app: AppHandle,
    item_id: String,
    hotspot_id: String,
) -> Result<(), String> {
    if item_id.len() > 64 || hotspot_id.len() > 64 {
        return Err("invalid id".to_owned());
    }
    window_manager::open_detail(&app, &item_id, &hotspot_id).map_err(|e| e.to_string())
}

/// Shows the native context menu of the control widget at the pointer.
#[tauri::command]
#[specta::specta]
pub async fn control_context_menu(window: WebviewWindow) -> Result<(), String> {
    window_manager::show_control_menu(&window).map_err(|e| e.to_string())
}
