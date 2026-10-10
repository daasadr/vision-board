mod commands;
mod domain;
mod lifecycle;
mod platform;
mod popup;
mod preferences;
mod scheduler;
mod state;
mod tray;
mod wallpaper;
mod window_manager;

use tauri::{Manager, RunEvent};
use tauri_plugin_window_state::StateFlags;

/// Argument the OS passes when it starts the app at login.
const AUTOSTART_ARG: &str = "--autostart";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let commands = commands::builder();

    tauri::Builder::default()
        // Must be registered first so a second launch exits before doing any other work.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // The uninstaller asks the running app to put the original wallpaper back.
            if args.iter().any(|a| a == wallpaper::RESTORE_ARG) {
                // This runs inside a synchronous window message (WM_COPYDATA), where Windows
                // refuses calls to other processes' COM objects (the wallpaper lives in
                // Explorer), so the restore runs on its own thread.
                let app = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    wallpaper::restore(&app);
                    app.exit(0);
                });
                return;
            }
            let _ = window_manager::open_board(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .skip_initial_state(window_manager::BOARD)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(commands.invoke_handler())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let conn = domain::db::open(&data_dir.join("board.db"))?;
            // Startup is the one moment no undo history can still refer to deleted images.
            let media_dir = data_dir.join("media");
            if let Err(e) = domain::media::remove_unreferenced(&conn, &media_dir) {
                eprintln!("media cleanup failed: {e}");
            }
            app.manage(state::Db::new(conn));
            app.manage(state::MediaDir(media_dir));
            app.manage(lifecycle::Lifecycle::default());
            app.manage(scheduler::Scheduler::default());
            app.manage(popup::Popup::default());
            app.manage(wallpaper::Wallpaper::default());
            // Run by the uninstaller: put the original wallpaper back and quit.
            // Arguments only choose what to open at start; nothing security-relevant.
            // nosemgrep: rust.lang.security.args.args
            if std::env::args().any(|arg| arg == wallpaper::RESTORE_ARG) {
                wallpaper::restore(app.handle());
                std::process::exit(0);
            }

            let settings = preferences::current(app.handle()).unwrap_or_default();
            tray::create(app.handle(), &settings)?;
            app.on_menu_event(window_manager::on_menu_event);
            // Started at login: stay in the tray (and the control widget) without a window.
            // nosemgrep: rust.lang.security.args.args
            if !std::env::args().any(|arg| arg == AUTOSTART_ARG) {
                window_manager::open_board(app.handle())?;
            }
            window_manager::sync_control(app.handle(), settings.control_widget)?;
            scheduler::restart(app.handle());
            // Shows the board as the wallpaper when that is on; otherwise puts back an original
            // left over from a crash.
            wallpaper::refresh(app.handle(), true);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Closing the last window keeps the app in the tray; only Quit (app.exit) ends it.
            if let RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                if !app.state::<lifecycle::Lifecycle>().is_quitting() {
                    api.prevent_exit();
                }
            }
        });
}
