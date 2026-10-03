//! Small persistent facts about the app itself (not the board), such as one-time notices.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Known flags. An enum, so the frontend cannot write arbitrary keys.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum AppFlag {
    /// The user was told that closing the window keeps the app running in the tray.
    TrayNoticeShown,
}

impl AppFlag {
    fn key(self) -> &'static str {
        match self {
            Self::TrayNoticeShown => "tray_notice_shown",
        }
    }
}

pub fn is_set(conn: &Connection, flag: AppFlag) -> rusqlite::Result<bool> {
    Ok(conn
        .query_row(
            "SELECT value FROM app_state WHERE key = ?1",
            [flag.key()],
            |r| r.get::<_, String>(0),
        )
        .optional()?
        .is_some_and(|v| v == "1"))
}

pub fn set(conn: &Connection, flag: AppFlag) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO app_state (key, value) VALUES (?1, '1')
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![flag.key()],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::db::open_in_memory;

    #[test]
    fn flags_start_unset_and_stay_set() {
        let conn = open_in_memory();
        assert!(!is_set(&conn, AppFlag::TrayNoticeShown).expect("read"));
        set(&conn, AppFlag::TrayNoticeShown).expect("set");
        set(&conn, AppFlag::TrayNoticeShown).expect("set twice");
        assert!(is_set(&conn, AppFlag::TrayNoticeShown).expect("read"));
    }
}
