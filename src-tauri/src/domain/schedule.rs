//! When the board pops up: fixed times and/or an interval within a daily window, on chosen
//! weekdays. All times are local wall-clock times (minutes since midnight).

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, NaiveTime};
use serde::{Deserialize, Serialize};
use specta::Type;

const MINUTES_PER_DAY: u16 = 24 * 60;
pub const MAX_TIMES: usize = 12;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    /// Fixed times of day, minutes since midnight (0–12 of them).
    pub times: Vec<u16>,
    /// Repeat every n minutes (15–480) within the window; none: no repetition.
    pub interval: Option<u16>,
    /// Window of the interval, minutes since midnight; the end is exclusive.
    pub window_start: u16,
    pub window_end: u16,
    /// Monday to Sunday.
    pub days: [bool; 7],
    /// How long the board stays up (10–600 s).
    pub duration_secs: u16,
    /// Input pause to wait for before showing (2–30 s).
    pub pause_secs: u16,
    /// Give up on one showing after this long without a good moment (5–120 min).
    pub max_delay_min: u16,
}

impl Default for Schedule {
    fn default() -> Self {
        Self {
            times: vec![9 * 60],
            interval: None,
            window_start: 9 * 60,
            window_end: 18 * 60,
            days: [true; 7],
            duration_secs: 30,
            pause_secs: 5,
            max_delay_min: 30,
        }
    }
}

impl Schedule {
    /// Brings every value into its allowed range; times are sorted and unique.
    pub fn normalized(mut self) -> Self {
        self.times.retain(|t| *t < MINUTES_PER_DAY);
        self.times.sort_unstable();
        self.times.dedup();
        self.times.truncate(MAX_TIMES);
        self.interval = self.interval.map(|i| i.clamp(15, 480));
        self.window_start = self.window_start.min(MINUTES_PER_DAY - 1);
        self.window_end = self.window_end.min(MINUTES_PER_DAY);
        if self.window_end <= self.window_start {
            let default = Self::default();
            self.window_start = default.window_start;
            self.window_end = default.window_end;
        }
        self.duration_secs = self.duration_secs.clamp(10, 600);
        self.pause_secs = self.pause_secs.clamp(2, 30);
        self.max_delay_min = self.max_delay_min.clamp(5, 120);
        self
    }

    fn on(&self, day: NaiveDate) -> bool {
        self.days[day.weekday().num_days_from_monday() as usize]
    }

    /// The day's moments, in order, each marked whether it comes from the interval.
    fn moments(&self, day: NaiveDate) -> Vec<(u16, bool)> {
        if !self.on(day) {
            return Vec::new();
        }
        let mut moments: Vec<(u16, bool)> = self.times.iter().map(|t| (*t, false)).collect();
        if let Some(step) = self.interval.filter(|s| *s > 0) {
            let mut t = self.window_start;
            while t < self.window_end {
                moments.push((t, true));
                t = t.saturating_add(step);
            }
        }
        moments.sort_unstable();
        // A fixed time that coincides with an interval moment is one moment.
        moments.dedup_by_key(|m| m.0);
        moments
    }

    /// The first moment strictly after `after`, if any day of the week is enabled.
    pub fn next_after(&self, after: NaiveDateTime) -> Option<NaiveDateTime> {
        (0..=7).find_map(|offset| {
            let day = after.date() + Duration::days(offset);
            self.moments(day)
                .into_iter()
                .map(|(minute, _)| at(day, minute))
                .find(|moment| *moment > after)
        })
    }

    /// The moment to act on now, given the last time the schedule was checked: the latest
    /// moment in `(last, now]`, but only while it still makes sense after a gap (sleep,
    /// shutdown): it must be today, and an interval moment only while the window lasts.
    /// Several missed moments collapse into this one.
    pub fn due(&self, last: NaiveDateTime, now: NaiveDateTime) -> Option<NaiveDateTime> {
        let today = now.date();
        let (minute, from_interval) = self.moments(today).into_iter().rfind(|(m, _)| {
            let moment = at(today, *m);
            moment > last && moment <= now
        })?;
        let now_minute = (now
            .time()
            .signed_duration_since(NaiveTime::MIN)
            .num_minutes()) as u16;
        if from_interval && now_minute >= self.window_end {
            return None;
        }
        Some(at(today, minute))
    }
}

fn at(day: NaiveDate, minute: u16) -> NaiveDateTime {
    day.and_hms_opt(u32::from(minute / 60), u32::from(minute % 60), 0)
        .expect("minute of the day is within 0..1440")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 2026-10-05 is a Monday.
    fn t(day: u32, hour: u32, minute: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 10, day)
            .and_then(|d| d.and_hms_opt(hour, minute, 0))
            .expect("valid date")
    }

    fn weekdays() -> [bool; 7] {
        [true, true, true, true, true, false, false]
    }

    #[test]
    fn daily_reminder_on_weekdays() {
        let s = Schedule {
            times: vec![8 * 60 + 30],
            days: weekdays(),
            ..Schedule::default()
        };
        assert_eq!(s.next_after(t(5, 7, 0)), Some(t(5, 8, 30)));
        assert_eq!(s.next_after(t(5, 8, 30)), Some(t(6, 8, 30)));
        // Friday after the reminder → Monday.
        assert_eq!(s.next_after(t(9, 9, 0)), Some(t(12, 8, 30)));
    }

    #[test]
    fn interval_within_the_window_and_fixed_times_together() {
        let s = Schedule {
            times: vec![7 * 60, 10 * 60],
            interval: Some(120),
            window_start: 9 * 60,
            window_end: 14 * 60,
            ..Schedule::default()
        };
        let mut moments = Vec::new();
        let mut cursor = t(5, 0, 0);
        while let Some(next) = s.next_after(cursor).filter(|n| n.date() == cursor.date()) {
            moments.push(next.time().to_string());
            cursor = next;
        }
        assert_eq!(
            moments,
            ["07:00:00", "09:00:00", "10:00:00", "11:00:00", "13:00:00"]
        );
    }

    #[test]
    fn no_day_enabled_means_no_moment() {
        let s = Schedule {
            days: [false; 7],
            ..Schedule::default()
        };
        assert_eq!(s.next_after(t(5, 0, 0)), None);
    }

    #[test]
    fn a_missed_moment_shows_once_after_waking_up() {
        let s = Schedule {
            times: vec![8 * 60 + 30],
            ..Schedule::default()
        };
        // Asleep from 8:00, awake at 9:15 the same day.
        assert_eq!(s.due(t(5, 8, 0), t(5, 9, 15)), Some(t(5, 8, 30)));
        // Checked again later: already handled.
        assert_eq!(s.due(t(5, 9, 15), t(5, 9, 20)), None);
    }

    #[test]
    fn several_missed_moments_collapse_into_the_latest() {
        let s = Schedule {
            times: vec![],
            interval: Some(30),
            ..Schedule::default()
        };
        assert_eq!(s.due(t(5, 9, 5), t(5, 11, 10)), Some(t(5, 11, 0)));
    }

    #[test]
    fn yesterdays_moment_is_not_shown_in_the_morning() {
        let s = Schedule {
            times: vec![20 * 60],
            ..Schedule::default()
        };
        assert_eq!(s.due(t(5, 19, 0), t(6, 7, 0)), None);
    }

    #[test]
    fn an_interval_moment_is_dropped_after_the_window() {
        let s = Schedule {
            times: vec![],
            interval: Some(60),
            window_start: 9 * 60,
            window_end: 18 * 60,
            ..Schedule::default()
        };
        assert_eq!(s.due(t(5, 16, 30), t(5, 19, 0)), None);
        assert_eq!(s.due(t(5, 16, 30), t(5, 17, 40)), Some(t(5, 17, 0)));
    }

    #[test]
    fn normalizes_out_of_range_values() {
        let s = Schedule {
            times: vec![600, 60, 600, 5000],
            interval: Some(1),
            window_start: 900,
            window_end: 100,
            duration_secs: 1,
            pause_secs: 99,
            max_delay_min: 0,
            ..Schedule::default()
        }
        .normalized();
        assert_eq!(s.times, vec![60, 600]);
        assert_eq!(s.interval, Some(15));
        assert_eq!((s.window_start, s.window_end), (540, 1080));
        assert_eq!(
            (s.duration_secs, s.pause_secs, s.max_delay_min),
            (10, 30, 5)
        );
    }
}
