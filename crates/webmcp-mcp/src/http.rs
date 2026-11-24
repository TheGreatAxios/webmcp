//! MCP Streamable HTTP transport (`POST /mcp`).

use std::sync::Arc;

use axum::Router;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use webmcp_protocol::BridgeHub;

use crate::jsonrpc::{McpServerInfo, handle_jsonrpc_request};

#[derive(Clone)]
struct HttpMcpState {
    hub: Arc<dyn BridgeHub>,
    info: McpServerInfo,
}

/// Build an Axum router exposing MCP Streamable HTTP at `POST /mcp`.
pub fn build_mcp_http_router(hub: Arc<dyn BridgeHub>, info: McpServerInfo) -> Router {
    Router::new()
        .route("/mcp", post(handle_mcp_post))
        .with_state(HttpMcpState { hub, info })
}

async fn handle_mcp_post(State(state): State<HttpMcpState>, body: String) -> impl IntoResponse {
    match handle_jsonrpc_request(state.hub.as_ref(), &state.info, &body).await {
        Some(resp) => match serde_json::to_string(&resp) {
            Ok(json) => (
                StatusCode::OK,
                [("content-type", "application/json")],
                json,
            )
                .into_response(),
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        },
        None => StatusCode::ACCEPTED.into_response(),
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::{Value, json};
    use webmcp_protocol::{BoxFuture, BridgeToolSummary, HubError};

    struct EmptyHub;
    impl BridgeHub for EmptyHub {
        fn list_tools(&self) -> BoxFuture<'_, Vec<BridgeToolSummary>> {
            Box::pin(async { vec![] })
        }
        fn execute_tool(&self, _name: String, _args: Value) -> BoxFuture<'_, Result<Value, HubError>> {
            Box::pin(async { Err(HubError::NoPageConnected) })
        }
        fn wait_tools_changed(&self) -> BoxFuture<'_, ()> {
            Box::pin(async {})
        }
    }

    #[tokio::test]
    async fn http_mcp_returns_200_for_request_and_202_for_notification() {
        let state = HttpMcpState {
            hub: Arc::new(EmptyHub),
            info: McpServerInfo::default(),
        };
        let req_resp = handle_mcp_post(
            State(state.clone()),
            json!({"jsonrpc": "2.0", "id": 1, "method": "ping"}).to_string(),
        )
        .await
        .into_response();
        assert_eq!(req_resp.status(), StatusCode::OK);

        let notif_resp = handle_mcp_post(
            State(state),
            json!({"jsonrpc": "2.0", "method": "notifications/initialized"}).to_string(),
        )
        .await
        .into_response();
        assert_eq!(notif_resp.status(), StatusCode::ACCEPTED);
    }
}
