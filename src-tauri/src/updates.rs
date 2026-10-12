//! Updates from GitHub Releases: a check shortly after start and then once a day (only while
//! automatic checks are on), and installing a found version when the user asks. The plugin
//! verifies the package signature against the public key in tauri.conf.json before installing.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use specta::Type;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::domain::app_state::{self, AppValue};
use crate::domain::updates::next_check;
use crate::state::Db;
use crate::{lifecycle, preferences, tray};

/// Event telling the windows that a newer version can be installed. Matches
/// UPDATE_AVAILABLE_EVENT in src/lib/updates.ts.
pub const UPDATE_AVAILABLE_EVENT: &str = "update://available";

/// Replaces the GitHub endpoint, for testing an update against a local `latest.json`. Safe in
/// release builds too: whatever the endpoint, only packages signed with our key install.
const ENDPOINT_ENV: &str = "VISION_BOARD_UPDATE_URL";

/// Longest sleep between two looks at the wall clock (the computer may sleep in between).
const MAX_SLEEP: Duration = Duration::from_secs(60 * 60);
/// After a failed automatic check (offline), the next try.
const RETRY_AFTER: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    pub version: String,
    /// Release notes (from CHANGELOG.md), if any.
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    /// The running version.
    pub current: String,
    pub available: Option<AvailableUpdate>,
}

pub struct Updates {
    started_ms: i64,
    /// The background task of automatic checks.
    task: Mutex<Option<JoinHandle<()>>>,
    found: Mutex<Option<Update>>,
    installing: AtomicBool,
}

impl Updates {
    pub fn new() -> Self {
        Self {
            started_ms: now_ms(),
            task: Mutex::new(None),
            found: Mutex::new(None),
            installing: AtomicBool::new(false),
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn describe(update: &Update) -> AvailableUpdate {
    AvailableUpdate {
        version: update.version.clone(),
        notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
    }
}

/// The version that can be installed, if a check found one.
pub fn available(app: &AppHandle) -> Option<AvailableUpdate> {
    lock(&app.state::<Updates>().found).as_ref().map(describe)
}

pub fn status(app: &AppHandle) -> UpdateStatus {
    UpdateStatus {
        current: app.package_info().version.to_string(),
        available: available(app),
    }
}

/// Starts automatic checks when they are on, stops them otherwise. Called at startup and after
/// every settings change; a running task is left alone when nothing changed.
pub fn restart(app: &AppHandle) {
    let enabled = preferences::current(app).is_ok_and(|s| s.updates.auto_check);
    let updates = app.state::<Updates>();
    let mut task = lock(&updates.task);
    match (enabled, task.is_some()) {
        (true, false) => *task = Some(tauri::async_runtime::spawn(run(app.clone()))),
        (false, true) => {
            if let Some(task) = task.take() {
                task.abort();
            }
        }
        _ => {}
    }
}

async fn run(app: AppHandle) {
    let started = app.state::<Updates>().started_ms;
    loop {
        let last = app_state::value(&app.state::<Db>().lock(), AppValue::UpdateLastCheck)
            .ok()
            .flatten()
            .and_then(|v| v.parse::<i64>().ok());
        let now = now_ms();
        let due = next_check(last, started, now);
        if now < due {
            let wait = Duration::from_millis(u64::try_from(due - now).unwrap_or(0));
            tokio::time::sleep(wait.min(MAX_SLEEP)).await;
            continue;
        }
        match check(&app).await {
            Ok(_) => {
                let stored = app_state::set_value(
                    &app.state::<Db>().lock(),
                    AppValue::UpdateLastCheck,
                    Some(&now.to_string()),
                );
                if let Err(e) = stored {
                    eprintln!("storing the update check time failed: {e}");
                }
            }
            Err(e) => {
                eprintln!("checking for updates failed: {e}");
                tokio::time::sleep(RETRY_AFTER).await;
            }
        }
    }
}

fn updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    let mut builder = app.updater_builder();
    // Only chooses where to look; the signature check does not depend on it.
    // nosemgrep: rust.lang.security.args.args
    if let Ok(endpoint) = std::env::var(ENDPOINT_ENV) {
        let url = Url::parse(&endpoint).map_err(|e| format!("{ENDPOINT_ENV}: {e}"))?;
        builder = builder.endpoints(vec![url]).map_err(|e| e.to_string())?;
    }
    builder.build().map_err(|e| e.to_string())
}

/// Asks the release endpoint for a newer version. A found version is remembered for
/// installing, offered in the tray menu and announced to the windows.
pub async fn check(app: &AppHandle) -> Result<Option<AvailableUpdate>, String> {
    let found = updater(app)?.check().await.map_err(|e| e.to_string())?;
    let info = found.as_ref().map(describe);
    let updates = app.state::<Updates>();
    let changed = {
        let mut slot = lock(&updates.found);
        let changed = slot.as_ref().map(describe) != info;
        *slot = found;
        changed
    };
    if changed {
        if let Ok(settings) = preferences::current(app) {
            if let Err(e) = tray::update(app, &settings) {
                eprintln!("updating the tray menu failed: {e}");
            }
        }
        if let Some(info) = &info {
            let _ = app.emit(UPDATE_AVAILABLE_EVENT, info);
        }
    }
    Ok(info)
}

/// Downloads, verifies and installs the found version, then starts the new one. On Windows the
/// installer replaces the app, so on success this does not return.
pub async fn install(app: &AppHandle) -> Result<(), String> {
    let updates = app.state::<Updates>();
    if updates.installing.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    let result = download_and_install(app).await;
    updates.installing.store(false, Ordering::SeqCst);
    result
}

async fn download_and_install(app: &AppHandle) -> Result<(), String> {
    let found = lock(&app.state::<Updates>().found).clone();
    let update = match found {
        Some(update) => update,
        None => {
            check(app).await?;
            lock(&app.state::<Updates>().found)
                .clone()
                .ok_or_else(|| "no update available".to_owned())?
        }
    };
    // Download (and verify) first, while the app keeps working; only then stop for the
    // installer.
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    if !lifecycle::prepare_for_update(app).await {
        return Ok(()); // Already quitting.
    }
    // Windows would keep a dead tray icon until the mouse passes over it.
    let _ = app.remove_tray_by_id(tray::TRAY_ID);
    if let Err(e) = update.install(bytes) {
        lifecycle::cancel_update(app);
        if let Ok(settings) = preferences::current(app) {
            let _ = tray::create(app, &settings);
        }
        return Err(e.to_string());
    }
    // macOS and Linux replace the files in place; Windows has exited already.
    app.restart();
}
