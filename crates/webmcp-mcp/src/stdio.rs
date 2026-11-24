//! Stdio MCP transport: newline-delimited JSON-RPC 2.0 over stdin/stdout with tool-change push.

use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::Mutex;
use webmcp_protocol::BridgeHub;

use crate::jsonrpc::{McpServerInfo, handle_jsonrpc_request, tools_list_changed_notification};

/// Run the stdio MCP server until stdin reaches EOF.
pub async fn run_stdio_server(hub: Arc<dyn BridgeHub>, info: McpServerInfo) -> std::io::Result<()> {
    let stdout = Arc::new(Mutex::new(tokio::io::stdout()));

    // Background task pushing `notifications/tools/list_changed` when the page updates tools.
    let notify_hub = Arc::clone(&hub);
    let notify_out = Arc::clone(&stdout);
    let notifier = tokio::spawn(async move {
        let line = format!("{}\n", tools_list_changed_notification());
        loop {
            notify_hub.wait_tools_changed().await;
            let mut out = notify_out.lock().await;
            if out.write_all(line.as_bytes()).await.is_err() || out.flush().await.is_err() {
                break;
            }
        }
    });

    let stdin = tokio::io::stdin();
    let mut lines = BufReader::new(stdin).lines();

    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(resp) = handle_jsonrpc_request(hub.as_ref(), &info, trimmed).await
            && let Ok(encoded) = serde_json::to_string(&resp)
        {
            let mut out = stdout.lock().await;
            out.write_all(encoded.as_bytes()).await?;
            out.write_all(b"\n").await?;
            out.flush().await?;
        }
    }

    notifier.abort();
    Ok(())
}
