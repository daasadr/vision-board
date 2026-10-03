//! Image import: validation, decoding, EXIF orientation, downscaling and WebP compression.
//! Originals are never kept; re-encoding also drops all metadata (EXIF, GPS).

use std::fs;
use std::io::{Cursor, Write};
use std::path::Path;

use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use rusqlite::{params, Connection};
use serde::Serialize;
use specta::Type;

/// Largest accepted input file.
pub const MAX_INPUT_BYTES: u64 = 50 * 1024 * 1024;
/// Longest side of a stored image.
pub const MAX_EDGE: u32 = 2560;
/// Longest side of a stored thumbnail.
pub const THUMB_EDGE: u32 = 480;
const QUALITY: f32 = 80.0;
const THUMB_QUALITY: f32 = 75.0;
/// Decoder limits against decompression bombs: a tiny file declaring a gigantic canvas.
const MAX_DECODED_EDGE: u32 = 16_384;
const MAX_DECODE_ALLOC: u64 = 768 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub id: String,
    pub file_name: String,
    pub thumb_name: String,
    pub width: u32,
    pub height: u32,
    /// Size of the stored full-size file.
    pub bytes: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum MediaError {
    #[error("file is larger than 50 MB")]
    TooLarge,
    #[error("not a supported image (JPEG, PNG, WebP or GIF)")]
    Unsupported,
    #[error("image could not be read: {0}")]
    Decode(#[from] image::ImageError),
    #[error("image could not be compressed: {0}")]
    Encode(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
}

/// Recognizes supported formats by their magic bytes, never by file name.
pub fn sniff_format(bytes: &[u8]) -> Option<ImageFormat> {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => Some(ImageFormat::Jpeg),
        [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, ..] => Some(ImageFormat::Png),
        [b'G', b'I', b'F', b'8', b'7' | b'9', b'a', ..] => Some(ImageFormat::Gif),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some(ImageFormat::WebP),
        _ => None,
    }
}

/// Reads and imports an image file.
pub fn import_file(media_dir: &Path, path: &Path) -> Result<Media, MediaError> {
    if fs::metadata(path)?.len() > MAX_INPUT_BYTES {
        return Err(MediaError::TooLarge);
    }
    import_bytes(media_dir, &fs::read(path)?)
}

/// Decodes, normalizes and stores an image plus its thumbnail in `media_dir`.
pub fn import_bytes(media_dir: &Path, bytes: &[u8]) -> Result<Media, MediaError> {
    if bytes.len() as u64 > MAX_INPUT_BYTES {
        return Err(MediaError::TooLarge);
    }
    let format = sniff_format(bytes).ok_or(MediaError::Unsupported)?;
    let image = decode(bytes, format)?;
    let image = if image.width().max(image.height()) > MAX_EDGE {
        image.resize(MAX_EDGE, MAX_EDGE, FilterType::Lanczos3)
    } else {
        image
    };
    let thumb = image.thumbnail(THUMB_EDGE, THUMB_EDGE);

    let id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{id}.webp");
    let thumb_name = format!("{id}_t.webp");
    fs::create_dir_all(media_dir)?;
    let encoded = encode_webp(&image, QUALITY)?;
    write_atomically(&media_dir.join(&file_name), &encoded)?;
    if let Err(e) = write_atomically(
        &media_dir.join(&thumb_name),
        &encode_webp(&thumb, THUMB_QUALITY)?,
    ) {
        let _ = fs::remove_file(media_dir.join(&file_name));
        return Err(e.into());
    }

    Ok(Media {
        id,
        file_name,
        thumb_name,
        width: image.width(),
        height: image.height(),
        // Encoded output of an image capped at 2560 px is a few MB at most.
        bytes: u32::try_from(encoded.len()).unwrap_or(u32::MAX),
    })
}

fn decode(bytes: &[u8], format: ImageFormat) -> Result<DynamicImage, MediaError> {
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DECODED_EDGE);
    limits.max_image_height = Some(MAX_DECODED_EDGE);
    limits.max_alloc = Some(MAX_DECODE_ALLOC);

    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    reader.limits(limits);
    let mut decoder = reader.into_decoder()?;
    // Photos from phones are often stored sideways with an EXIF "rotate" flag.
    let orientation = decoder.orientation()?;
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    Ok(image)
}

fn encode_webp(image: &DynamicImage, quality: f32) -> Result<Vec<u8>, MediaError> {
    // libwebp takes 8-bit RGB(A); keep alpha only when the source has it.
    let normalized = if image.color().has_alpha() {
        DynamicImage::ImageRgba8(image.to_rgba8())
    } else {
        DynamicImage::ImageRgb8(image.to_rgb8())
    };
    let encoder =
        webp::Encoder::from_image(&normalized).map_err(|e| MediaError::Encode(e.to_owned()))?;
    Ok(encoder.encode(quality).to_vec())
}

/// Writes via a temporary file and rename, so a crash never leaves a half-written image.
fn write_atomically(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    let mut file = fs::File::create(&tmp)?;
    file.write_all(data)?;
    file.sync_all()?;
    drop(file);
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

/// Stores the media row after its files were written.
pub fn record(conn: &Connection, media: &Media, now_ms: i64) -> Result<(), MediaError> {
    conn.execute(
        "INSERT INTO media (id, file_name, thumb_name, width, height, bytes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            media.id,
            media.file_name,
            media.thumb_name,
            media.width,
            media.height,
            media.bytes,
            now_ms
        ],
    )?;
    Ok(())
}

/// Every stored media, for resolving image items to files.
pub fn list(conn: &Connection) -> Result<Vec<Media>, MediaError> {
    let mut stmt =
        conn.prepare("SELECT id, file_name, thumb_name, width, height, bytes FROM media")?;
    let rows = stmt.query_map([], |r| {
        Ok(Media {
            id: r.get(0)?,
            file_name: r.get(1)?,
            thumb_name: r.get(2)?,
            width: r.get(3)?,
            height: r.get(4)?,
            bytes: r.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Deletes media no image item refers to, plus stray files in `media_dir` (e.g. from an import
/// interrupted by a crash). Safe only when no undo history can bring a deleted image back,
/// i.e. at startup and after the board was saved on exit. Returns how many files were removed.
pub fn remove_unreferenced(conn: &Connection, media_dir: &Path) -> Result<usize, MediaError> {
    conn.execute(
        "DELETE FROM media WHERE id NOT IN (
            SELECT json_extract(payload, '$.mediaId') FROM items WHERE kind = 'image'
        )",
        [],
    )?;

    let keep: std::collections::HashSet<String> = list(conn)?
        .into_iter()
        .flat_map(|m| [m.file_name, m.thumb_name])
        .collect();
    let entries = match fs::read_dir(media_dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(e) => return Err(e.into()),
    };
    let mut removed = 0;
    for entry in entries {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if entry.file_type()?.is_file() && !keep.contains(&name) {
            fs::remove_file(entry.path())?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, ImageBuffer, Rgb, Rgba};

    fn jpeg(width: u32, height: u32) -> Vec<u8> {
        // A gradient, so the encoder has real content to compress.
        let img = ImageBuffer::from_fn(width, height, |x, y| {
            Rgb([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8])
        });
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(img)
            .write_to(&mut out, ImageFormat::Jpeg)
            .expect("encode jpeg");
        out.into_inner()
    }

    /// Inserts an EXIF APP1 segment with an orientation tag and a GPS IFD into a JPEG.
    fn with_exif(jpeg: &[u8], orientation: u16) -> Vec<u8> {
        let mut tiff = Vec::new();
        tiff.extend_from_slice(b"II*\0");
        tiff.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset
        tiff.extend_from_slice(&2u16.to_le_bytes()); // IFD0: 2 entries
                                                     // Orientation: SHORT, count 1, value inline.
        tiff.extend_from_slice(&0x0112u16.to_le_bytes());
        tiff.extend_from_slice(&3u16.to_le_bytes());
        tiff.extend_from_slice(&1u32.to_le_bytes());
        tiff.extend_from_slice(&u32::from(orientation).to_le_bytes());
        // GPSInfo pointer: LONG, offset of the GPS IFD (8 + 2 + 2*12 + 4 = 38).
        tiff.extend_from_slice(&0x8825u16.to_le_bytes());
        tiff.extend_from_slice(&4u16.to_le_bytes());
        tiff.extend_from_slice(&1u32.to_le_bytes());
        tiff.extend_from_slice(&38u32.to_le_bytes());
        tiff.extend_from_slice(&0u32.to_le_bytes()); // no next IFD
                                                     // GPS IFD: GPSLatitudeRef = "N".
        tiff.extend_from_slice(&1u16.to_le_bytes());
        tiff.extend_from_slice(&0x0001u16.to_le_bytes());
        tiff.extend_from_slice(&2u16.to_le_bytes());
        tiff.extend_from_slice(&2u32.to_le_bytes());
        tiff.extend_from_slice(b"N\0\0\0");
        tiff.extend_from_slice(&0u32.to_le_bytes());

        let mut app1 = b"Exif\0\0".to_vec();
        app1.extend_from_slice(&tiff);
        let mut out = jpeg[..2].to_vec(); // SOI
        out.extend_from_slice(&[0xFF, 0xE1]);
        out.extend_from_slice(&u16::try_from(app1.len() + 2).expect("small").to_be_bytes());
        out.extend_from_slice(&app1);
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    fn stored(dir: &Path, name: &str) -> (Vec<u8>, DynamicImage) {
        let bytes = fs::read(dir.join(name)).expect("file written");
        let image = image::load_from_memory(&bytes).expect("valid webp");
        (bytes, image)
    }

    #[test]
    fn recognizes_formats_by_content() {
        assert_eq!(sniff_format(&jpeg(4, 4)), Some(ImageFormat::Jpeg));
        assert_eq!(sniff_format(b"GIF89a......"), Some(ImageFormat::Gif));
        assert_eq!(
            sniff_format(b"RIFF\0\0\0\0WEBPVP8 "),
            Some(ImageFormat::WebP)
        );
        assert_eq!(sniff_format(b"%PDF-1.7"), None);
        assert_eq!(sniff_format(b""), None);
    }

    #[test]
    fn downscales_a_large_photo_and_stores_webp_with_thumbnail() {
        let dir = tempfile::tempdir().expect("temp dir");
        let input = jpeg(4000, 3000);
        let media = import_bytes(dir.path(), &input).expect("import");

        assert_eq!((media.width, media.height), (2560, 1920));
        let (bytes, image) = stored(dir.path(), &media.file_name);
        assert_eq!(&bytes[8..12], b"WEBP");
        assert_eq!(image.dimensions(), (2560, 1920));
        assert!(bytes.len() < input.len(), "compressed output is smaller");

        let (_, thumb) = stored(dir.path(), &media.thumb_name);
        assert_eq!(thumb.dimensions(), (480, 360));
        // No temporary files left behind.
        let names: Vec<_> = fs::read_dir(dir.path())
            .expect("list")
            .map(|e| e.expect("entry").file_name())
            .collect();
        assert_eq!(names.len(), 2);
    }

    #[test]
    fn keeps_small_images_at_their_size() {
        let dir = tempfile::tempdir().expect("temp dir");
        let media = import_bytes(dir.path(), &jpeg(800, 600)).expect("import");
        assert_eq!((media.width, media.height), (800, 600));
    }

    #[test]
    fn applies_exif_orientation_and_strips_metadata() {
        let dir = tempfile::tempdir().expect("temp dir");
        // Orientation 6: stored landscape, displayed rotated 90° clockwise (portrait).
        let input = with_exif(&jpeg(600, 400), 6);
        assert!(input.windows(4).any(|w| w == b"Exif"));

        let media = import_bytes(dir.path(), &input).expect("import");
        assert_eq!((media.width, media.height), (400, 600));
        let (bytes, _) = stored(dir.path(), &media.file_name);
        assert!(!bytes.windows(4).any(|w| w == b"Exif"), "EXIF removed");
        assert!(!bytes.windows(4).any(|w| w == b"EXIF"), "no EXIF chunk");
    }

    #[test]
    fn preserves_transparency() {
        let dir = tempfile::tempdir().expect("temp dir");
        let img = ImageBuffer::from_fn(64, 64, |x, _| {
            Rgba([200, 30, 30, if x < 32 { 0 } else { 255 }])
        });
        let mut png = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(img)
            .write_to(&mut png, ImageFormat::Png)
            .expect("encode png");

        let media = import_bytes(dir.path(), png.get_ref()).expect("import");
        let (_, image) = stored(dir.path(), &media.file_name);
        assert!(image.color().has_alpha());
        assert!(image.get_pixel(5, 5)[3] < 10, "left half stays transparent");
        assert!(image.get_pixel(60, 5)[3] > 245, "right half stays opaque");
    }

    #[test]
    fn rejects_unsupported_and_oversized_input() {
        let dir = tempfile::tempdir().expect("temp dir");
        assert!(matches!(
            import_bytes(dir.path(), b"%PDF-1.7 not an image"),
            Err(MediaError::Unsupported)
        ));
        // Right magic bytes, broken content.
        assert!(matches!(
            import_bytes(dir.path(), &[0xFF, 0xD8, 0xFF, 0x00, 0x01]),
            Err(MediaError::Decode(_))
        ));
        let huge = vec![0u8; usize::try_from(MAX_INPUT_BYTES).expect("fits") + 1];
        assert!(matches!(
            import_bytes(dir.path(), &huge),
            Err(MediaError::TooLarge)
        ));
        assert_eq!(fs::read_dir(dir.path()).map(|d| d.count()).unwrap_or(0), 0);
    }

    #[test]
    fn imports_from_a_file_path() {
        let dir = tempfile::tempdir().expect("temp dir");
        let src = dir.path().join("photo.JPG");
        fs::write(&src, jpeg(300, 200)).expect("write source");
        let media = import_file(&dir.path().join("media"), &src).expect("import");
        assert_eq!(media.width, 300);
    }

    #[test]
    fn records_and_lists_media() {
        let conn = crate::domain::db::open_in_memory();
        let media = Media {
            id: "m1".into(),
            file_name: "m1.webp".into(),
            thumb_name: "m1_t.webp".into(),
            width: 10,
            height: 20,
            bytes: 1234,
        };
        record(&conn, &media, 0).expect("record");
        assert_eq!(list(&conn).expect("list"), vec![media]);
    }
    #[test]
    fn removes_unreferenced_media_and_stray_files() {
        let dir = tempfile::tempdir().expect("temp dir");
        let mut conn = crate::domain::db::open_in_memory();
        let kept = import_bytes(dir.path(), &jpeg(100, 80)).expect("import kept");
        let orphan = import_bytes(dir.path(), &jpeg(100, 80)).expect("import orphan");
        record(&conn, &kept, 0).expect("record kept");
        record(&conn, &orphan, 0).expect("record orphan");
        fs::write(dir.path().join("crashed.tmp"), b"half").expect("stray file");

        let item = crate::domain::board::Item {
            id: "i".into(),
            x: 0.0,
            y: 0.0,
            w: 100.0,
            h: 80.0,
            rotation: 0.0,
            z: 0,
            content: crate::domain::board::ItemContent::Image {
                media_id: kept.id.clone(),
            },
            style: crate::domain::board::ItemStyle::default(),
        };
        crate::domain::board::apply_ops(
            &mut conn,
            crate::domain::db::DEFAULT_BOARD_ID,
            &[crate::domain::board::BoardOp::Upsert { item }],
            0,
        )
        .expect("add image item");

        assert_eq!(remove_unreferenced(&conn, dir.path()).expect("cleanup"), 3);
        assert_eq!(list(&conn).expect("list"), vec![kept.clone()]);
        let mut left: Vec<_> = fs::read_dir(dir.path())
            .expect("list dir")
            .map(|e| e.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        left.sort();
        let mut expected = vec![kept.file_name, kept.thumb_name];
        expected.sort();
        assert_eq!(left, expected);
    }

    #[test]
    fn cleanup_tolerates_a_missing_media_dir() {
        let conn = crate::domain::db::open_in_memory();
        let dir = tempfile::tempdir().expect("temp dir");
        assert_eq!(
            remove_unreferenced(&conn, &dir.path().join("none")).expect("cleanup"),
            0
        );
    }
}
