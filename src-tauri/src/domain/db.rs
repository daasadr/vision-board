//! SQLite storage: opening the database and schema migrations.

use std::path::Path;

use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Id of the board created by the first migration. The UI shows a single board for now;
/// the schema already supports more.
pub const DEFAULT_BOARD_ID: &str = "default";

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Migration(#[from] rusqlite_migration::Error),
}

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(
        "CREATE TABLE boards (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );

        CREATE TABLE media (
            id          TEXT PRIMARY KEY,
            file_name   TEXT NOT NULL,
            thumb_name  TEXT NOT NULL,
            width       INTEGER NOT NULL,
            height      INTEGER NOT NULL,
            bytes       INTEGER NOT NULL,
            created_at  INTEGER NOT NULL
        );

        -- Geometry is in logical canvas units (1920×1080), rotation in degrees.
        -- payload/style are JSON whose shape depends on kind.
        CREATE TABLE items (
            id          TEXT PRIMARY KEY,
            board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            kind        TEXT NOT NULL CHECK (kind IN ('image', 'quote', 'text')),
            x           REAL NOT NULL,
            y           REAL NOT NULL,
            w           REAL NOT NULL,
            h           REAL NOT NULL,
            rotation    REAL NOT NULL DEFAULT 0,
            z           INTEGER NOT NULL,
            payload     TEXT NOT NULL,
            style       TEXT NOT NULL DEFAULT '{}',
            created_at  INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL
        );
        CREATE INDEX items_board ON items(board_id, z);

        CREATE TABLE app_state (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL
        );

        INSERT INTO boards (id, name, created_at, updated_at)
        VALUES ('default', '', unixepoch('subsec') * 1000, unixepoch('subsec') * 1000);",
    )])
}

/// Opens (creating if needed) the database at `path` and migrates it to the latest schema.
pub fn open(path: &Path) -> Result<Connection, DbError> {
    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrations().to_latest(&mut conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> rusqlite::Result<()> {
    // WAL keeps committed data intact if the app crashes mid-write; NORMAL sync is durable
    // enough with WAL and much cheaper than FULL.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
}

#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory database");
    configure(&conn).expect("configure");
    migrations().to_latest(&mut conn).expect("migrate");
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        assert!(migrations().validate().is_ok());
    }

    #[test]
    fn creates_schema_and_default_board_in_a_new_file() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("board.db");
        let conn = open(&path).expect("open");

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .and_then(|mut s| s.query_map([], |r| r.get(0))?.collect())
            .expect("list tables");
        assert_eq!(tables, ["app_state", "boards", "items", "media"]);

        let boards: i64 = conn
            .query_row(
                "SELECT count(*) FROM boards WHERE id = ?1",
                [DEFAULT_BOARD_ID],
                |r| r.get(0),
            )
            .expect("count boards");
        assert_eq!(boards, 1);

        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .expect("journal mode");
        assert_eq!(mode, "wal");
    }

    #[test]
    fn reopening_keeps_data_and_does_not_rerun_migrations() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("board.db");
        open(&path)
            .expect("first open")
            .execute("INSERT INTO app_state (key, value) VALUES ('k', 'v')", [])
            .expect("insert");

        let conn = open(&path).expect("second open");
        let value: String = conn
            .query_row("SELECT value FROM app_state WHERE key = 'k'", [], |r| {
                r.get(0)
            })
            .expect("value survives");
        assert_eq!(value, "v");
    }

    #[test]
    fn rejects_unknown_item_kind() {
        let conn = open_in_memory();
        let result = conn.execute(
            "INSERT INTO items (id, board_id, kind, x, y, w, h, z, payload, created_at, updated_at)
             VALUES ('i', 'default', 'video', 0, 0, 1, 1, 0, '{}', 0, 0)",
            [],
        );
        assert!(result.is_err());
    }
}
