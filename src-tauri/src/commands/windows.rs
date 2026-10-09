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

/// Shows the native context menu of the control widget at the pointer.
#[tauri::command]
#[specta::specta]
pub async fn control_context_menu(window: WebviewWindow) -> Result<(), String> {
    window_manager::show_control_menu(&window).map_err(|e| e.to_string())
}
