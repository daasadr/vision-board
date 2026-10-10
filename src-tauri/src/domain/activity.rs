//! Whether now is a good moment to pop the board up. The only inputs are the time since the
//! last keyboard/mouse input and the OS "busy" (fullscreen, presentation, do not disturb) and
//! "away" (locked, screen saver) flags. Nothing about what the user does is read.

use std::time::Duration;

/// What the OS tells about the user right now.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Activity {
    /// Time since the last input; None where the OS does not tell (then the pause is not
    /// waited for).
    pub idle: Option<Duration>,
    /// Fullscreen app, presentation or do not disturb.
    pub busy: bool,
    /// Screen locked, screen saver or another user session.
    pub away: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Show,
    /// Check again after this long.
    Wait(Duration),
    /// No good moment within the maximum delay: drop this showing.
    Skip,
}

/// Longest gap between two checks while waiting for a good moment.
pub const CHECK_EVERY: Duration = Duration::from_secs(5);
/// Idle longer than this means the user is not at the computer.
pub const AWAY_AFTER: Duration = Duration::from_secs(10 * 60);

/// `waited`: how long this showing has been waiting; `pause`: required input pause;
/// `max_delay`: how long it may wait at most.
pub fn decide(
    activity: Activity,
    waited: Duration,
    pause: Duration,
    max_delay: Duration,
) -> Decision {
    if waited >= max_delay {
        return Decision::Skip;
    }
    if activity.away || activity.busy {
        return Decision::Wait(CHECK_EVERY);
    }
    match activity.idle {
        None => Decision::Show,
        Some(idle) if idle >= AWAY_AFTER => Decision::Wait(CHECK_EVERY),
        Some(idle) if idle >= pause => Decision::Show,
        Some(idle) => Decision::Wait((pause - idle).clamp(Duration::from_millis(250), CHECK_EVERY)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PAUSE: Duration = Duration::from_secs(5);
    const MAX: Duration = Duration::from_secs(30 * 60);

    fn idle(secs: u64) -> Activity {
        Activity {
            idle: Some(Duration::from_secs(secs)),
            ..Activity::default()
        }
    }

    fn secs(s: u64) -> Duration {
        Duration::from_secs(s)
    }

    #[test]
    fn waits_while_the_user_types_and_shows_after_a_pause() {
        assert_eq!(
            decide(idle(1), secs(0), PAUSE, MAX),
            Decision::Wait(secs(4))
        );
        assert_eq!(decide(idle(5), secs(4), PAUSE, MAX), Decision::Show);
    }

    #[test]
    fn checks_at_most_every_five_seconds() {
        let long_pause = secs(30);
        assert_eq!(
            decide(idle(0), secs(0), long_pause, MAX),
            Decision::Wait(CHECK_EVERY)
        );
    }

    #[test]
    fn a_presentation_or_fullscreen_app_postpones() {
        let presenting = Activity {
            busy: true,
            ..idle(60)
        };
        assert_eq!(
            decide(presenting, secs(60), PAUSE, MAX),
            Decision::Wait(CHECK_EVERY)
        );
    }

    #[test]
    fn a_locked_screen_or_absent_user_postpones() {
        let locked = Activity {
            away: true,
            ..idle(20)
        };
        assert_eq!(
            decide(locked, secs(0), PAUSE, MAX),
            Decision::Wait(CHECK_EVERY)
        );
        assert_eq!(
            decide(idle(11 * 60), secs(0), PAUSE, MAX),
            Decision::Wait(CHECK_EVERY)
        );
    }

    #[test]
    fn gives_up_after_the_maximum_delay() {
        let gaming = Activity {
            busy: true,
            ..idle(0)
        };
        assert_eq!(
            decide(gaming, secs(29 * 60), PAUSE, MAX),
            Decision::Wait(CHECK_EVERY)
        );
        assert_eq!(decide(gaming, secs(30 * 60), PAUSE, MAX), Decision::Skip);
    }

    #[test]
    fn unknown_idle_time_shows_at_once() {
        assert_eq!(
            decide(Activity::default(), secs(0), PAUSE, MAX),
            Decision::Show
        );
    }
}
