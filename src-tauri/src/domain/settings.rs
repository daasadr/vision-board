//! User preferences, stored as one JSON document in the `settings` table.
//!
//! Loading is lenient: fields missing from an older document get their defaults, and a top-level
//! field with a value this version does not understand falls back to its default instead of
//! failing the whole document. Autostart is not stored here; the OS registration is its source of truth.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use super::schedule::Schedule;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    #[default]
    System,
    Galerie,
    Noc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LanguagePreference {
    #[default]
    System,
    Cs,
    En,
    De,
}

/// How images are framed. Polaroid and glass are premium (entitlement PremiumFrames).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FrameStyle {
    #[default]
    None,
    Line,
    Passepartout,
    Polaroid,
    Glass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PlacementMode {
    #[default]
    Full,
    Partial,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Anchor {
    #[default]
    Center,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

/// Width of a partial placement, in percent of the screen width.
pub const MIN_PLACEMENT_SIZE: u8 = 30;
pub const MAX_PLACEMENT_SIZE: u8 = 90;

/// Where the board shows outside the main window (pop-up, wallpaper).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub mode: PlacementMode,
    /// Percent of the screen width (30–90); used by the partial mode.
    pub size: u8,
    pub anchor: Anchor,
}

impl Default for Placement {
    fn default() -> Self {
        Self {
            mode: PlacementMode::Full,
            size: 60,
            anchor: Anchor::Center,
        }
    }
}

/// Whether the control widget stays behind other windows (at desktop level) or above them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ControlLayer {
    #[default]
    Behind,
    Front,
}

/// Where the user dragged the control widget: its top-left corner in physical pixels on the
/// virtual desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ControlPosition {
    pub x: i32,
    pub y: i32,
}

/// Modes that start with the app. Phases 3 and 4 act on them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Startup {
    pub wallpaper: bool,
    pub scheduled_popup: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: ThemePreference,
    pub language: LanguagePreference,
    /// Frame of images that do not set their own.
    pub frame: FrameStyle,
    /// Hide quotes and texts (they stay stored).
    pub images_only: bool,
    pub placement: Placement,
    /// The control widget is shown.
    pub control_widget: bool,
    pub control_layer: ControlLayer,
    /// None: the default corner.
    pub control_position: Option<ControlPosition>,
    /// Modes on at start; `scheduled_popup` is also the switch of the schedule below.
    pub startup: Startup,
    pub schedule: Schedule,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            language: LanguagePreference::default(),
            frame: FrameStyle::default(),
            images_only: false,
            placement: Placement::default(),
            control_widget: true,
            control_layer: ControlLayer::default(),
            control_position: None,
            startup: Startup::default(),
            schedule: Schedule::default(),
        }
    }
}

impl Settings {
    /// Brings values into their allowed ranges.
    pub fn normalized(mut self) -> Self {
        self.placement.size = self
            .placement
            .size
            .clamp(MIN_PLACEMENT_SIZE, MAX_PLACEMENT_SIZE);
        self.schedule = self.schedule.normalized();
        self
    }

    /// Parses a stored document, keeping every field that is valid and defaulting the rest.
    pub fn from_json_lenient(json: &str) -> Self {
        let Ok(Value::Object(stored)) = serde_json::from_str::<Value>(json) else {
            return Self::default();
        };
        let Ok(Value::Object(mut merged)) = serde_json::to_value(Self::default()) else {
            return Self::default();
        };
        for (key, value) in stored {
            let Some(default) = merged.get(&key).cloned() else {
                continue; // A field this version does not have.
            };
            merged.insert(key.clone(), overlay(default.clone(), value));
            if serde_json::from_value::<Self>(Value::Object(merged.clone())).is_err() {
                merged.insert(key, default);
            }
        }
        serde_json::from_value::<Self>(Value::Object(merged))
            .unwrap_or_default()
            .normalized()
    }
}

/// `top` over `base`; nested objects merge key by key, so a nested field missing from an older
/// document keeps its default. Keys `base` does not have are dropped.
fn overlay(base: Value, top: Value) -> Value {
    match (base, top) {
        (Value::Object(mut base), Value::Object(top)) => {
            for (key, value) in top {
                if let Some(default) = base.remove(&key) {
                    base.insert(key, overlay(default, value));
                }
            }
            Value::Object(base)
        }
        (_, top) => top,
    }
}

pub fn load(conn: &Connection) -> rusqlite::Result<Settings> {
    let json: Option<String> = conn
        .query_row("SELECT data FROM settings WHERE id = 1", [], |r| r.get(0))
        .optional()?;
    Ok(json.map_or_else(Settings::default, |j| Settings::from_json_lenient(&j)))
}

/// Stores the settings (normalized) and returns what was stored.
pub fn save(conn: &Connection, settings: Settings) -> rusqlite::Result<Settings> {
    let settings = settings.normalized();
    let json = serde_json::to_string(&settings)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO settings (id, data) VALUES (1, ?1)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data",
        params![json],
    )?;
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::db::open_in_memory;

    #[test]
    fn defaults_when_nothing_is_stored() {
        let conn = open_in_memory();
        let settings = load(&conn).expect("load");
        assert_eq!(settings, Settings::default());
        assert!(settings.control_widget);
        assert_eq!(settings.placement.size, 60);
    }

    #[test]
    fn saves_and_loads() {
        let conn = open_in_memory();
        let settings = Settings {
            theme: ThemePreference::Noc,
            language: LanguagePreference::De,
            frame: FrameStyle::Polaroid,
            images_only: true,
            placement: Placement {
                mode: PlacementMode::Partial,
                size: 40,
                anchor: Anchor::BottomRight,
            },
            control_widget: false,
            control_layer: ControlLayer::Front,
            control_position: Some(ControlPosition { x: -300, y: 40 }),
            startup: Startup {
                wallpaper: true,
                scheduled_popup: true,
            },
            schedule: Schedule {
                times: vec![8 * 60 + 30],
                ..Schedule::default()
            },
        };
        save(&conn, settings.clone()).expect("save");
        save(&conn, settings.clone()).expect("save again");
        assert_eq!(load(&conn).expect("load"), settings);
    }

    #[test]
    fn clamps_the_placement_size() {
        let conn = open_in_memory();
        let mut settings = Settings::default();
        settings.placement.size = 100;
        assert_eq!(
            save(&conn, settings.clone()).expect("save").placement.size,
            90
        );
        settings.placement.size = 5;
        assert_eq!(save(&conn, settings).expect("save").placement.size, 30);
        assert_eq!(load(&conn).expect("load").placement.size, 30);
    }

    #[test]
    fn fills_fields_missing_from_an_older_document() {
        let settings = Settings::from_json_lenient(r#"{"theme":"noc"}"#);
        assert_eq!(settings.theme, ThemePreference::Noc);
        assert!(settings.control_widget);
        assert_eq!(settings.control_layer, ControlLayer::Behind);
        assert_eq!(settings.control_position, None);
        assert_eq!(settings.placement, Placement::default());

        let nested = Settings::from_json_lenient(r#"{"placement":{"mode":"partial"}}"#);
        assert_eq!(nested.placement.mode, PlacementMode::Partial);
        assert_eq!(nested.placement.size, 60);
    }

    #[test]
    fn keeps_valid_fields_when_one_is_unknown() {
        let settings = Settings::from_json_lenient(
            r#"{"theme":"sepia","language":"cs","frame":"polaroid","future":1,
                "placement":{"mode":"partial","size":95,"anchor":"topLeft"}}"#,
        );
        assert_eq!(settings.theme, ThemePreference::System);
        assert_eq!(settings.language, LanguagePreference::Cs);
        assert_eq!(settings.frame, FrameStyle::Polaroid);
        assert_eq!(settings.placement.mode, PlacementMode::Partial);
        assert_eq!(settings.placement.anchor, Anchor::TopLeft);
        assert_eq!(settings.placement.size, MAX_PLACEMENT_SIZE);
    }

    #[test]
    fn corrupt_document_means_defaults() {
        assert_eq!(Settings::from_json_lenient("not json"), Settings::default());
        assert_eq!(Settings::from_json_lenient("[1,2]"), Settings::default());
    }

    #[test]
    fn serializes_in_camel_case_for_the_frontend() {
        let json = serde_json::to_string(&Settings::default()).expect("json");
        assert!(json.contains(r#""imagesOnly":false"#));
        assert!(json.contains(r#""controlWidget":true"#));
        assert!(json.contains(r#""controlLayer":"behind""#));
        assert!(json.contains(r#""controlPosition":null"#));
        assert!(json.contains(r#""scheduledPopup":false"#));
        assert!(json.contains(r#""theme":"system""#));
    }
}
