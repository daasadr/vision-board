//! The pop-up: the board shown over all windows on every monitor for a while. It does not take
//! focus until the user clicks into it, and gives focus back to the app the user was in.

use std::sync::Mutex;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

use crate::domain::placement;
use crate::domain::settings::PlacementMode;
use crate::domain::window_placement::Rect;
use crate::{platform, preferences, scheduler, window_manager};

/// Pop-up windows are labelled `popup-0`, `popup-1`, … one per monitor.
pub const LABEL_PREFIX: &str = "popup-";

#[derive(Default)]
pub struct Popup {
    /// The window that had focus before the pop-up appeared.
    previous_foreground: Mutex<Option<isize>>,
}

fn is_popup(label: &str) -> bool {
    label.starts_with(LABEL_PREFIX)
}

/// Shows the board on every monitor where the display settings place it. Does nothing while
/// it is already shown.
pub fn show(app: &AppHandle) -> tauri::Result<()> {
    if app.webview_windows().keys().any(|l| is_popup(l)) {
        return Ok(());
    }
    let settings = preferences::current(app).unwrap_or_default();
    *app.state::<Popup>()
        .previous_foreground
        .lock()
        .unwrap_or_else(|p| p.into_inner()) = platform::foreground_window();

    for (index, monitor) in app.available_monitors()?.iter().enumerate() {
        let rect = if settings.placement.mode == PlacementMode::Full {
            let (pos, size) = (monitor.position(), monitor.size());
            Rect::new(pos.x, pos.y, size.width, size.height)
        } else {
            let area = monitor.work_area();
            placement::rect_in(
                Rect::new(
                    area.position.x,
                    area.position.y,
                    area.size.width,
                    area.size.height,
                ),
                settings.placement,
            )
        };
        let label = format!("{LABEL_PREFIX}{index}");
        let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
            .title("Vision Board")
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focused(false)
            .visible(false)
            .initialization_script(window_manager::settings_script(app))
            .build()?;
        window.set_size(PhysicalSize::new(rect.width, rect.height))?;
        window.set_position(PhysicalPosition::new(rect.x, rect.y))?;
        window.show()?;
        platform::hide_from_task_switcher(&window);
    }
    Ok(())
}

/// Closes the pop-up on all monitors and, when the user had clicked into it, gives focus back
/// to the window that had it before. `snooze_minutes` shows it again later.
pub fn close(app: &AppHandle, snooze_minutes: Option<u16>) {
    let windows: Vec<_> = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| is_popup(label))
        .map(|(_, w)| w)
        .collect();
    let had_focus = windows.iter().any(|w| w.is_focused().unwrap_or(false));
    for window in windows {
        let _ = window.destroy();
    }
    let previous = app
        .state::<Popup>()
        .previous_foreground
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .take();
    if let (true, Some(previous)) = (had_focus, previous) {
        platform::restore_foreground(previous);
    }
    if let Some(minutes) = snooze_minutes {
        scheduler::snooze(app, minutes.clamp(1, 24 * 60));
    }
}
