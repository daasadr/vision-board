//! Domain logic independent of Tauri, so it can be unit-tested with `cargo test`.

pub mod activity;
pub mod app_state;
pub mod board;
// The native control widget exists on Windows only; elsewhere the widget is a webview.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub mod control_look;
pub mod db;
pub mod entitlements;
pub mod locale;
pub mod media;
pub mod placement;
pub mod schedule;
pub mod settings;
// The wallpaper is implemented on Windows only so far.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub mod wallpaper;
pub mod window_placement;
