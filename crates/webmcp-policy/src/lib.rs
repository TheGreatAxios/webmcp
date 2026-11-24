//! Pure L1 policy rules for WebMCP: bridge security config, origin/cross-origin opt-in, and journeys.

pub mod config;
pub mod journey;
pub mod origin;

pub use config::{BridgeConfig, ConfigError, DEFAULT_HOST, DEFAULT_PORT, MIN_TOKEN_LEN};
pub use journey::{JourneyDefinition, JourneyState};
pub use origin::{is_origin_allowed, is_tool_visible_to_caller};
