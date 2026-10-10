//! macOS implementation of the platform integrations.
#![allow(unsafe_code)]

use std::time::Duration;

use crate::domain::activity::Activity;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state: i32, event_type: u32) -> f64;
}

/// kCGEventSourceStateCombinedSessionState
const COMBINED_SESSION_STATE: i32 = 0;
/// kCGAnyInputEventType
const ANY_INPUT_EVENT: u32 = u32::MAX;

/// Time since the last input. Needs no Input Monitoring permission: it reads a counter, not
/// events. Fullscreen, do not disturb and the lock screen are not detected yet.
pub fn activity() -> Activity {
    // SAFETY: a pure query with two plain integer arguments.
    let seconds =
        unsafe { CGEventSourceSecondsSinceLastEventType(COMBINED_SESSION_STATE, ANY_INPUT_EVENT) };
    Activity {
        idle: (seconds.is_finite() && seconds >= 0.0).then(|| Duration::from_secs_f64(seconds)),
        busy: false,
        away: false,
    }
}
