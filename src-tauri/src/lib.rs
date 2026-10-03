mod commands;
mod domain;
mod platform;
mod state;
mod window_manager;

use tauri::Manager;
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
            app.manage(state::Db::new(conn));

            window_manager::open_board(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
