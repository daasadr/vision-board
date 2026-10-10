use tauri::AppHandle;

/// The off-screen renderer page has drawn the board (images and fonts loaded); the backend
/// captures it now.
#[tauri::command]
#[specta::specta]
pub fn wallpaper_rendered(app: AppHandle) {
    crate::wallpaper::rendered(&app);
}
