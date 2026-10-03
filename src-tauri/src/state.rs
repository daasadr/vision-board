//! State shared by commands, managed by Tauri.

use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

/// The board database. One connection is plenty for a single-user desktop app; commands hold
/// the lock only for the duration of one query or transaction.
pub struct Db(Mutex<Connection>);

impl Db {
    pub fn new(conn: Connection) -> Self {
        Self(Mutex::new(conn))
    }

    pub fn lock(&self) -> MutexGuard<'_, Connection> {
        // A panic while holding the lock cannot leave SQLite inconsistent (transactions roll
        // back on drop), so a poisoned lock is safe to reuse.
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
