//! The board as the desktop wallpaper (Windows). The board is rendered once in an off-screen
//! webview, captured as an image, composed per monitor (over the original wallpaper when the
//! board covers only part of the screen) and set as the real system wallpaper. Nothing runs
//! while the board does not change: no webview, no CPU, no memory beyond the app itself.
//!
//! The user's original wallpapers are stored before the first change and put back when the
//! mode is turned off, the app quits, or it is uninstalled (`--restore-wallpaper`).

use std::sync::Mutex;
use std::time::Duration;

use tauri::async_runtime::JoinHandle;
use tauri::AppHandle;

/// Window label of the off-screen renderer.
pub const RENDERER: &str = "wallpaper-render";
/// Command-line flag the uninstaller passes to put the original wallpaper back.
pub const RESTORE_ARG: &str = "--restore-wallpaper";

/// Board edits arrive in bursts: they are collected for this long before rendering again.
const BOARD_DEBOUNCE: Duration = Duration::from_secs(2);
/// A settings change is one deliberate action: render almost at once.
const SETTINGS_DEBOUNCE: Duration = Duration::from_millis(300);

#[derive(Default)]
pub struct Wallpaper {
    /// The debounce wait before rendering; a newer request restarts it.
    pending: Mutex<Option<JoinHandle<()>>>,
    /// One render at a time. A render is never cancelled half-way (that would leave the
    /// renderer window behind); a request arriving meanwhile renders again afterwards.
    rendering: tokio::sync::Mutex<()>,
    /// Signalled by the renderer page once the board, its images and fonts are drawn.
    rendered: tokio::sync::Notify,
    /// What the shown wallpaper was made from; nothing is rendered when it did not change.
    shown: Mutex<Option<String>>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

/// Renders the wallpaper again soon (edits arrive in bursts), or puts the original back when
/// the mode is off. `force`: also when nothing the wallpaper shows has changed (board edits).
pub fn refresh(app: &AppHandle, force: bool) {
    use tauri::Manager;
    let state = app.state::<Wallpaper>();
    if let Some(task) = lock(&state.pending).take() {
        task.abort();
    }
    let app = app.clone();
    *lock(&state.pending) = Some(tauri::async_runtime::spawn(async move {
        tokio::time::sleep(if force {
            BOARD_DEBOUNCE
        } else {
            SETTINGS_DEBOUNCE
        })
        .await;
        // Past the wait: render in a task of its own, which a newer request cannot abort.
        tauri::async_runtime::spawn(async move {
            let state = app.state::<Wallpaper>();
            let _one_at_a_time = state.rendering.lock().await;
            if let Err(e) = imp::refresh(&app, force).await {
                eprintln!("updating the wallpaper failed: {e}");
            }
        });
    }));
}

/// The renderer page finished drawing the board.
pub fn rendered(app: &AppHandle) {
    use tauri::Manager;
    app.state::<Wallpaper>().rendered.notify_one();
}

/// Puts the user's original wallpapers back (quit, uninstall, mode off). Blocking.
pub fn restore(app: &AppHandle) {
    if let Err(e) = imp::restore(app) {
        eprintln!("restoring the wallpaper failed: {e}");
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use std::path::PathBuf;
    use std::time::Duration;

    use image::ImageFormat;
    use serde::{Deserialize, Serialize};
    use tauri::{
        AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
    };

    use super::{lock, Wallpaper, RENDERER};
    use crate::domain::app_state::{self, AppValue};
    use crate::domain::entitlements::{self, Feature};
    use crate::domain::settings::Settings;
    use crate::domain::wallpaper::compose;
    use crate::platform::{self, wallpaper as os};
    use crate::state::Db;
    use crate::{preferences, window_manager};

    /// Longest wait for the renderer to draw the board (images are decoded from disk).
    const RENDER_TIMEOUT: Duration = Duration::from_secs(20);
    /// Rendering beyond 4K adds nothing visible and costs memory.
    const MAX_RENDER_WIDTH: u32 = 3840;

    #[derive(Debug, Serialize, Deserialize)]
    struct Originals {
        position: Option<i32>,
        monitors: Vec<(String, String)>,
    }

    fn enabled(settings: &Settings) -> bool {
        settings.startup.wallpaper && entitlements::is_enabled(Feature::Wallpaper)
    }

    /// Everything the image depends on, besides the board itself.
    fn look_signature(settings: &Settings, monitors: &[os::Monitor]) -> String {
        let rects: Vec<_> = monitors
            .iter()
            .map(|m| (m.id.clone(), m.rect.width, m.rect.height))
            .collect();
        format!(
            "{:?}|{:?}|{}|{:?}|{}|{:?}",
            settings.theme,
            settings.frame,
            settings.images_only,
            settings.placement,
            platform::system_prefers_dark(),
            rects
        )
    }

    /// Runs `f` on the main thread (COM and webview calls live there) and waits for it.
    async fn on_main<T: Send + 'static>(
        app: &AppHandle,
        f: impl FnOnce() -> T + Send + 'static,
    ) -> Result<T, String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(f());
        })
        .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())
    }

    fn folder(app: &AppHandle) -> Result<PathBuf, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("wallpaper");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir)
    }

    pub async fn refresh(app: &AppHandle, force: bool) -> Result<(), String> {
        let settings = preferences::current(app).map_err(|e| e.to_string())?;
        if !enabled(&settings) {
            return restore(app);
        }
        let monitors = on_main(app, os::monitors)
            .await?
            .map_err(|e| e.to_string())?;
        if monitors.is_empty() {
            return Ok(());
        }
        let signature = look_signature(&settings, &monitors);
        let state = app.state::<Wallpaper>();
        if !force && lock(&state.shown).as_deref() == Some(signature.as_str()) {
            return Ok(());
        }
        remember_originals(app, &monitors).await?;

        let board = render(app, &monitors).await?;
        let dir = folder(app)?;
        // A new file name each time: Windows caches wallpapers by path.
        let stamp = chrono::Local::now().timestamp_millis();
        let mut images = Vec::new();
        for (index, monitor) in monitors.iter().enumerate() {
            let original = originals(app)?
                .and_then(|o| o.monitors.into_iter().find(|(id, _)| *id == monitor.id))
                .map(|(_, path)| path)
                .filter(|p| !p.is_empty())
                .and_then(|p| image::open(p).ok());
            let image = compose(
                &board,
                original.as_ref(),
                (monitor.rect.width, monitor.rect.height),
                settings.placement,
            );
            let path = dir.join(format!("board-{index}-{stamp}.jpg"));
            image
                .save_with_format(&path, ImageFormat::Jpeg)
                .map_err(|e| e.to_string())?;
            images.push((monitor.id.clone(), path));
        }
        let set: Vec<(String, String)> = images
            .iter()
            .map(|(id, path)| (id.clone(), path.to_string_lossy().into_owned()))
            .collect();
        on_main(app, move || -> windows::core::Result<()> {
            os::set_position(None)?;
            for (id, path) in &set {
                os::set(id, path)?;
            }
            Ok(())
        })
        .await?
        .map_err(|e| e.to_string())?;
        // Earlier images are no longer shown.
        remove_files_except(
            &dir,
            &images.iter().map(|(_, p)| p.clone()).collect::<Vec<_>>(),
        );
        *lock(&state.shown) = Some(signature);
        Ok(())
    }

    /// Draws the board in an off-screen window at the size of the largest monitor (16:9) and
    /// captures it.
    async fn render(app: &AppHandle, monitors: &[os::Monitor]) -> Result<image::RgbaImage, String> {
        let width = monitors
            .iter()
            .map(|m| m.rect.width.max(m.rect.height * 16 / 9))
            .max()
            .unwrap_or(1920)
            .min(MAX_RENDER_WIDTH);
        let height = width * 9 / 16;
        // Far left of every monitor: rendered, but never seen.
        let x = monitors.iter().map(|m| m.rect.x).min().unwrap_or(0) - width as i32 - 200;

        let builder_app = app.clone();
        let window = on_main(app, move || {
            // Left over from an earlier render that failed: start clean.
            if let Some(stale) = builder_app.get_webview_window(RENDERER) {
                let _ = stale.destroy();
            }
            let window = WebviewWindowBuilder::new(
                &builder_app,
                RENDERER,
                WebviewUrl::App("index.html".into()),
            )
            .title("Vision Board")
            .decorations(false)
            .skip_taskbar(true)
            .focused(false)
            .resizable(false)
            .visible(false)
            .initialization_script(window_manager::settings_script(&builder_app))
            .build()?;
            window.set_size(PhysicalSize::new(width, height))?;
            window.set_position(PhysicalPosition::new(x, 0))?;
            window.show()?;
            platform::hide_from_task_switcher(&window);
            Ok::<_, tauri::Error>(window)
        })
        .await?
        .map_err(|e| e.to_string())?;

        let state = app.state::<Wallpaper>();
        let drawn = tokio::time::timeout(RENDER_TIMEOUT, state.rendered.notified()).await;
        let captured = match drawn {
            Ok(()) => capture(app, &window).await,
            Err(_) => Err("the board did not render in time".to_owned()),
        };
        // Whatever happened, the renderer window goes away.
        let _ = window.destroy();
        let png = captured?;
        image::load_from_memory_with_format(&png, ImageFormat::Png)
            .map(|i| i.to_rgba8())
            .map_err(|e| e.to_string())
    }

    /// A PNG snapshot of the renderer window.
    async fn capture(app: &AppHandle, window: &tauri::WebviewWindow) -> Result<Vec<u8>, String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let target = window.clone();
        on_main(app, move || {
            os::capture_png(
                &target,
                Box::new(move |r| {
                    let _ = tx.send(r);
                }),
            )
        })
        .await?
        .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    fn originals(app: &AppHandle) -> Result<Option<Originals>, String> {
        let json = app_state::value(&app.state::<Db>().lock(), AppValue::WallpaperOriginals)
            .map_err(|e| e.to_string())?;
        Ok(json.and_then(|j| serde_json::from_str(&j).ok()))
    }

    /// Stores the user's wallpapers the first time; monitors added later are added.
    async fn remember_originals(app: &AppHandle, monitors: &[os::Monitor]) -> Result<(), String> {
        let ours = folder(app)?;
        let mut stored = match originals(app)? {
            Some(o) => o,
            None => Originals {
                position: on_main(app, os::position).await?.ok(),
                monitors: Vec::new(),
            },
        };
        for monitor in monitors {
            // Never take one of our own images for the original.
            let own = PathBuf::from(&monitor.wallpaper).starts_with(&ours);
            if !own && !stored.monitors.iter().any(|(id, _)| *id == monitor.id) {
                stored
                    .monitors
                    .push((monitor.id.clone(), monitor.wallpaper.clone()));
            }
        }
        let json = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
        app_state::set_value(
            &app.state::<Db>().lock(),
            AppValue::WallpaperOriginals,
            Some(&json),
        )
        .map_err(|e| e.to_string())
    }

    /// Blocking: also runs at quit and from the uninstaller. COM on the calling thread.
    pub fn restore(app: &AppHandle) -> Result<(), String> {
        let Some(stored) = originals(app)? else {
            return Ok(());
        };
        platform::wallpaper::restore(stored.position, &stored.monitors)
            .map_err(|e| e.to_string())?;
        app_state::set_value(
            &app.state::<Db>().lock(),
            AppValue::WallpaperOriginals,
            None,
        )
        .map_err(|e| e.to_string())?;
        *lock(&app.state::<Wallpaper>().shown) = None;
        if let Ok(dir) = folder(app) {
            remove_files_except(&dir, &[]);
        }
        Ok(())
    }

    fn remove_files_except(dir: &std::path::Path, keep: &[PathBuf]) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && !keep.contains(&path) {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

/// macOS and Linux: not implemented yet (the setting stays off there).
#[cfg(not(target_os = "windows"))]
mod imp {
    use tauri::AppHandle;

    pub async fn refresh(_app: &AppHandle, _force: bool) -> Result<(), String> {
        Ok(())
    }

    pub fn restore(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }
}
