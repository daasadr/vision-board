//! Runs the popup schedule: sleeps until the next planned moment, then waits for a good moment
//! (input pause, nothing fullscreen, user present) and shows the pop-up. Nothing runs while the
//! schedule is off.

use std::sync::Mutex;
use std::time::Duration;

use chrono::{Local, NaiveDateTime};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use tokio::time::Instant;

use crate::domain::activity::{self, Decision};
use crate::domain::entitlements::{self, Feature};
use crate::domain::schedule::Schedule;
use crate::{platform, popup, preferences};

/// Longest sleep between two looks at the wall clock. Monotonic time may stand still while the
/// computer sleeps and the user may change the clock, so the schedule is recomputed at least
/// this often (a few microseconds of work, four times an hour).
const MAX_SLEEP: Duration = Duration::from_secs(15 * 60);

#[derive(Default)]
pub struct Scheduler {
    task: Mutex<Option<JoinHandle<()>>>,
    /// A one-off moment from "Snooze".
    snoozed_until: Mutex<Option<NaiveDateTime>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Starts the schedule when it is on (and unlocked), stops it otherwise. Called at startup and
/// after every settings change.
pub fn restart(app: &AppHandle) {
    let scheduler = app.state::<Scheduler>();
    if let Some(task) = lock(&scheduler.task).take() {
        task.abort();
    }
    let enabled = preferences::current(app).is_ok_and(|s| s.startup.scheduled_popup)
        && entitlements::is_enabled(Feature::ScheduledPopup);
    let snoozed = lock(&scheduler.snoozed_until).is_some();
    if enabled || snoozed {
        let app = app.clone();
        *lock(&scheduler.task) = Some(tauri::async_runtime::spawn(run(app, enabled)));
    }
}

/// Shows the board again after `minutes` (when the moment is good).
pub fn snooze(app: &AppHandle, minutes: u16) {
    let until = Local::now().naive_local() + chrono::Duration::minutes(i64::from(minutes));
    *lock(&app.state::<Scheduler>().snoozed_until) = Some(until);
    restart(app);
}

async fn run(app: AppHandle, schedule_on: bool) {
    let scheduler = app.state::<Scheduler>();
    let mut last = Local::now().naive_local();
    loop {
        let schedule = preferences::current(&app).unwrap_or_default().schedule;
        let now = Local::now().naive_local();
        let snoozed = *lock(&scheduler.snoozed_until);

        let planned = schedule_on.then(|| schedule.due(last, now)).flatten();
        let snooze_due = snoozed.filter(|at| *at <= now);
        last = now;
        if snooze_due.is_some() {
            lock(&scheduler.snoozed_until).take();
        }
        if planned.is_some() || snooze_due.is_some() {
            wait_for_good_moment_and_show(&app, &schedule).await;
            continue;
        }

        let next = [
            schedule_on.then(|| schedule.next_after(now)).flatten(),
            snoozed,
        ]
        .into_iter()
        .flatten()
        .min();
        let Some(next) = next else {
            return; // Nothing planned (no weekday enabled, no snooze).
        };
        let until_next = (next - now).to_std().unwrap_or_default();
        // A settings change or a snooze restarts this task, so a plain sleep is enough.
        tokio::time::sleep(until_next.min(MAX_SLEEP)).await;
    }
}

async fn wait_for_good_moment_and_show(app: &AppHandle, schedule: &Schedule) {
    let started = Instant::now();
    let pause = Duration::from_secs(u64::from(schedule.pause_secs));
    let max_delay = Duration::from_secs(u64::from(schedule.max_delay_min) * 60);
    loop {
        match activity::decide(platform::activity(), started.elapsed(), pause, max_delay) {
            Decision::Show => {
                if let Err(e) = popup::show(app) {
                    eprintln!("showing the pop-up failed: {e}");
                }
                return;
            }
            Decision::Wait(wait) => tokio::time::sleep(wait).await,
            Decision::Skip => return,
        }
    }
}
