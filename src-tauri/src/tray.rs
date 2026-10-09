//! Tray icon (notification area on Windows/Linux, menu bar on macOS).

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::domain::locale;
use crate::domain::settings::Settings;
use crate::state::Db;
use crate::{lifecycle, preferences, window_manager};

const TRAY_ID: &str = "main";
const OPEN_ID: &str = "open";
const SETTINGS_ID: &str = "settings";
const CONTROL_ID: &str = "control";
const QUIT_ID: &str = "quit";

/// Language of the native menus for the given settings.
pub fn texts(settings: &Settings) -> locale::Texts {
    let language = locale::resolve(settings.language, sys_locale::get_locale().as_deref());
    locale::texts(language)
}

fn menu(app: &AppHandle, settings: &Settings) -> tauri::Result<Menu<Wry>> {
    let text = texts(settings);
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, OPEN_ID, text.open, true, None::<&str>)?,
            &MenuItem::with_id(app, SETTINGS_ID, text.settings, true, None::<&str>)?,
            &CheckMenuItem::with_id(
                app,
                CONTROL_ID,
                text.control_widget,
                true,
                settings.control_widget,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT_ID, text.quit, true, None::<&str>)?,
        ],
    )
}

pub fn create(app: &AppHandle, settings: &Settings) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(texts(settings).tooltip)
        .menu(&menu(app, settings)?)
        // Left click opens the board; the menu is on right click (Windows/Linux).
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN_ID => {
                let _ = window_manager::open_board(app);
            }
            SETTINGS_ID => {
                let _ = window_manager::open_settings(app);
            }
            CONTROL_ID => toggle_control(app),
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

/// Rebuilds the menu after the language or the control widget setting changed.
pub fn update(app: &AppHandle, settings: &Settings) -> tauri::Result<()> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    tray.set_menu(Some(menu(app, settings)?))?;
    tray.set_tooltip(Some(texts(settings).tooltip))
}

fn toggle_control(app: &AppHandle) {
    let result = preferences::change(app, |s| s.control_widget = !s.control_widget);
    if let Err(e) = result {
        eprintln!("toggling the control widget failed: {e}");
        // The check mark already flipped in the native menu; put it back in line with the data.
        if let Ok(settings) = crate::domain::settings::load(&app.state::<Db>().lock()) {
            let _ = update(app, &settings);
        }
    }
}
