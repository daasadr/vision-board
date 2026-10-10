use tauri::State;

use crate::domain::board::{self, Board, BoardOp};
use crate::domain::db::DEFAULT_BOARD_ID;
use crate::state::Db;

use super::now_ms;

/// Upper bound on one batch; the UI sends at most a few dozen ops per save.
const MAX_OPS_PER_BATCH: usize = 1000;

/// Loads the board with all its items, back to front.
#[tauri::command]
#[specta::specta]
pub async fn board_load(db: State<'_, Db>) -> Result<Board, String> {
    board::load(&db.lock(), DEFAULT_BOARD_ID).map_err(|e| e.to_string())
}

/// Stores a batch of edits atomically. On error nothing from the batch is stored.
#[tauri::command]
#[specta::specta]
pub async fn board_apply_ops(
    app: tauri::AppHandle,
    db: State<'_, Db>,
    ops: Vec<BoardOp>,
) -> Result<(), String> {
    if ops.len() > MAX_OPS_PER_BATCH {
        return Err(format!("too many operations in one batch ({})", ops.len()));
    }
    board::apply_ops(&mut db.lock(), DEFAULT_BOARD_ID, &ops, now_ms())
        .map_err(|e| e.to_string())?;
    // The wallpaper shows the board: draw it again once the edits settle.
    crate::wallpaper::refresh(&app, true);
    Ok(())
}
