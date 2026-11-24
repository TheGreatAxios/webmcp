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
    pub fn new() -> Self {
        Self::with_timeout(DEFAULT_TOOL_TIMEOUT)
    }

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
        let outbound = self.inner.outbound.read().await.as_ref().map(|s| s.tx.clone());
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
            self.inner.pending.lock().await.insert(id.clone(), tx);

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
