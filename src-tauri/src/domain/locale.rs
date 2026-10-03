//! UI strings the native side shows itself (tray menu). Everything else is translated in the
//! frontend; keep these in sync with src/i18n/locales.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Cs,
    En,
    De,
}

/// Picks the UI language from a BCP 47 tag such as "cs-CZ"; unsupported or unknown → English.
pub fn detect(tag: Option<&str>) -> Language {
    let primary = tag
        .and_then(|t| t.split(['-', '_']).next())
        .map(str::to_ascii_lowercase);
    match primary.as_deref() {
        Some("cs") => Language::Cs,
        Some("de") => Language::De,
        _ => Language::En,
    }
}

pub struct TrayText {
    pub tooltip: &'static str,
    pub open: &'static str,
    pub quit: &'static str,
}

pub fn tray_text(language: Language) -> TrayText {
    match language {
        Language::Cs => TrayText {
            tooltip: "Vision Board",
            open: "Otevřít nástěnku",
            quit: "Ukončit",
        },
        Language::En => TrayText {
            tooltip: "Vision Board",
            open: "Open board",
            quit: "Quit",
        },
        Language::De => TrayText {
            tooltip: "Vision Board",
            open: "Pinnwand öffnen",
            quit: "Beenden",
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_supported_languages_by_primary_subtag() {
        assert_eq!(detect(Some("cs-CZ")), Language::Cs);
        assert_eq!(detect(Some("de_AT")), Language::De);
        assert_eq!(detect(Some("DE")), Language::De);
        assert_eq!(detect(Some("en-US")), Language::En);
    }

    #[test]
    fn falls_back_to_english() {
        assert_eq!(detect(Some("fr-FR")), Language::En);
        assert_eq!(detect(None), Language::En);
    }

    #[test]
    fn tray_menu_is_translated() {
        assert_eq!(tray_text(Language::Cs).open, "Otevřít nástěnku");
        assert_eq!(tray_text(Language::De).quit, "Beenden");
    }
}
