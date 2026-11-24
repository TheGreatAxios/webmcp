//! Pure L1 port trait decoupling L2 WebSocket transport (`webmcp-ws`) from L2 MCP server (`webmcp-mcp`).

use std::future::Future;
use std::pin::Pin;

use serde_json::Value;
use thiserror::Error;

use crate::types::BridgeToolSummary;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum HubError {
    #[error("no browser page connected")]
    NoPageConnected,
    #[error("tool execution timed out")]
    Timeout,
    #[error("tool execution failed: {0}")]
    ToolFailed(String),
    #[error("browser page disconnected before tool completed")]
    Disconnected,
}

/// Port implemented by the L2 session hub and consumed by L2 MCP servers.
pub trait BridgeHub: Send + Sync {
    /// Return the latest tool list synced from the connected browser page.
    fn list_tools(&self) -> BoxFuture<'_, Vec<BridgeToolSummary>>;

    /// Execute a named tool on the connected browser page.
    fn execute_tool(&self, name: String, args: Value) -> BoxFuture<'_, Result<Value, HubError>>;

    /// Wait until the browser page updates its tool list.
    fn wait_tools_changed(&self) -> BoxFuture<'_, ()>;
}
