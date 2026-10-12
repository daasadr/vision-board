//! Offline license verification: a compact JWT signed by Almost-there.eu with Ed25519 (EdDSA)
//! and bound to this installation. Contract: docs/almost-there-api.md, section 4.
//!
//! Verified by hand on purpose: JWT libraries accept many algorithms and pull in large crypto
//! stacks. Here exactly one algorithm passes, with keys built into the app.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::entitlements::Feature;

pub const ISSUER: &str = "https://almost-there.eu";
pub const AUDIENCE: &str = "eu.almost-there.visionboard";
/// Longer tokens are rejected before any decoding.
pub const MAX_TOKEN_LEN: usize = 4096;
const MAX_LABEL_CHARS: usize = 80;
/// A license issued further in the future than this means a broken clock somewhere.
const MAX_IAT_SKEW_S: i64 = 24 * 60 * 60;

/// A public key the app trusts, by its `kid`.
#[derive(Debug, Clone, Copy)]
pub struct TrustedKey {
    pub kid: &'static str,
    pub key: [u8; 32],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum LicenseSource {
    /// The user's own license from their account.
    Account,
    /// Given by another user through a gift link.
    Gift,
}

/// A verified license.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct License {
    /// Account id at Almost-there.eu (`sub`), opaque.
    pub account: String,
    /// What the app shows as the account, e.g. a masked e-mail (`label`).
    pub label: String,
    pub source: LicenseSource,
    pub features: Vec<Feature>,
    /// License id at the server (`jti`).
    pub id: String,
    /// Unix seconds.
    pub issued_at: i64,
    /// Unix seconds; `None` never expires.
    pub expires_at: Option<i64>,
}

impl License {
    pub fn unlocks(&self, feature: Feature) -> bool {
        self.features.contains(&feature)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum LicenseError {
    #[error("the license is not a well-formed token")]
    Malformed,
    #[error("the license uses an algorithm other than EdDSA")]
    UnsupportedAlgorithm,
    #[error("the license is signed with an unknown key")]
    UnknownKey,
    #[error("the license signature is not valid")]
    BadSignature,
    #[error("the license is not from Almost-there.eu")]
    WrongIssuer,
    #[error("the license is not for Vision Board")]
    WrongAudience,
    #[error("the license belongs to another installation")]
    OtherInstallation,
    #[error("the license has expired")]
    Expired,
    #[error("the license is issued in the future")]
    IssuedInFuture,
}

#[derive(Deserialize)]
struct Header {
    alg: String,
    kid: Option<String>,
}

#[derive(Deserialize)]
struct Claims {
    iss: String,
    aud: String,
    sub: String,
    iid: String,
    features: Vec<serde_json::Value>,
    label: String,
    src: String,
    jti: String,
    iat: i64,
    exp: Option<i64>,
}

fn decode_part<T: for<'de> Deserialize<'de>>(part: &str) -> Result<T, LicenseError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(part)
        .map_err(|_| LicenseError::Malformed)?;
    serde_json::from_slice(&bytes).map_err(|_| LicenseError::Malformed)
}

/// Verifies `token` against the trusted keys, for this installation at `now` (Unix seconds).
/// Order matters: nothing in the payload is trusted before the signature checks out.
pub fn verify(
    token: &str,
    keys: &[TrustedKey],
    installation_id: &str,
    now: i64,
) -> Result<License, LicenseError> {
    if token.len() > MAX_TOKEN_LEN {
        return Err(LicenseError::Malformed);
    }
    let mut parts = token.split('.');
    let (Some(header_part), Some(payload_part), Some(signature_part), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(LicenseError::Malformed);
    };

    let header: Header = decode_part(header_part)?;
    if header.alg != "EdDSA" {
        return Err(LicenseError::UnsupportedAlgorithm);
    }
    let kid = header.kid.ok_or(LicenseError::UnknownKey)?;
    let trusted = keys
        .iter()
        .find(|k| k.kid == kid)
        .ok_or(LicenseError::UnknownKey)?;
    let key = VerifyingKey::from_bytes(&trusted.key).map_err(|_| LicenseError::UnknownKey)?;
    let signature_bytes: [u8; 64] = URL_SAFE_NO_PAD
        .decode(signature_part)
        .map_err(|_| LicenseError::Malformed)?
        .try_into()
        .map_err(|_| LicenseError::Malformed)?;
    let signed = &token[..header_part.len() + 1 + payload_part.len()];
    key.verify_strict(signed.as_bytes(), &Signature::from_bytes(&signature_bytes))
        .map_err(|_| LicenseError::BadSignature)?;

    let claims: Claims = decode_part(payload_part)?;
    if claims.iss != ISSUER {
        return Err(LicenseError::WrongIssuer);
    }
    if claims.aud != AUDIENCE {
        return Err(LicenseError::WrongAudience);
    }
    if claims.iid != installation_id {
        return Err(LicenseError::OtherInstallation);
    }
    if claims.exp.is_some_and(|exp| now >= exp) {
        return Err(LicenseError::Expired);
    }
    if claims.iat > now + MAX_IAT_SKEW_S {
        return Err(LicenseError::IssuedInFuture);
    }

    // Features this version does not know are skipped, so a newer server can add some.
    let mut features: Vec<Feature> = claims
        .features
        .into_iter()
        .filter_map(|f| serde_json::from_value(f).ok())
        .collect();
    features.dedup();
    Ok(License {
        account: claims.sub,
        label: claims.label.chars().take(MAX_LABEL_CHARS).collect(),
        source: if claims.src == "gift" {
            LicenseSource::Gift
        } else {
            LicenseSource::Account
        },
        features,
        id: claims.jti,
        issued_at: claims.iat,
        expires_at: claims.exp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use serde_json::json;

    // Test vectors from docs/almost-there-api.md, section 9. Test-only key.
    const SEED: &[u8; 32] = b"visionboard-test-key-do-not-use!";
    const PUBLIC: &str = "HgpuyQVSnTH56tfOw1DSRtGsN3095zYe1lrY-cWBsWo";
    const IID: &str = "6f1c2a8e-4b7d-4e3a-9c55-2d8f0b1a7e44";
    const VECTOR: &str = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6InRlc3QtMSJ9.eyJpc3MiOiJodHRwczovL2FsbW9zdC10aGVyZS5ldSIsImF1ZCI6ImV1LmFsbW9zdC10aGVyZS52aXNpb25ib2FyZCIsInN1YiI6ImFjY3RfMTIzIiwiaWlkIjoiNmYxYzJhOGUtNGI3ZC00ZTNhLTljNTUtMmQ4ZjBiMWE3ZTQ0IiwiZmVhdHVyZXMiOlsicHJlbWl1bUZyYW1lcyIsIndhbGxwYXBlciIsInNjaGVkdWxlZFBvcHVwIl0sImxhYmVsIjoiaioqKkBleGFtcGxlLmNvbSIsInNyYyI6ImFjY291bnQiLCJqdGkiOiJsaWNfNDU2IiwiaWF0IjoxNzkxNzYzMjAwLCJleHAiOjE4MjMyOTkyMDB9.Xf1bJVk-CFD4WTstRyhQL3Lrwx9bBbu_t3tb_E0MkQQ1rwcJ9WEqw8L0TSqsbJcIlyvE0QIFAjXPfbVDQeuJAQ";
    const IAT: i64 = 1_791_763_200;
    const EXP: i64 = 1_823_299_200;

    fn keys() -> Vec<TrustedKey> {
        let key: [u8; 32] = URL_SAFE_NO_PAD
            .decode(PUBLIC)
            .expect("base64")
            .try_into()
            .expect("32 bytes");
        vec![TrustedKey { kid: "test-1", key }]
    }

    fn claims() -> serde_json::Value {
        json!({
            "iss": ISSUER, "aud": AUDIENCE, "sub": "acct_123", "iid": IID,
            "features": ["premiumFrames", "wallpaper", "scheduledPopup"],
            "label": "j***@example.com", "src": "account", "jti": "lic_456",
            "iat": IAT, "exp": EXP,
        })
    }

    fn sign(header: serde_json::Value, claims: &serde_json::Value) -> String {
        let input = format!(
            "{}.{}",
            URL_SAFE_NO_PAD.encode(header.to_string()),
            URL_SAFE_NO_PAD.encode(claims.to_string())
        );
        let signature = SigningKey::from_bytes(SEED).sign(input.as_bytes());
        format!("{input}.{}", URL_SAFE_NO_PAD.encode(signature.to_bytes()))
    }

    fn token(claims: &serde_json::Value) -> String {
        sign(
            json!({"alg": "EdDSA", "typ": "JWT", "kid": "test-1"}),
            claims,
        )
    }

    #[test]
    fn the_contract_vector_verifies() {
        let license = verify(VECTOR, &keys(), IID, IAT + 60).expect("valid");
        assert_eq!(license.account, "acct_123");
        assert_eq!(license.label, "j***@example.com");
        assert_eq!(license.source, LicenseSource::Account);
        assert_eq!(license.id, "lic_456");
        assert_eq!(license.expires_at, Some(EXP));
        assert!(license.unlocks(Feature::Wallpaper));
        assert!(license.unlocks(Feature::ScheduledPopup));
        assert!(license.unlocks(Feature::PremiumFrames));
    }

    #[test]
    fn the_seed_gives_the_published_public_key() {
        let public = SigningKey::from_bytes(SEED).verifying_key().to_bytes();
        assert_eq!(URL_SAFE_NO_PAD.encode(public), PUBLIC);
    }

    #[test]
    fn rejects_a_changed_payload() {
        let mut parts: Vec<String> = VECTOR.split('.').map(str::to_owned).collect();
        let mut forged = claims();
        forged["iid"] = json!("someone-else");
        parts[1] = URL_SAFE_NO_PAD.encode(forged.to_string());
        assert_eq!(
            verify(&parts.join("."), &keys(), "someone-else", IAT),
            Err(LicenseError::BadSignature)
        );
    }

    #[test]
    fn rejects_other_algorithms_and_unsigned_tokens() {
        let none = sign(json!({"alg": "none", "kid": "test-1"}), &claims());
        assert_eq!(
            verify(&none, &keys(), IID, IAT),
            Err(LicenseError::UnsupportedAlgorithm)
        );
        let hs = sign(json!({"alg": "HS256", "kid": "test-1"}), &claims());
        assert_eq!(
            verify(&hs, &keys(), IID, IAT),
            Err(LicenseError::UnsupportedAlgorithm)
        );
        let unsigned = format!("{}.", VECTOR.rsplit_once('.').expect("dot").0);
        assert_eq!(
            verify(&unsigned, &keys(), IID, IAT),
            Err(LicenseError::Malformed)
        );
    }

    #[test]
    fn rejects_unknown_keys() {
        let other = sign(json!({"alg": "EdDSA", "kid": "other"}), &claims());
        assert_eq!(
            verify(&other, &keys(), IID, IAT),
            Err(LicenseError::UnknownKey)
        );
        let missing = sign(json!({"alg": "EdDSA"}), &claims());
        assert_eq!(
            verify(&missing, &keys(), IID, IAT),
            Err(LicenseError::UnknownKey)
        );
        assert_eq!(verify(VECTOR, &[], IID, IAT), Err(LicenseError::UnknownKey));
    }

    #[test]
    fn rejects_another_installation() {
        assert_eq!(
            verify(VECTOR, &keys(), "another-install", IAT),
            Err(LicenseError::OtherInstallation)
        );
    }

    #[test]
    fn rejects_other_issuers_and_audiences() {
        let mut c = claims();
        c["iss"] = json!("https://evil.example");
        assert_eq!(
            verify(&token(&c), &keys(), IID, IAT),
            Err(LicenseError::WrongIssuer)
        );
        let mut c = claims();
        c["aud"] = json!("some.other.app");
        assert_eq!(
            verify(&token(&c), &keys(), IID, IAT),
            Err(LicenseError::WrongAudience)
        );
    }

    #[test]
    fn expiry_and_issue_time() {
        assert_eq!(
            verify(VECTOR, &keys(), IID, EXP),
            Err(LicenseError::Expired)
        );
        assert!(verify(VECTOR, &keys(), IID, EXP - 1).is_ok());
        assert_eq!(
            verify(VECTOR, &keys(), IID, IAT - 2 * MAX_IAT_SKEW_S),
            Err(LicenseError::IssuedInFuture)
        );

        let mut perpetual = claims();
        perpetual.as_object_mut().expect("object").remove("exp");
        let license = verify(&token(&perpetual), &keys(), IID, i64::MAX / 2).expect("valid");
        assert_eq!(license.expires_at, None);
    }

    #[test]
    fn skips_unknown_features_and_reads_gifts() {
        let mut c = claims();
        c["features"] = json!(["wallpaper", "futureFeature", 7, "wallpaper"]);
        c["src"] = json!("gift");
        c["label"] = json!("x".repeat(200));
        let license = verify(&token(&c), &keys(), IID, IAT).expect("valid");
        assert_eq!(license.features, vec![Feature::Wallpaper]);
        assert!(!license.unlocks(Feature::ScheduledPopup));
        assert_eq!(license.source, LicenseSource::Gift);
        assert_eq!(license.label.chars().count(), MAX_LABEL_CHARS);
    }

    #[test]
    fn rejects_garbage_and_oversized_tokens() {
        for bad in ["", "a.b", "a.b.c.d", "%%%.%%%.%%%", "e30.e30.AAAA"] {
            assert_eq!(
                verify(bad, &keys(), IID, IAT),
                Err(LicenseError::Malformed),
                "{bad}"
            );
        }
        let long = "a".repeat(MAX_TOKEN_LEN + 1);
        assert_eq!(
            verify(&long, &keys(), IID, IAT),
            Err(LicenseError::Malformed)
        );
    }
}
