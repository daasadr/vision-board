//! OS-specific integrations (Win32, AppKit, X11). This is the only place allowed to use
//! platform FFI; the rest of the app talks to it through safe, cross-platform functions.
//!
//! `unsafe` is denied crate-wide; platform submodules that need FFI opt in with
//! `#![allow(unsafe_code)]` and document the safety invariants of every unsafe block.

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "windows")]
pub use windows::{control, system_prefers_dark};

use crate::domain::activity::Activity;

/// Time since the last input and the OS busy/away flags (see `domain::activity`). On Linux
/// nothing is known, so the board shows at the planned time without waiting for a pause.
pub fn activity() -> Activity {
    #[cfg(target_os = "windows")]
    return windows::activity();
    #[cfg(target_os = "macos")]
    return macos::activity();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    Activity::default()
}

/// The window in the foreground, to give focus back after the pop-up (Windows only).
pub fn foreground_window() -> Option<isize> {
    #[cfg(target_os = "windows")]
    return windows::foreground_window();
    #[cfg(not(target_os = "windows"))]
    None
}

pub fn restore_foreground(window: isize) {
    #[cfg(target_os = "windows")]
    windows::restore_foreground(window);
    #[cfg(not(target_os = "windows"))]
    let _ = window;
}

/// Keeps a shown window out of Alt+Tab (Windows; elsewhere `skip_taskbar` is enough).
pub fn hide_from_task_switcher(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    windows::hide_from_task_switcher(window);
    #[cfg(not(target_os = "windows"))]
    let _ = window;
}

/// What the native control widget shows and where (physical pixels, top-left corner).
#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
pub struct ControlLook {
    pub x: i32,
    pub y: i32,
    pub normal: crate::domain::control_look::Bitmap,
    pub hover: crate::domain::control_look::Bitmap,
    /// Above all windows; otherwise kept at the bottom (desktop level).
    pub front: bool,
    /// Labels of the context menu: open board, settings, back to the corner, hide.
    pub menu: [String; 4],
}

/// Something the user did with the native control widget, or a display change that may need
/// a new look (theme, scaling, monitor layout).
#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlEvent {
    Click,
    Menu(ControlMenuItem),
    /// The user dragged the widget; its new top-left corner in physical pixels.
    Moved {
        x: i32,
        y: i32,
    },
    Refresh,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlMenuItem {
    OpenBoard,
    Settings,
    ResetPosition,
    Hide,
}
