//! L2 WebSocket transport adapter: localhost WS server and `PageSessionHub` implementing `BridgeHub`.

pub mod server;
pub mod session;

pub use server::{build_ws_router, serve_ws};
pub use session::PageSessionHub;
