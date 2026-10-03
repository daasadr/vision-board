use std::path::{Path, PathBuf};

use base64::Engine;
use serde::Serialize;
use specta::Type;
use tauri::State;

use crate::domain::media::{self, Media, MediaError};
use crate::lifecycle::Lifecycle;
use crate::state::{Db, MediaDir};

use super::now_ms;

/// Why one file could not be imported; the UI shows a localized message per kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ImportErrorKind {
    TooLarge,
    Unsupported,
    Unreadable,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ImportResult {
    Ok {
        media: Media,
    },
    Error {
        kind: ImportErrorKind,
        /// File name (without directories) for the message.
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibrary {
    /// Absolute media directory; the frontend turns `dir/fileName` into an asset URL.
    pub dir: String,
    pub items: Vec<Media>,
}

fn error_kind(error: &MediaError) -> ImportErrorKind {
    match error {
        MediaError::TooLarge => ImportErrorKind::TooLarge,
        MediaError::Unsupported => ImportErrorKind::Unsupported,
        MediaError::Decode(_)
        | MediaError::Encode(_)
        | MediaError::Io(_)
        | MediaError::Sqlite(_) => ImportErrorKind::Unreadable,
    }
}

fn display_name(path: &Path) -> String {
    path.file_name().map_or_else(
        || path.display().to_string(),
        |n| n.to_string_lossy().into_owned(),
    )
}

/// Imports image files (dropped onto the board or picked in a dialog). Each file gets its own
/// result, so one bad file does not stop the others.
#[tauri::command]
#[specta::specta]
pub async fn media_import_paths(
    db: State<'_, Db>,
    dir: State<'_, MediaDir>,
    lifecycle: State<'_, Lifecycle>,
    paths: Vec<String>,
) -> Result<Vec<ImportResult>, String> {
    let _running = lifecycle.track_import();
    let media_dir = dir.0.clone();
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    // Decoding is CPU-heavy; keep it off the async runtime. Files are processed one at a time
    // to cap memory (a decoded 12 MP photo is ~50 MB).
    let imported = tauri::async_runtime::spawn_blocking(move || {
        paths
            .iter()
            .map(|path| (display_name(path), media::import_file(&media_dir, path)))
            .collect::<Vec<_>>()
    })
    .await
    .map_err(|e| e.to_string())?;

    let conn = db.lock();
    Ok(imported
        .into_iter()
        .map(|(name, result)| {
            match result.and_then(|m| media::record(&conn, &m, now_ms()).map(|()| m)) {
                Ok(media) => ImportResult::Ok { media },
                Err(error) => ImportResult::Error {
                    kind: error_kind(&error),
                    name,
                },
            }
        })
        .collect())
}

/// Imports an image pasted from the clipboard, sent as base64.
#[tauri::command]
#[specta::specta]
pub async fn media_import_bytes(
    db: State<'_, Db>,
    dir: State<'_, MediaDir>,
    lifecycle: State<'_, Lifecycle>,
    base64: String,
) -> Result<ImportResult, String> {
    let _running = lifecycle.track_import();
    let media_dir = dir.0.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        // Reject before decoding base64 so an oversized paste never allocates its full size.
        if base64.len() as u64 > media::MAX_INPUT_BYTES / 3 * 4 + 4 {
            return Err(MediaError::TooLarge);
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64.as_bytes())
            .map_err(|_| MediaError::Unsupported)?;
        media::import_bytes(&media_dir, &bytes)
    })
    .await
    .map_err(|e| e.to_string())?;

    let name = String::new();
    Ok(
        match result.and_then(|m| media::record(&db.lock(), &m, now_ms()).map(|()| m)) {
            Ok(media) => ImportResult::Ok { media },
            Err(error) => ImportResult::Error {
                kind: error_kind(&error),
                name,
            },
        },
    )
}

/// The media directory and every stored image.
#[tauri::command]
#[specta::specta]
pub async fn media_list(
    db: State<'_, Db>,
    dir: State<'_, MediaDir>,
) -> Result<MediaLibrary, String> {
    Ok(MediaLibrary {
        dir: dir.0.to_string_lossy().into_owned(),
        items: media::list(&db.lock()).map_err(|e| e.to_string())?,
    })
}
