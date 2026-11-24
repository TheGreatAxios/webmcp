//! L2 auth & environment config adapter: CSPRNG token generation, constant-time compare, env loading.

use std::env;

use rand::RngCore;
use subtle::ConstantTimeEq;
use webmcp_policy::{BridgeConfig, DEFAULT_HOST, DEFAULT_PORT};

/// Generate a 256-bit random token encoded as 64 lowercase hex characters.
pub fn generate_bridge_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    let mut hex = String::with_capacity(64);
    for b in bytes {
        hex.push_str(&format!("{b:02x}"));
    }
    hex
}

/// Constant-time token comparison to avoid timing side channels.
pub fn verify_token(candidate: &str, expected: &str) -> bool {
    let a = candidate.as_bytes();
    let b = expected.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    bool::from(a.ct_eq(b))
}

/// Resolve `BridgeConfig` from `WEBMCP_BRIDGE_*` environment variables.
pub fn resolve_bridge_config_from_env() -> BridgeConfig {
    let host = env::var("WEBMCP_BRIDGE_HOST").unwrap_or_else(|_| DEFAULT_HOST.to_string());
    let port = env::var("WEBMCP_BRIDGE_PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);
    let token = env::var("WEBMCP_BRIDGE_TOKEN").unwrap_or_default();
    let allowed_origins = env::var("WEBMCP_BRIDGE_ORIGINS")
        .ok()
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();

    BridgeConfig {
        host,
        port,
        token,
        allowed_origins,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_64_hex_chars_and_verifies_const_time() {
        let tok = generate_bridge_token();
        assert_eq!(tok.len(), 64);
        assert!(tok.bytes().all(|b| b.is_ascii_hexdigit()));
        assert!(verify_token(&tok, &tok));
        assert!(!verify_token("wrong", &tok));
        let flipped = if tok.ends_with('0') { '1' } else { '0' };
        assert!(!verify_token(&format!("{}{flipped}", &tok[..63]), &tok));
    }
}
