//! Public keys of Almost-there.eu that may sign Vision Board licenses.
//!
//! While `PRODUCTION` is empty the app does not enforce licenses: every premium feature stays
//! unlocked, as before phase 6. Licensing switches on with the release that adds the key
//! Almost-there.eu hands over (docs/almost-there-api.md, section 5). To rotate, add the new key
//! here first, ship that release, and only then start signing with it.

use super::license::TrustedKey;

pub const PRODUCTION: &[TrustedKey] = &[];

/// Whether licenses decide about premium features.
pub fn enforced() -> bool {
    !PRODUCTION.is_empty()
}
