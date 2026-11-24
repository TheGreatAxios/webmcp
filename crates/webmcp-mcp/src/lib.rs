//! L2 MCP server adapter: JSON-RPC 2.0 handler + stdio and Streamable HTTP transports.

pub mod http;
pub mod jsonrpc;
pub mod stdio;

pub use http::build_mcp_http_router;
pub use jsonrpc::{McpServerInfo, handle_jsonrpc_request};
pub use stdio::run_stdio_server;
