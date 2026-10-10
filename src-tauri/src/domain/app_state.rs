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

/// Text values the backend keeps for itself (never written by the frontend).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppValue {
    /// The user's wallpapers from before the board became the wallpaper (JSON), to restore.
    WallpaperOriginals,
}

impl AppValue {
    fn key(self) -> &'static str {
        match self {
            Self::WallpaperOriginals => "wallpaper_originals",
        }
    }
}

pub fn value(conn: &Connection, key: AppValue) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM app_state WHERE key = ?1",
        [key.key()],
        |r| r.get(0),
    )
    .optional()
}

/// Stores a value, or removes it with `None`.
pub fn set_value(conn: &Connection, key: AppValue, value: Option<&str>) -> rusqlite::Result<()> {
    match value {
        Some(value) => conn.execute(
            "INSERT INTO app_state (key, value) VALUES (?1, ?2)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            params![key.key(), value],
        )?,
        None => conn.execute("DELETE FROM app_state WHERE key = ?1", [key.key()])?,
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn values_are_stored_replaced_and_removed() {
        let conn = open_in_memory();
        let key = AppValue::WallpaperOriginals;
        assert_eq!(value(&conn, key).expect("read"), None);
        set_value(&conn, key, Some("a")).expect("set");
        set_value(&conn, key, Some("b")).expect("replace");
        assert_eq!(value(&conn, key).expect("read").as_deref(), Some("b"));
        set_value(&conn, key, None).expect("remove");
        assert_eq!(value(&conn, key).expect("read"), None);
    }

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
