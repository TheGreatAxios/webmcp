//! Localhost Axum WebSocket server enforcing origin allowlist and constant-time token auth.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::extract::State;
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use subtle::ConstantTimeEq;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use webmcp_policy::{BridgeConfig, ConfigError, is_origin_allowed};
use webmcp_protocol::{BridgeClientMessage, BridgeServerMessage};

use crate::session::PageSessionHub;

#[derive(Clone)]
struct WsState {
    hub: PageSessionHub,
    config: Arc<BridgeConfig>,
}

/// Build an Axum router exposing `/` (status) and `/ws` (authenticated page WebSocket).
pub fn build_ws_router(hub: PageSessionHub, config: BridgeConfig) -> Router {
    let state = WsState {
        hub,
        config: Arc::new(config),
    };
    Router::new()
        .route("/", get(root_handler))
        .route("/ws", get(ws_upgrade_handler))
        .with_state(state)
}

/// Bind to localhost (validated via `BridgeConfig`) and return the bound address + server future.
pub async fn serve_ws(
    hub: PageSessionHub,
    config: BridgeConfig,
) -> Result<(SocketAddr, TcpListener, Router), Box<dyn std::error::Error + Send + Sync>> {
    config.validate()?;
    let bind_addr = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&bind_addr).await?;
    let local_addr = listener.local_addr()?;
    let router = build_ws_router(hub, config);
    Ok((local_addr, listener, router))
}

async fn root_handler() -> &'static str {
    "WebMCP Bridge — connect via WebSocket /ws"
}

async fn ws_upgrade_handler(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<WsState>,
) -> impl IntoResponse {
    let origin = headers.get("origin").and_then(|v| v.to_str().ok());
    if !is_origin_allowed(origin, &state.config.allowed_origins) {
        return (StatusCode::FORBIDDEN, "Forbidden origin").into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state))
        .into_response()
}

fn verify_token_ct(candidate: &str, expected: &str) -> bool {
    let a = candidate.as_bytes();
    let b = expected.as_bytes();
    a.len() == b.len() && bool::from(a.ct_eq(b))
}

async fn send_json(
    sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    msg: &BridgeServerMessage,
) -> bool {
    match serde_json::to_string(msg) {
        Ok(text) => sink.send(Message::Text(text.into())).await.is_ok(),
        Err(_) => false,
    }
}

async fn handle_socket(socket: WebSocket, state: WsState) {
    let (mut sink, mut stream) = socket.split();

    if !send_json(&mut sink, &BridgeServerMessage::AuthRequired).await {
        return;
    }

    // First message MUST be a valid Auth frame.
    let authenticated = match stream.next().await {
        Some(Ok(Message::Text(text))) => matches!(
            serde_json::from_str::<BridgeClientMessage>(&text),
            Ok(BridgeClientMessage::Auth { token }) if verify_token_ct(&token, &state.config.token)
        ),
        _ => false,
    };

    if !authenticated {
        let _ = send_json(
            &mut sink,
            &BridgeServerMessage::Error {
                message: "Unauthorized".into(),
            },
        )
        .await;
        let _ = sink
            .send(Message::Close(Some(CloseFrame {
                code: 4401,
                reason: "Unauthorized".into(),
            })))
            .await;
        return;
    }

    if !send_json(&mut sink, &BridgeServerMessage::AuthOk).await {
        return;
    }

    let (tx, mut rx) = mpsc::unbounded_channel::<BridgeServerMessage>();
    state.hub.attach(tx).await;

    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if !send_json(&mut sink, &msg).await {
                break;
            }
        }
    });

    while let Some(Ok(frame)) = stream.next().await {
        match frame {
            Message::Text(text) => {
                if let Ok(parsed) = serde_json::from_str::<BridgeClientMessage>(&text) {
                    state.hub.handle_authenticated_message(parsed).await;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    writer.abort();
    state.hub.detach().await;
}

/// Helper re-export so callers can check config errors cleanly.
pub type ServeConfigError = ConfigError;

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio_tungstenite::tungstenite::Message as TMsg;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use webmcp_protocol::{BridgeHub, BridgeToolSummary};

    fn test_config() -> BridgeConfig {
        BridgeConfig {
            host: "127.0.0.1".into(),
            port: 0,
            token: "0123456789abcdef0123456789abcdef".into(),
            allowed_origins: vec![],
        }
    }

    #[tokio::test]
    async fn authenticates_syncs_tools_and_executes() {
        let hub = PageSessionHub::new();
        let cfg = test_config();
        let (addr, listener, router) = serve_ws(hub.clone(), cfg.clone()).await.expect("serve");
        let server_task = tokio::spawn(async move {
            let _ = axum::serve(listener, router).await;
        });

        let url = format!("ws://{addr}/ws");
        let (mut ws, _) = tokio_tungstenite::connect_async(&url).await.expect("connect");

        // Expect auth_required
        let first = ws.next().await.expect("msg").expect("ok");
        let msg: BridgeServerMessage =
            serde_json::from_str(first.to_text().expect("text")).expect("parse");
        assert_eq!(msg, BridgeServerMessage::AuthRequired);

        // Send auth
        let auth = serde_json::to_string(&BridgeClientMessage::Auth {
            token: cfg.token.clone(),
        })
        .expect("ser");
        ws.send(TMsg::Text(auth.into())).await.expect("send auth");

        let second = ws.next().await.expect("msg").expect("ok");
        let msg: BridgeServerMessage =
            serde_json::from_str(second.to_text().expect("text")).expect("parse");
        assert_eq!(msg, BridgeServerMessage::AuthOk);

        // Sync tools
        let sync = serde_json::to_string(&BridgeClientMessage::SyncTools {
            tools: vec![BridgeToolSummary {
                name: "ping".into(),
                title: Some("Ping".into()),
                description: "Responds pong".into(),
                input_schema: Some(json!({"type": "object"})),
                output_schema: None,
                annotations: None,
            }],
        })
        .expect("ser");
        ws.send(TMsg::Text(sync.into())).await.expect("send sync");

        // Wait briefly for sync
        tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        let tools = hub.list_tools().await;
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, "ping");

        // Execute tool from hub while page responds
        let hub_exec = hub.clone();
        let exec_task = tokio::spawn(async move {
            hub_exec.execute_tool("ping".into(), json!({"x": 1})).await
        });

        let req_frame = ws.next().await.expect("exec frame").expect("ok");
        let req_msg: BridgeServerMessage =
            serde_json::from_str(req_frame.to_text().expect("text")).expect("parse");
        let call_id = match req_msg {
            BridgeServerMessage::ExecuteTool { id, name, args } => {
                assert_eq!(name, "ping");
                assert_eq!(args, json!({"x": 1}));
                id
            }
            other => panic!("unexpected: {other:?}"),
        };

        let resp = serde_json::to_string(&BridgeClientMessage::ToolResult {
            id: call_id,
            result: webmcp_protocol::ToolResultPayload::Value(json!({
                "content": [{ "type": "text", "text": "pong" }]
            })),
        })
        .expect("ser");
        ws.send(TMsg::Text(resp.into())).await.expect("send resp");

        let result = exec_task.await.expect("join").expect("ok");
        assert_eq!(result["content"][0]["text"], "pong");

        server_task.abort();
    }

    #[tokio::test]
    async fn rejects_forbidden_origin() {
        let hub = PageSessionHub::new();
        let cfg = test_config();
        let (addr, listener, router) = serve_ws(hub, cfg).await.expect("serve");
        let server_task = tokio::spawn(async move {
            let _ = axum::serve(listener, router).await;
        });

        let mut req = format!("ws://{addr}/ws").into_client_request().expect("req");
        req.headers_mut()
            .insert("Origin", "https://evil.example".parse().expect("hdr"));

        let err = tokio_tungstenite::connect_async(req)
            .await
            .expect_err("should reject forbidden origin");
        assert!(err.to_string().contains("403"));

        server_task.abort();
    }
}
