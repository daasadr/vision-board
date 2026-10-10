//! Creates, restores and focuses app windows. Windows are created on demand and destroyed
//! when closed, so no idle webview keeps memory. The control widget is the only window that
//! stays open, and only while the user wants it (native on Windows, a webview elsewhere).

use tauri::menu::{Menu, MenuEvent, MenuItem};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_window_state::{StateFlags, WindowExt};

use crate::domain::settings::Settings;
use crate::domain::window_placement::{self, Rect};
#[cfg(not(target_os = "windows"))]
use crate::domain::window_placement::{CONTROL_HEIGHT, CONTROL_WIDTH};
use crate::{preferences, tray};

pub const BOARD: &str = "board";
pub const SETTINGS: &str = "settings";
/// The webview control widget (macOS, Linux); on Windows it is a native window.
#[cfg(not(target_os = "windows"))]
pub const CONTROL: &str = "control";

const CONTROL_MENU_OPEN: &str = "control-open";
const CONTROL_MENU_SETTINGS: &str = "control-settings";
const CONTROL_MENU_HIDE: &str = "control-hide";

/// Script that hands the stored settings to a new window before its page runs, so the first
/// render already has the right theme and language (read by src/lib/settings.ts).
pub(crate) fn settings_script(app: &AppHandle) -> String {
    let settings = preferences::current(app).unwrap_or_default();
    // JSON is a valid JavaScript expression.
    let json = serde_json::to_string(&settings).unwrap_or_else(|_| "undefined".into());
    format!("window.__VB_SETTINGS__ = {json};")
}

/// Shows an existing window; returns false when it does not exist.
fn reveal(app: &AppHandle, label: &str) -> tauri::Result<bool> {
    let Some(window) = app.get_webview_window(label) else {
        return Ok(false);
    };
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    Ok(true)
}

/// Shows the board window, creating it from its config entry when it does not exist.
pub fn open_board(app: &AppHandle) -> tauri::Result<()> {
    if reveal(app, BOARD)? {
        return Ok(());
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == BOARD)
        .expect("board window is declared in tauri.conf.json");
    let window = WebviewWindowBuilder::from_config(app, config)?
        .initialization_script(settings_script(app))
        .build()?;

    // Restore is best-effort: a missing or corrupt state file just means default placement.
    let _ = window.restore_state(StateFlags::all() - StateFlags::VISIBLE);
    ensure_reachable(&window)?;
    window.show()?;
    window.set_focus()
}

/// Shows the settings window, creating it when it does not exist. Closing destroys it.
pub fn open_settings(app: &AppHandle) -> tauri::Result<()> {
    if reveal(app, SETTINGS)? {
        return Ok(());
    }
    let settings = preferences::current(app).unwrap_or_default();
    let window = WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("index.html".into()))
        .title(tray::texts(&settings).settings_title)
        .inner_size(760.0, 560.0)
        .min_inner_size(640.0, 480.0)
        .center()
        .visible(false)
        .initialization_script(settings_script(app))
        .build()?;
    window.show()?;
    window.set_focus()
}

/// Where the control widget goes: where the user dragged it (if that is still on a monitor),
/// otherwise the top right corner of the primary monitor's work area, left of the caption
/// buttons of maximized windows. Returns the position in physical pixels and the primary
/// monitor's scale factor.
fn control_placement(
    app: &AppHandle,
    settings: &Settings,
) -> tauri::Result<Option<((i32, i32), f64)>> {
    let Some(primary) = app.primary_monitor()? else {
        return Ok(None);
    };
    let work_area = |m: &tauri::Monitor| {
        let area = m.work_area();
        Rect::new(
            area.position.x,
            area.position.y,
            area.size.width,
            area.size.height,
        )
    };
    let areas: Vec<Rect> = app.available_monitors()?.iter().map(work_area).collect();
    let scale = primary.scale_factor();
    let size = (
        (window_placement::CONTROL_WIDTH * scale).round() as u32,
        (window_placement::CONTROL_HEIGHT * scale).round() as u32,
    );
    let position = window_placement::control_origin(
        settings.control_position.map(|p| (p.x, p.y)),
        size,
        &areas,
        work_area(&primary),
        scale,
    );
    Ok(Some((position, scale)))
}

/// Shows, updates (theme, language, monitor) or hides the control widget to match the setting.
#[cfg(target_os = "windows")]
pub fn sync_control(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    let app_for_main = app.clone();
    // The native widget lives on the main thread, which pumps its messages.
    app.run_on_main_thread(move || native_control::sync(&app_for_main, visible))
}

/// Shows, updates (layer, position) or destroys the control widget to match the setting.
#[cfg(not(target_os = "windows"))]
pub fn sync_control(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    match (visible, app.get_webview_window(CONTROL)) {
        (true, None) => open_control(app),
        (true, Some(window)) => {
            let settings = preferences::current(app).unwrap_or_default();
            set_control_layer(&window, settings.control_layer)?;
            if let Some(((x, y), _)) = control_placement(app, &settings)? {
                window.set_position(PhysicalPosition::new(x, y))?;
            }
            Ok(())
        }
        (false, Some(window)) => window.destroy(),
        (false, None) => Ok(()),
    }
}

#[cfg(not(target_os = "windows"))]
fn set_control_layer(
    window: &WebviewWindow,
    layer: crate::domain::settings::ControlLayer,
) -> tauri::Result<()> {
    let front = layer == crate::domain::settings::ControlLayer::Front;
    window.set_always_on_bottom(!front)?;
    window.set_always_on_top(front)
}

/// On Windows the control widget is a native layered window showing bitmaps rendered from the
/// CSS design: a webview would add ~80 MB while it is the only window (the spec allows 30).
#[cfg(target_os = "windows")]
mod native_control {
    use std::rc::Rc;

    use tauri::AppHandle;

    use super::{control_placement, open_board, open_settings};
    use crate::domain::control_look;
    use crate::domain::settings::{ControlLayer, ControlPosition, ThemePreference};
    use crate::platform::{self, ControlEvent, ControlLook, ControlMenuItem};
    use crate::{preferences, tray};

    pub fn sync(app: &AppHandle, visible: bool) {
        if !visible {
            platform::control::hide();
            return;
        }
        let shown = look(app).and_then(|look| {
            let handle = app.clone();
            platform::control::show(look, Rc::new(move |event| on_event(&handle, event)))
                .map_err(|e| e.to_string())
        });
        if let Err(e) = shown {
            eprintln!("showing the control widget failed: {e}");
        }
    }

    fn look(app: &AppHandle) -> Result<ControlLook, String> {
        let settings = preferences::current(app).unwrap_or_default();
        let ((x, y), scale) = control_placement(app, &settings)
            .map_err(|e| e.to_string())?
            .ok_or("no monitor")?;
        let dark = match settings.theme {
            ThemePreference::Galerie => false,
            ThemePreference::Noc => true,
            ThemePreference::System => platform::system_prefers_dark(),
        };
        let bitmap = |hover| control_look::bitmap(dark, hover, scale).map_err(|e| e.to_string());
        let text = tray::texts(&settings);
        Ok(ControlLook {
            x,
            y,
            normal: bitmap(false)?,
            hover: bitmap(true)?,
            front: settings.control_layer == ControlLayer::Front,
            menu: [
                text.open.to_owned(),
                text.settings.to_owned(),
                text.reset_control_position.to_owned(),
                text.hide_control.to_owned(),
            ],
        })
    }

    fn on_event(app: &AppHandle, event: ControlEvent) {
        let app = app.clone();
        // Leave the window procedure first; windows are created from the async runtime.
        tauri::async_runtime::spawn(async move {
            let result = match event {
                ControlEvent::Click | ControlEvent::Menu(ControlMenuItem::Settings) => {
                    open_settings(&app).map_err(|e| e.to_string())
                }
                ControlEvent::Menu(ControlMenuItem::OpenBoard) => {
                    open_board(&app).map_err(|e| e.to_string())
                }
                ControlEvent::Menu(ControlMenuItem::Hide) => {
                    preferences::change(&app, |s| s.control_widget = false)
                        .map(|_| ())
                        .map_err(|e| e.to_string())
                }
                ControlEvent::Menu(ControlMenuItem::ResetPosition) => {
                    preferences::change(&app, |s| s.control_position = None)
                        .map(|_| ())
                        .map_err(|e| e.to_string())
                }
                ControlEvent::Moved { x, y } => preferences::change(&app, |s| {
                    s.control_position = Some(ControlPosition { x, y });
                })
                .map(|_| ())
                .map_err(|e| e.to_string()),
                ControlEvent::Refresh => {
                    // The OS theme or the monitors changed: the wallpaper may need a new image.
                    crate::wallpaper::refresh(&app, false);
                    let visible = preferences::current(&app).is_ok_and(|s| s.control_widget);
                    super::sync_control(&app, visible).map_err(|e| e.to_string())
                }
            };
            if let Err(e) = result {
                eprintln!("control widget action failed: {e}");
            }
        });
    }
}

/// The control widget (macOS, Linux): a small webview window outside the taskbar, above or
/// below other windows as set, that does not take focus when shown.
#[cfg(not(target_os = "windows"))]
fn open_control(app: &AppHandle) -> tauri::Result<()> {
    let settings = preferences::current(app).unwrap_or_default();
    let Some(((x, y), _)) = control_placement(app, &settings)? else {
        return Ok(());
    };
    let window = WebviewWindowBuilder::new(app, CONTROL, WebviewUrl::App("index.html".into()))
        .title("Vision Board")
        .inner_size(CONTROL_WIDTH, CONTROL_HEIGHT)
        .min_inner_size(CONTROL_WIDTH, CONTROL_HEIGHT)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .initialization_script(settings_script(app))
        .build()?;
    window.set_position(PhysicalPosition::new(x, y))?;
    set_control_layer(&window, settings.control_layer)?;
    window.show()
}

/// Translates the titles of open windows after the language changed.
pub fn retitle(app: &AppHandle, settings: &crate::domain::settings::Settings) {
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.set_title(tray::texts(settings).settings_title);
    }
}

/// Native context menu of the control widget (an HTML menu would not fit its window).
pub fn show_control_menu(window: &WebviewWindow) -> tauri::Result<()> {
    let app = window.app_handle();
    let settings = preferences::current(app).unwrap_or_default();
    let text = tray::texts(&settings);
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, CONTROL_MENU_OPEN, text.open, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                CONTROL_MENU_SETTINGS,
                text.settings,
                true,
                None::<&str>,
            )?,
            &MenuItem::with_id(
                app,
                CONTROL_MENU_HIDE,
                text.hide_control,
                true,
                None::<&str>,
            )?,
        ],
    )?;
    window.popup_menu(&menu)
}

/// Handles clicks in the control widget menu. Registered app-wide, because popup menu events
/// are delivered to the app, not to the window.
pub fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let result = match event.id().as_ref() {
        CONTROL_MENU_OPEN => open_board(app),
        CONTROL_MENU_SETTINGS => open_settings(app),
        CONTROL_MENU_HIDE => {
            if let Err(e) = preferences::change(app, |s| s.control_widget = false) {
                eprintln!("hiding the control widget failed: {e}");
            }
            Ok(())
        }
        _ => Ok(()),
    };
    if let Err(e) = result {
        eprintln!("control menu action failed: {e}");
    }
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
