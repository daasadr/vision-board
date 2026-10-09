//! Domain logic independent of Tauri, so it can be unit-tested with `cargo test`.

pub mod app_state;
pub mod board;
// The native control widget exists on Windows only; elsewhere the widget is a webview.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub mod control_look;
pub mod db;
pub mod entitlements;
pub mod locale;
pub mod media;
// Used by the scheduled pop-up and the wallpaper (phases 3 and 4).
#[allow(dead_code)]
pub mod placement;
pub mod settings;
pub mod window_placement;
