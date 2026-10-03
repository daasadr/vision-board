use crate::domain::entitlements::{self, Entitlement};

/// Availability of every premium feature. Features not listed are free.
#[tauri::command]
#[specta::specta]
pub fn entitlements_get() -> Vec<Entitlement> {
    entitlements::all()
}
