//! App lifecycle: the app keeps running in the tray when its windows close, and quitting
//! first lets pending work finish (board edits saved by the frontend, image imports).

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;
use tokio::time::Instant;

use crate::state::{Db, MediaDir};
use crate::window_manager;

/// Longest time quitting waits for pending work.
const QUIT_TIMEOUT: Duration = Duration::from_secs(5);
/// Event asking the board window to save pending edits before the app exits.
pub const QUIT_REQUESTED_EVENT: &str = "app://quit-requested";

#[derive(Default)]
pub struct Lifecycle {
    quitting: AtomicBool,
    imports: AtomicUsize,
    frontend_saved: Notify,
}

impl Lifecycle {
    pub fn is_quitting(&self) -> bool {
        self.quitting.load(Ordering::SeqCst)
    }

    /// Called by the frontend once its pending edits are stored.
    pub fn frontend_saved(&self) {
        self.frontend_saved.notify_one();
    }

    /// Marks an image import as running until the guard is dropped.
    pub fn track_import(&self) -> ImportGuard<'_> {
        self.imports.fetch_add(1, Ordering::SeqCst);
        ImportGuard(self)
    }
}

pub struct ImportGuard<'a>(&'a Lifecycle);

impl Drop for ImportGuard<'_> {
    fn drop(&mut self) {
        self.0.imports.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Quits the app after pending work finishes or QUIT_TIMEOUT passes, whichever is first.
pub fn request_quit(app: &AppHandle) {
    let lifecycle = app.state::<Lifecycle>();
    if lifecycle.quitting.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let deadline = Instant::now() + QUIT_TIMEOUT;
        let lifecycle = app.state::<Lifecycle>();

        if let Some(window) = app.get_webview_window(window_manager::BOARD) {
            if window.emit(QUIT_REQUESTED_EVENT, ()).is_ok() {
                let _ =
                    tokio::time::timeout_at(deadline, lifecycle.frontend_saved.notified()).await;
            }
        }
        while lifecycle.imports.load(Ordering::SeqCst) > 0 && Instant::now() < deadline {
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        // With the board saved and no import running, nothing can refer to unused media.
        if lifecycle.imports.load(Ordering::SeqCst) == 0 {
            let db = app.state::<Db>();
            let media_dir = app.state::<MediaDir>();
            let result = crate::domain::media::remove_unreferenced(&db.lock(), &media_dir.0);
            if let Err(e) = result {
                eprintln!("media cleanup failed: {e}");
            }
        }
        // The desktop must look as before the app ran.
        crate::wallpaper::restore(&app);
        app.exit(0);
    });
}
