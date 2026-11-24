//! Thread-safe browser page session hub implementing the L1 `BridgeHub` port.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::sync::{Mutex, Notify, RwLock, mpsc, oneshot};
use uuid::Uuid;
use webmcp_protocol::{
    BoxFuture, BridgeClientMessage, BridgeHub, BridgeServerMessage, BridgeToolSummary, HubError,
    ToolResultPayload, validate_tool_summary,
};

const DEFAULT_TOOL_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_SYNCED_TOOLS: usize = 256;
const MAX_PENDING_CALLS: usize = 64;

type PendingSender = oneshot::Sender<Result<Value, HubError>>;

struct ActiveSession {
    id: Uuid,
    tx: mpsc::UnboundedSender<BridgeServerMessage>,
}

struct SessionInner {
    outbound: RwLock<Option<ActiveSession>>,
    tools: RwLock<Vec<BridgeToolSummary>>,
    pending: Mutex<HashMap<String, PendingSender>>,
    tools_changed: Notify,
    timeout: Duration,
}

/// Shared session hub connecting one active browser page WebSocket to any number of MCP consumers.
#[derive(Clone)]
pub struct PageSessionHub {
    inner: Arc<SessionInner>,
}

impl Default for PageSessionHub {
    fn default() -> Self {
        Self::new()
    }
}

impl PageSessionHub {
    #[must_use]
    pub fn new() -> Self {
        Self::with_timeout(DEFAULT_TOOL_TIMEOUT)
    }

    #[must_use]
    pub fn with_timeout(timeout: Duration) -> Self {
        Self {
            inner: Arc::new(SessionInner {
                outbound: RwLock::new(None),
                tools: RwLock::new(Vec::new()),
                pending: Mutex::new(HashMap::new()),
                tools_changed: Notify::new(),
                timeout,
            }),
        }
    }

    /// Attach an authenticated page WebSocket outbound channel and return its session ID.
    pub async fn attach(&self, tx: mpsc::UnboundedSender<BridgeServerMessage>) -> Uuid {
        let id = Uuid::new_v4();
        let mut guard = self.inner.outbound.write().await;
        *guard = Some(ActiveSession { id, tx });
        id
    }

    /// Detach only if `session_id` matches the currently active session.
    /// Prevents a stale closing browser tab from clobbering a newly connected tab.
    pub async fn detach(&self, session_id: Uuid) {
        let should_clear = {
            let mut guard = self.inner.outbound.write().await;
            if guard.as_ref().is_some_and(|s| s.id == session_id) {
                *guard = None;
                true
            } else {
                false
            }
        };
        if !should_clear {
            return;
        }
        self.set_tools(Vec::new()).await;

        let mut pending = self.inner.pending.lock().await;
        for (_, tx) in pending.drain() {
            let _ = tx.send(Err(HubError::Disconnected));
        }
    }

    /// Handle a validated message from an authenticated browser page.
    pub async fn handle_authenticated_message(&self, msg: BridgeClientMessage) {
        match msg {
            BridgeClientMessage::Auth { .. } => {}
            BridgeClientMessage::SyncTools { tools } => {
                let valid: Vec<BridgeToolSummary> = tools
                    .into_iter()
                    .filter(|t| validate_tool_summary(t).is_ok())
                    .take(MAX_SYNCED_TOOLS)
                    .collect();
                self.set_tools(valid).await;
            }
            BridgeClientMessage::ToolResult { id, result } => {
                let tx = self.inner.pending.lock().await.remove(&id);
                if let Some(tx) = tx {
                    let outcome = match result {
                        ToolResultPayload::Error { error } => Err(HubError::ToolFailed(error)),
                        ToolResultPayload::Value(v) => Ok(v),
                    };
                    let _ = tx.send(outcome);
                }
            }
        }
    }

    /// Request cancellation of an in-flight tool call on the connected page.
    pub async fn cancel_tool(&self, id: String) {
        let outbound = self
            .inner
            .outbound
            .read()
            .await
            .as_ref()
            .map(|s| s.tx.clone());
        if let Some(tx) = outbound {
            let _ = tx.send(BridgeServerMessage::CancelTool { id });
        }
    }

    async fn set_tools(&self, next: Vec<BridgeToolSummary>) {
        let changed = {
            let mut guard = self.inner.tools.write().await;
            if *guard == next {
                false
            } else {
                *guard = next;
                true
            }
        };
        if changed {
            self.inner.tools_changed.notify_waiters();
        }
    }
}

impl BridgeHub for PageSessionHub {
    fn list_tools(&self) -> BoxFuture<'_, Vec<BridgeToolSummary>> {
        Box::pin(async move { self.inner.tools.read().await.clone() })
    }

    fn execute_tool(&self, name: String, args: Value) -> BoxFuture<'_, Result<Value, HubError>> {
        Box::pin(async move {
            let outbound = self
                .inner
                .outbound
                .read()
                .await
                .as_ref()
                .map(|s| s.tx.clone())
                .ok_or(HubError::NoPageConnected)?;

            let id = Uuid::new_v4().to_string();
            let (tx, rx) = oneshot::channel();
            {
                let mut pending = self.inner.pending.lock().await;
                if pending.len() >= MAX_PENDING_CALLS {
                    return Err(HubError::ToolFailed(
                        "too many concurrent tool calls in flight".into(),
                    ));
                }
                pending.insert(id.clone(), tx);
            }

            let msg = BridgeServerMessage::ExecuteTool {
                id: id.clone(),
                name,
                args,
            };
            if outbound.send(msg).is_err() {
                self.inner.pending.lock().await.remove(&id);
                return Err(HubError::NoPageConnected);
            }

            match tokio::time::timeout(self.inner.timeout, rx).await {
                Ok(Ok(result)) => result,
                Ok(Err(_)) => Err(HubError::Disconnected),
                Err(_) => {
                    self.inner.pending.lock().await.remove(&id);
                    self.cancel_tool(id).await;
                    Err(HubError::Timeout)
                }
            }
        })
    }

    fn wait_tools_changed(&self) -> BoxFuture<'_, ()> {
        Box::pin(async move {
            self.inner.tools_changed.notified().await;
        })
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn stale_detach_does_not_clobber_new_session() {
        let hub = PageSessionHub::new();
        let (tx1, _rx1) = mpsc::unbounded_channel();
        let (tx2, mut rx2) = mpsc::unbounded_channel();

        let id1 = hub.attach(tx1).await;
        let _id2 = hub.attach(tx2).await;

        // Closing the stale first tab must NOT clear the active second tab.
        hub.detach(id1).await;

        let hub_exec = hub.clone();
        let exec =
            tokio::spawn(async move { hub_exec.execute_tool("ping".into(), json!({})).await });

        let frame = rx2
            .recv()
            .await
            .expect("second session still receives frames");
        let call_id = match frame {
            BridgeServerMessage::ExecuteTool { id, .. } => id,
            other => panic!("unexpected frame: {other:?}"),
        };
        hub.handle_authenticated_message(BridgeClientMessage::ToolResult {
            id: call_id,
            result: ToolResultPayload::Value(json!({ "ok": true })),
        })
        .await;

        assert_eq!(
            exec.await.expect("join").expect("ok"),
            json!({ "ok": true })
        );
    }

    #[tokio::test]
    async fn timeout_cancels_inflight_tool_and_emits_cancel_tool_frame() {
        let hub = PageSessionHub::with_timeout(Duration::from_millis(25));
        let (tx, mut rx) = mpsc::unbounded_channel();
        let _id = hub.attach(tx).await;

        let err = hub
            .execute_tool("hang".into(), json!({}))
            .await
            .expect_err("should time out");
        assert_eq!(err, HubError::Timeout);

        let first = rx.recv().await.expect("execute frame");
        let call_id = match first {
            BridgeServerMessage::ExecuteTool { id, .. } => id,
            other => panic!("expected ExecuteTool, got {other:?}"),
        };
        let second = rx.recv().await.expect("cancel frame");
        assert_eq!(second, BridgeServerMessage::CancelTool { id: call_id });
    }

    #[tokio::test]
    async fn disconnect_fails_inflight_tool_calls_with_disconnected() {
        let hub = PageSessionHub::new();
        let (tx, mut rx) = mpsc::unbounded_channel();
        let session_id = hub.attach(tx).await;

        let hub_exec = hub.clone();
        let exec =
            tokio::spawn(async move { hub_exec.execute_tool("slow".into(), json!({})).await });

        let _ = rx.recv().await.expect("received execute_tool");
        hub.detach(session_id).await;

        let err = exec.await.expect("join").expect_err("should fail");
        assert_eq!(err, HubError::Disconnected);
    }

    #[tokio::test]
    async fn sync_tools_caps_count_and_drops_invalid_tools() {
        let hub = PageSessionHub::new();
        let mut tools = vec![BridgeToolSummary {
            name: "bad name with spaces".into(),
            title: None,
            description: "invalid".into(),
            input_schema: None,
            output_schema: None,
            annotations: None,
        }];
        for i in 0..(MAX_SYNCED_TOOLS + 10) {
            tools.push(BridgeToolSummary {
                name: format!("tool_{i}"),
                title: None,
                description: "valid".into(),
                input_schema: None,
                output_schema: None,
                annotations: None,
            });
        }
        hub.handle_authenticated_message(BridgeClientMessage::SyncTools { tools })
            .await;

        let synced = hub.list_tools().await;
        assert_eq!(synced.len(), MAX_SYNCED_TOOLS);
        assert!(synced.iter().all(|t| t.name != "bad name with spaces"));
    }
}
