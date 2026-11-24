//! Bridge security configuration and invariants.

use thiserror::Error;

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 17321;
pub const MIN_TOKEN_LEN: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ConfigError {
    #[error("bridge must bind to localhost only (got '{0}')")]
    NonLocalBindHost(String),
    #[error("bridge token must be at least {MIN_TOKEN_LEN} characters")]
    WeakToken,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeConfig {
    pub host: String,
    pub port: u16,
    pub token: String,
    pub allowed_origins: Vec<String>,
}

impl BridgeConfig {
    pub fn validate(&self) -> Result<(), ConfigError> {
        validate_bind_host(&self.host)?;
        validate_token(&self.token)?;
        Ok(())
    }
}

pub fn validate_bind_host(host: &str) -> Result<(), ConfigError> {
    if matches!(host, "127.0.0.1" | "localhost" | "::1") {
        Ok(())
    } else {
        Err(ConfigError::NonLocalBindHost(host.to_string()))
    }
}

pub fn validate_token(token: &str) -> Result<(), ConfigError> {
    if token.trim().len() >= MIN_TOKEN_LEN {
        Ok(())
    } else {
        Err(ConfigError::WeakToken)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_local_hosts_and_short_tokens() {
        assert!(validate_bind_host("127.0.0.1").is_ok());
        assert!(validate_bind_host("localhost").is_ok());
        assert!(validate_bind_host("::1").is_ok());
        assert!(validate_bind_host("0.0.0.0").is_err());

        assert!(validate_token("short").is_err());
        assert!(validate_token(&"a".repeat(32)).is_ok());
    }
}
