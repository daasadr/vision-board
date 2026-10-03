//! Which premium features are available. The single place that decides it, so licensing
//! (phase 6) changes only this module.

use serde::Serialize;
use specta::Type;

/// Features unlocked by an Almost-there.eu gift. Everything else is free.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Feature {
    PremiumFrames,
    Wallpaper,
    ScheduledPopup,
}

pub const PREMIUM_FEATURES: [Feature; 3] = [
    Feature::PremiumFrames,
    Feature::Wallpaper,
    Feature::ScheduledPopup,
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Entitlement {
    pub feature: Feature,
    pub enabled: bool,
}

/// Until license activation exists, every feature is unlocked.
pub fn is_enabled(_feature: Feature) -> bool {
    true
}

pub fn all() -> Vec<Entitlement> {
    PREMIUM_FEATURES
        .iter()
        .map(|&feature| Entitlement {
            feature,
            enabled: is_enabled(feature),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_premium_feature_is_unlocked_before_licensing() {
        assert!(all().iter().all(|e| e.enabled));
        assert!(is_enabled(Feature::Wallpaper));
    }

    #[test]
    fn reports_each_premium_feature_once() {
        let features: Vec<_> = all().into_iter().map(|e| e.feature).collect();
        assert_eq!(features, PREMIUM_FEATURES);
    }

    #[test]
    fn serializes_feature_ids_for_the_frontend() {
        let json = serde_json::to_value(all()).expect("serialize");
        assert_eq!(json[1]["feature"], "wallpaper");
        assert_eq!(json[2]["feature"], "scheduledPopup");
    }
}
