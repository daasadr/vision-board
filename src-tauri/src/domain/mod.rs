//! Domain logic independent of Tauri, so it can be unit-tested with `cargo test`.

// Phase 6 licensing; wired into the app in the next tasks (vb-av3).
#[allow(dead_code)]
pub mod activation;
pub mod activity;
pub mod app_state;
pub mod board;
// The native control widget exists on Windows only; elsewhere the widget is a webview.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub mod control_look;
pub mod db;
pub mod entitlements;
#[allow(dead_code)]
pub mod license;
#[allow(dead_code)]
pub mod license_keys;
pub mod locale;
pub mod media;
pub mod placement;
pub mod schedule;
pub mod settings;
pub mod tasks;
pub mod updates;
// The wallpaper is implemented on Windows only so far.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub mod wallpaper;
pub mod window_placement;
