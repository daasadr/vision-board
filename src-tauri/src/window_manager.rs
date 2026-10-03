//! Creates, restores and focuses app windows. Windows are created on demand and destroyed
//! when closed, so no idle webview keeps memory.

use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_window_state::{StateFlags, WindowExt};

use crate::domain::window_placement::{self, Rect};

pub const BOARD: &str = "board";

/// Shows the board window, creating it from its config entry when it does not exist.
pub fn open_board(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(BOARD) {
        window.unminimize()?;
        window.show()?;
        return window.set_focus();
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == BOARD)
        .expect("board window is declared in tauri.conf.json");
    let window = WebviewWindowBuilder::from_config(app, config)?.build()?;

    // Restore is best-effort: a missing or corrupt state file just means default placement.
    let _ = window.restore_state(StateFlags::all() - StateFlags::VISIBLE);
    ensure_reachable(&window)?;
    window.show()?;
    window.set_focus()
}

/// Centers the window on the primary monitor when its restored position is off every monitor,
/// e.g. after the monitor it was last on was disconnected.
fn ensure_reachable(window: &WebviewWindow) -> tauri::Result<()> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;
    let current = Rect::new(position.x, position.y, size.width, size.height);

    let work_areas: Vec<Rect> = window
        .available_monitors()?
        .iter()
        .map(|m| {
            let area = m.work_area();
            Rect::new(
                area.position.x,
                area.position.y,
                area.size.width,
                area.size.height,
            )
        })
        .collect();
    if window_placement::is_reachable(current, &work_areas) {
        return Ok(());
    }

    let Some(primary) = window.primary_monitor()? else {
        return Ok(());
    };
    let area = primary.work_area();
    let target = window_placement::centered_in(
        size.width,
        size.height,
        Rect::new(
            area.position.x,
            area.position.y,
            area.size.width,
            area.size.height,
        ),
    );
    window.set_size(PhysicalSize::new(target.width, target.height))?;
    window.set_position(PhysicalPosition::new(target.x, target.y))
}
