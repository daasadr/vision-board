//! When to look for a newer version: never right at start (login is busy enough), then once a
//! day. Times are wall-clock milliseconds, so a restart or a sleeping computer does not cause
//! extra checks.

/// The first check waits this long after the app started.
pub const START_DELAY_MS: i64 = 60_000;
/// Time between two automatic checks.
pub const INTERVAL_MS: i64 = 24 * 60 * 60 * 1000;

/// Wall-clock moment of the next automatic check.
///
/// A last check "in the future" means the clock was moved back; it is ignored, otherwise the
/// app would not check again until the clock caught up.
pub fn next_check(last_check: Option<i64>, started: i64, now: i64) -> i64 {
    let earliest = started + START_DELAY_MS;
    match last_check {
        Some(last) if last <= now => (last + INTERVAL_MS).max(earliest),
        _ => earliest,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const START: i64 = 1_800_000_000_000;

    #[test]
    fn first_check_waits_after_start() {
        assert_eq!(next_check(None, START, START), START + START_DELAY_MS);
    }

    #[test]
    fn checks_once_a_day() {
        let last = START - 1000;
        assert_eq!(next_check(Some(last), START, START), last + INTERVAL_MS);
    }

    #[test]
    fn an_old_check_still_waits_for_the_start_delay() {
        let last = START - 3 * INTERVAL_MS;
        assert_eq!(next_check(Some(last), START, START), START + START_DELAY_MS);
    }

    #[test]
    fn ignores_a_last_check_in_the_future() {
        let last = START + 30 * INTERVAL_MS;
        assert_eq!(next_check(Some(last), START, START), START + START_DELAY_MS);
    }
}
