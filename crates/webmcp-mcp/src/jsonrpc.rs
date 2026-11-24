//! MCP JSON-RPC 2.0 request dispatcher (protocol version 2025-03-26).

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use webmcp_protocol::BridgeHub;

pub const MCP_PROTOCOL_VERSION: &str = "2025-03-26";

#[derive(Debug, Clone)]
pub struct McpServerInfo {
    pub name: String,
    pub version: String,
}

impl Default for McpServerInfo {
    fn default() -> Self {
        Self {
            name: "webmcp-bridge".into(),
            version: env!("CARGO_PKG_VERSION").into(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    #[serde(default)]
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

impl JsonRpcResponse {
    pub fn ok(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }

    pub fn err(id: Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
            }),
        }
    }
}

pub fn tools_list_changed_notification() -> Value {
    json!({
        "jsonrpc": "2.0",
        "method": "notifications/tools/list_changed"
    })
}

/// Dispatch a single JSON-RPC 2.0 request against a `BridgeHub`.
/// Returns `None` for notifications (requests with no `id`).
pub async fn handle_jsonrpc_request(
    hub: &dyn BridgeHub,
    info: &McpServerInfo,
    raw: &str,
) -> Option<JsonRpcResponse> {
    let req: JsonRpcRequest = match serde_json::from_str(raw) {
        Ok(r) => r,
        Err(e) => {
            return Some(JsonRpcResponse::err(
                Value::Null,
                -32700,
                format!("Parse error: {e}"),
            ));
        }
    };

    if req.jsonrpc != "2.0" {
        return req
            .id
            .map(|id| JsonRpcResponse::err(id, -32600, "Invalid Request: jsonrpc must be '2.0'"));
    }

    // Notifications (no id) require no response.
    let id = req.id?;

    let resp = match req.method.as_str() {
        "initialize" => JsonRpcResponse::ok(
            id,
            json!({
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {
                    "tools": { "listChanged": true }
                },
                "serverInfo": {
                    "name": info.name,
                    "version": info.version
                }
            }),
        ),
        "ping" => JsonRpcResponse::ok(id, json!({})),
        "tools/list" => {
            let tools = hub.list_tools().await;
            let mapped: Vec<Value> = tools
                .into_iter()
                .map(|t| {
                    let mut obj = json!({
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema.unwrap_or_else(|| json!({
                            "type": "object",
                            "properties": {}
                        })),
                    });
                    if let Some(title) = t.title {
                        obj["title"] = Value::String(title);
                    }
                    if let Some(output_schema) = t.output_schema {
                        obj["outputSchema"] = output_schema;
                    }
                    if let Some(annotations) = t.annotations
                        && let Ok(v) = serde_json::to_value(annotations)
                    {
                        obj["annotations"] = v;
                    }
                    obj
                })
                .collect();
            JsonRpcResponse::ok(id, json!({ "tools": mapped }))
        }
        "tools/call" => {
            let params = req.params.unwrap_or_else(|| json!({}));
            let Some(name) = params.get("name").and_then(Value::as_str) else {
                return Some(JsonRpcResponse::err(
                    id,
                    -32602,
                    "Missing required param 'name'",
                ));
            };
            let args = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));

            match hub.execute_tool(name.to_string(), args).await {
                Ok(result) => JsonRpcResponse::ok(id, normalize_tool_result(result)),
                Err(e) => JsonRpcResponse::ok(
                    id,
                    json!({
                        "content": [{ "type": "text", "text": e.to_string() }],
                        "isError": true
                    }),
                ),
            }
        }
        other => JsonRpcResponse::err(id, -32601, format!("Method not found: {other}")),
    };

    Some(resp)
}

fn normalize_tool_result(result: Value) -> Value {
    if let Some(obj) = result.as_object()
        && obj.contains_key("content")
    {
        return result;
    }
    json!({
        "content": [{
            "type": "text",
            "text": serde_json::to_string(&result).unwrap_or_default()
        }]
    })
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use webmcp_protocol::{BoxFuture, BridgeToolSummary, HubError};

    struct MockHub;
    impl BridgeHub for MockHub {
        fn list_tools(&self) -> BoxFuture<'_, Vec<BridgeToolSummary>> {
            Box::pin(async {
                vec![BridgeToolSummary {
                    name: "echo".into(),
                    title: None,
                    description: "Echoes input".into(),
                    input_schema: Some(json!({"type": "object"})),
                    output_schema: None,
                    annotations: None,
                }]
            })
        }
        fn execute_tool(
            &self,
            _name: String,
            args: Value,
        ) -> BoxFuture<'_, Result<Value, HubError>> {
            Box::pin(async move { Ok(json!({ "echoed": args })) })
        }
        fn wait_tools_changed(&self) -> BoxFuture<'_, ()> {
            Box::pin(async {})
        }
    }

    #[tokio::test]
    async fn handles_initialize_list_and_call() {
        let hub = MockHub;
        let info = McpServerInfo::default();

        let init = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#,
        )
        .await
        .expect("init resp");
        assert_eq!(
            init.result.expect("res")["protocolVersion"],
            MCP_PROTOCOL_VERSION
        );

        let list = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","id":2,"method":"tools/list"}"#,
        )
        .await
        .expect("list resp");
        assert_eq!(list.result.expect("res")["tools"][0]["name"], "echo");

        let call = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"echo","arguments":{"a":1}}}"#,
        )
        .await
        .expect("call resp");
        let text = call.result.expect("res")["content"][0]["text"]
            .as_str()
            .expect("text")
            .to_string();
        assert!(text.contains("\"a\":1"));
    }

    #[tokio::test]
    async fn validates_jsonrpc_errors_and_notifications() {
        let hub = MockHub;
        let info = McpServerInfo::default();

        // Malformed JSON -> -32700
        let parse_err = handle_jsonrpc_request(&hub, &info, "{not json")
            .await
            .expect("err");
        assert_eq!(parse_err.error.expect("e").code, -32700);

        // Wrong jsonrpc version -> -32600
        let ver_err =
            handle_jsonrpc_request(&hub, &info, r#"{"jsonrpc":"1.0","id":1,"method":"ping"}"#)
                .await
                .expect("err");
        assert_eq!(ver_err.error.expect("e").code, -32600);

        // Unknown method -> -32601
        let meth_err = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","id":2,"method":"unknown/op"}"#,
        )
        .await
        .expect("err");
        assert_eq!(meth_err.error.expect("e").code, -32601);

        // Missing tool name -> -32602
        let param_err = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{}}"#,
        )
        .await
        .expect("err");
        assert_eq!(param_err.error.expect("e").code, -32602);

        // Notification (no id) -> None
        let notif = handle_jsonrpc_request(
            &hub,
            &info,
            r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#,
        )
        .await;
        assert!(notif.is_none());
    }
}
