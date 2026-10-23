//! Public keys of Almost-there.eu that may sign Vision Board licenses.
//!
//! While `PRODUCTION` is empty the app does not enforce licenses: every premium feature stays
//! unlocked, as before phase 6. Licensing switches on with the release that adds the key
//! Almost-there.eu hands over (docs/almost-there-api.md, section 5). To rotate, add the new key
//! here first, ship that release, and only then start signing with it.

use super::license::TrustedKey;

pub const PRODUCTION: &[TrustedKey] = &[TrustedKey {
    kid: "at-2026-1",
    key: [
         0x2c, 0xb5, 0xcb, 0x4f, 0x04, 0x15, 0x35, 0x0c, 0x81, 0xcb, 0x82, 0x41, 0x17, 0xc3, 0xf9,
        0xa5, 0x2c, 0x6f, 0xc2, 0x12, 0x85, 0x62, 0xe8, 0x7d, 0xf1, 0x52, 0xa0, 0xbb, 0x0d, 0xf1,
        0x75, 0xea,
    ],
}];

/// Whether licenses decide about premium features.
pub fn enforced() -> bool {
    !PRODUCTION.is_empty()
}

