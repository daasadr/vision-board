mod commands;
mod domain;
mod lifecycle;
mod platform;
mod state;
mod tray;
mod window_manager;

use tauri::{Manager, RunEvent};
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let commands = commands::builder();

    tauri::Builder::default()
        // Must be registered first so a second launch exits before doing any other work.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = window_manager::open_board(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .skip_initial_state(window_manager::BOARD)
                .build(),
        )
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

            tray::create(app.handle())?;
            window_manager::open_board(app.handle())?;
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
