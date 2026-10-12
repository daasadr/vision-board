//! The app side of activation (authorization code with PKCE, RFC 7636): the secret verifier,
//! its challenge, the `state` round trip and the activation code the user may type in.
//! Contract: docs/almost-there-api.md, sections 2 and 3.1.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// An activation started in the browser stays usable this long.
pub const PENDING_TTL_MS: i64 = 15 * 60 * 1000;
/// Characters of an activation code (no 0/O, 1/I/L, U).
pub const CODE_ALPHABET: &str = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
pub const CODE_LEN: usize = 12;

/// An activation waiting for the browser to come back. Stored (not only kept in memory),
/// because the deep link may start the app anew.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingActivation {
    pub verifier: String,
    pub state: String,
    pub started_ms: i64,
}

impl PendingActivation {
    /// A new activation from fresh random bytes (32 for the verifier, 16 for the state).
    pub fn new(verifier_bytes: [u8; 32], state_bytes: [u8; 16], now_ms: i64) -> Self {
        Self {
            verifier: URL_SAFE_NO_PAD.encode(verifier_bytes),
            state: URL_SAFE_NO_PAD.encode(state_bytes),
            started_ms: now_ms,
        }
    }

    /// base64url(SHA-256(verifier)), what the browser page gets.
    pub fn challenge(&self) -> String {
        challenge_of(&self.verifier)
    }

    pub fn is_fresh(&self, now_ms: i64) -> bool {
        now_ms >= self.started_ms && now_ms - self.started_ms < PENDING_TTL_MS
    }
}

pub fn challenge_of(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// An activation code as typed or pasted ("abcd-efgh jkmn") in its canonical form
/// ("ABCDEFGHJKMN"), or `None` when it cannot be a code. Nothing invalid reaches the server.
pub fn normalize_code(input: &str) -> Option<String> {
    let code: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| c.to_ascii_uppercase())
        .collect();
    (code.chars().count() == CODE_LEN && code.chars().all(|c| CODE_ALPHABET.contains(c)))
        .then_some(code)
}

/// What a `visionboard://activate?code=…&state=…` link carries, if it is one. Other paths and
/// parameters are ignored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivationLink {
    pub code: String,
    pub state: String,
}

pub fn parse_link(link: &url::Url) -> Option<ActivationLink> {
    // `visionboard://activate` parses with "activate" as the host.
    if link.scheme() != "visionboard" || link.host_str() != Some("activate") {
        return None;
    }
    let mut code = None;
    let mut state = None;
    for (key, value) in link.query_pairs() {
        match key.as_ref() {
            "code" => code = normalize_code(&value),
            "state" if value.len() <= 64 => state = Some(value.into_owned()),
            _ => {}
        }
    }
    Some(ActivationLink {
        code: code?,
        state: state?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_matches_the_contract_vector() {
        let pending = PendingActivation::new([7; 32], [1; 16], 0);
        assert_eq!(
            pending.verifier,
            "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc"
        );
        assert_eq!(
            pending.challenge(),
            "3Ev4DHdHPRMPoN6GukAY_pi7IUAF5qWJHRK6kURvnoE"
        );
        assert_eq!(pending.state.len(), 22);
    }

    #[test]
    fn pending_activation_expires() {
        let pending = PendingActivation::new([0; 32], [0; 16], 1_000);
        assert!(pending.is_fresh(1_000));
        assert!(pending.is_fresh(1_000 + PENDING_TTL_MS - 1));
        assert!(!pending.is_fresh(1_000 + PENDING_TTL_MS));
        assert!(
            !pending.is_fresh(999),
            "a clock moved back does not extend it"
        );
    }

    #[test]
    fn normalizes_typed_codes() {
        assert_eq!(
            normalize_code("abcd-efgh jkmn").as_deref(),
            Some("ABCDEFGHJKMN")
        );
        assert_eq!(
            normalize_code(" ABCDEFGHJKMN ").as_deref(),
            Some("ABCDEFGHJKMN")
        );
        assert_eq!(normalize_code("ABCD-EFGH-JKM"), None, "too short");
        assert_eq!(normalize_code("ABCD-EFGH-JKMNP"), None, "too long");
        assert_eq!(
            normalize_code("ABCD-EFGH-JKM0"),
            None,
            "0 is not in the alphabet"
        );
        assert_eq!(normalize_code("ÁBCD-EFGH-JKMN"), None);
        assert_eq!(normalize_code(""), None);
    }

    #[test]
    fn reads_activation_links() {
        let link = url::Url::parse("visionboard://activate?code=abcd-efgh-jkmn&state=xyz&evil=1")
            .expect("url");
        assert_eq!(
            parse_link(&link),
            Some(ActivationLink {
                code: "ABCDEFGHJKMN".into(),
                state: "xyz".into()
            })
        );
    }

    #[test]
    fn ignores_other_links() {
        for raw in [
            "visionboard://open?code=ABCDEFGHJKMN&state=x",
            "https://activate/?code=ABCDEFGHJKMN&state=x",
            "visionboard://activate?code=ABCDEFGHJKMN",
            "visionboard://activate?state=x",
            "visionboard://activate?code=bad&state=x",
        ] {
            let link = url::Url::parse(raw).expect("url");
            assert_eq!(parse_link(&link), None, "{raw}");
        }
        let long_state = format!(
            "visionboard://activate?code=ABCDEFGHJKMN&state={}",
            "s".repeat(65)
        );
        assert_eq!(
            parse_link(&url::Url::parse(&long_state).expect("url")),
            None
        );
    }
}
