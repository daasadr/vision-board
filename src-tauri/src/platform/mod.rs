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
