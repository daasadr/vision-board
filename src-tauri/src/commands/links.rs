use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::domain::board;

/// Opens a hotspot link in the default browser, never inside the app. The address is checked
/// again here (http or https only), whatever the frontend sent.
#[tauri::command]
#[specta::specta]
pub async fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    if !board::is_web_link(&url) {
        return Err("only http and https links can be opened".to_owned());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
