//! MCP Streamable HTTP transport (`POST /mcp`) with Origin header enforcement.

use std::sync::Arc;

use axum::Router;
use axum::extract::{DefaultBodyLimit, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use webmcp_policy::is_origin_allowed;
use webmcp_protocol::BridgeHub;

use crate::jsonrpc::{McpServerInfo, handle_jsonrpc_request};

const MAX_HTTP_BODY_BYTES: usize = 1024 * 1024;

#[derive(Clone)]
struct HttpMcpState {
    hub: Arc<dyn BridgeHub>,
    info: McpServerInfo,
    allowed_origins: Arc<Vec<String>>,
}

/// Build an Axum router exposing MCP Streamable HTTP at `POST /mcp`.
/// Enforces localhost / allowlisted `Origin` checks and a 1 MiB body limit per MCP 2025-03-26 security guidance.
pub fn build_mcp_http_router(
    hub: Arc<dyn BridgeHub>,
    info: McpServerInfo,
    allowed_origins: Vec<String>,
) -> Router {
    Router::new()
        .route("/mcp", post(handle_mcp_post))
        .layer(DefaultBodyLimit::max(MAX_HTTP_BODY_BYTES))
        .with_state(HttpMcpState {
            hub,
            info,
            allowed_origins: Arc::new(allowed_origins),
        })
}

async fn handle_mcp_post(
    State(state): State<HttpMcpState>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    let origin = headers.get("origin").and_then(|v| v.to_str().ok());
    if !is_origin_allowed(origin, &state.allowed_origins) {
        return (StatusCode::FORBIDDEN, "Forbidden origin").into_response();
    }

    match handle_jsonrpc_request(state.hub.as_ref(), &state.info, &body).await {
        Some(resp) => match serde_json::to_string(&resp) {
            Ok(json) => {
                (StatusCode::OK, [("content-type", "application/json")], json).into_response()
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        },
        None => StatusCode::ACCEPTED.into_response(),
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use serde_json::{Value, json};
    use webmcp_protocol::{BoxFuture, BridgeToolSummary, HubError};

    struct EmptyHub;
    impl BridgeHub for EmptyHub {
        fn list_tools(&self) -> BoxFuture<'_, Vec<BridgeToolSummary>> {
            Box::pin(async { vec![] })
        }
        fn execute_tool(
            &self,
            _name: String,
            _args: Value,
        ) -> BoxFuture<'_, Result<Value, HubError>> {
            Box::pin(async { Err(HubError::NoPageConnected) })
        }
        fn wait_tools_changed(&self) -> BoxFuture<'_, ()> {
            Box::pin(async {})
        }
    }

    #[tokio::test]
    async fn http_mcp_returns_200_for_request_202_for_notification_and_403_for_bad_origin() {
        let state = HttpMcpState {
            hub: Arc::new(EmptyHub),
            info: McpServerInfo::default(),
            allowed_origins: Arc::new(vec![]),
        };

        let req_resp = handle_mcp_post(
            State(state.clone()),
            HeaderMap::new(),
            json!({"jsonrpc": "2.0", "id": 1, "method": "ping"}).to_string(),
        )
        .await
        .into_response();
        assert_eq!(req_resp.status(), StatusCode::OK);

        let notif_resp = handle_mcp_post(
            State(state.clone()),
            HeaderMap::new(),
            json!({"jsonrpc": "2.0", "method": "notifications/initialized"}).to_string(),
        )
        .await
        .into_response();
        assert_eq!(notif_resp.status(), StatusCode::ACCEPTED);

        let mut evil_headers = HeaderMap::new();
        evil_headers.insert("origin", HeaderValue::from_static("https://evil.example"));
        let evil_resp = handle_mcp_post(
            State(state),
            evil_headers,
            json!({"jsonrpc": "2.0", "id": 2, "method": "ping"}).to_string(),
        )
        .await
        .into_response();
        assert_eq!(evil_resp.status(), StatusCode::FORBIDDEN);
    }
}
