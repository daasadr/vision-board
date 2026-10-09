//! Stored settings and their effects outside the frontend: the tray menu, the control widget
//! and the `settings://changed` event every window listens to.

use tauri::{AppHandle, Emitter, Manager};

use crate::domain::settings::{self, Settings};
use crate::state::Db;
use crate::{tray, window_manager};

/// Event carrying the new settings to every window. Matches SETTINGS_CHANGED_EVENT in
/// src/lib/settings.ts.
pub const SETTINGS_CHANGED_EVENT: &str = "settings://changed";

pub fn current(app: &AppHandle) -> rusqlite::Result<Settings> {
    settings::load(&app.state::<Db>().lock())
}

/// Stores the settings and applies them everywhere. Returns what was stored (normalized).
pub fn store(app: &AppHandle, settings: Settings) -> rusqlite::Result<Settings> {
    // The lock is released before applying: creating a window reads the settings again.
    let stored = settings::save(&app.state::<Db>().lock(), settings)?;
    apply(app, &stored);
    Ok(stored)
}

/// Changes part of the stored settings, e.g. from a native menu.
pub fn change(app: &AppHandle, edit: impl FnOnce(&mut Settings)) -> rusqlite::Result<Settings> {
    let mut settings = current(app)?;
    edit(&mut settings);
    store(app, settings)
}

fn apply(app: &AppHandle, settings: &Settings) {
    if let Err(e) = tray::update(app, settings) {
        eprintln!("updating the tray menu failed: {e}");
    }
    window_manager::retitle(app, settings);
    if let Err(e) = window_manager::sync_control(app, settings.control_widget) {
        eprintln!("showing or hiding the control widget failed: {e}");
    }
    let _ = app.emit(SETTINGS_CHANGED_EVENT, settings);
}
