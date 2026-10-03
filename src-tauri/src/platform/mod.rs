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
