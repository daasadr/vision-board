//! Domain logic independent of Tauri, so it can be unit-tested with `cargo test`.

pub mod app_state;
pub mod board;
pub mod db;
pub mod entitlements;
pub mod locale;
pub mod media;
pub mod window_placement;
