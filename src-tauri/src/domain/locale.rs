//! UI strings the native side shows itself (tray menu, control widget menu, window titles).
//! Everything else is translated in the frontend; keep these in sync with src/i18n/locales.

use super::settings::LanguagePreference;

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

/// The language chosen in the settings; "system" uses the OS locale tag.
pub fn resolve(preference: LanguagePreference, system_tag: Option<&str>) -> Language {
    match preference {
        LanguagePreference::System => detect(system_tag),
        LanguagePreference::Cs => Language::Cs,
        LanguagePreference::En => Language::En,
        LanguagePreference::De => Language::De,
    }
}

pub struct Texts {
    pub tooltip: &'static str,
    pub open: &'static str,
    pub show_now: &'static str,
    pub settings: &'static str,
    pub control_widget: &'static str,
    pub hide_control: &'static str,
    // Only the native control widget (Windows) has this menu item.
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    pub reset_control_position: &'static str,
    pub quit: &'static str,
    pub settings_title: &'static str,
}

pub fn texts(language: Language) -> Texts {
    match language {
        Language::Cs => Texts {
            tooltip: "Vision Board",
            open: "Otevřít nástěnku",
            show_now: "Zobrazit nástěnku teď",
            settings: "Nastavení…",
            control_widget: "Ovládací prvek na ploše",
            hide_control: "Skrýt",
            reset_control_position: "Vrátit do rohu",
            quit: "Ukončit",
            settings_title: "Nastavení – Vision Board",
        },
        Language::En => Texts {
            tooltip: "Vision Board",
            open: "Open board",
            show_now: "Show the board now",
            settings: "Settings…",
            control_widget: "Desktop control",
            hide_control: "Hide",
            reset_control_position: "Move back to the corner",
            quit: "Quit",
            settings_title: "Settings – Vision Board",
        },
        Language::De => Texts {
            tooltip: "Vision Board",
            open: "Pinnwand öffnen",
            show_now: "Pinnwand jetzt zeigen",
            settings: "Einstellungen…",
            control_widget: "Bedienelement auf dem Desktop",
            hide_control: "Ausblenden",
            reset_control_position: "Zurück in die Ecke",
            quit: "Beenden",
            settings_title: "Einstellungen – Vision Board",
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
    fn a_chosen_language_overrides_the_system() {
        assert_eq!(resolve(LanguagePreference::De, Some("cs-CZ")), Language::De);
        assert_eq!(
            resolve(LanguagePreference::System, Some("cs-CZ")),
            Language::Cs
        );
    }

    #[test]
    fn menus_are_translated() {
        assert_eq!(texts(Language::Cs).open, "Otevřít nástěnku");
        assert_eq!(texts(Language::De).quit, "Beenden");
        assert_eq!(texts(Language::De).settings, "Einstellungen…");
        assert_eq!(texts(Language::En).hide_control, "Hide");
    }
}
