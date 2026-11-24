//! Pure domain types, wire protocol, validation, and port traits for WebMCP (L1 — zero I/O).

pub mod hub;
pub mod messages;
pub mod types;
pub mod validation;

pub use hub::{BoxFuture, BridgeHub, HubError};
pub use messages::{BridgeClientMessage, BridgeServerMessage, ToolResultPayload};
pub use types::{BridgeToolSummary, CallToolResult, ContentBlock, ToolAnnotations};
pub use validation::{ValidationError, validate_tool_description, validate_tool_name, validate_tool_summary};
