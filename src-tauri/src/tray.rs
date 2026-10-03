//! Tray icon (notification area on Windows/Linux, menu bar on macOS).

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;

use crate::domain::locale;
use crate::{lifecycle, window_manager};

const OPEN_ID: &str = "open";
const QUIT_ID: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let language = locale::detect(sys_locale::get_locale().as_deref());
    let text = locale::tray_text(language);
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, OPEN_ID, text.open, true, None::<&str>)?,
            &MenuItem::with_id(app, QUIT_ID, text.quit, true, None::<&str>)?,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(text.tooltip)
        .menu(&menu)
        // Left click opens the board; the menu is on right click (Windows/Linux).
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN_ID => {
                let _ = window_manager::open_board(app);
            }
            QUIT_ID => lifecycle::request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = window_manager::open_board(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
