//! Wire protocol messages between a browser page and `webmcp-bridge`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::BridgeToolSummary;

/// Payload for a `tool_result` message from the browser page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ToolResultPayload {
    Error { error: String },
    Value(Value),
}

/// Messages sent from the browser page client to `webmcp-bridge`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeClientMessage {
    Auth {
        token: String,
    },
    SyncTools {
        tools: Vec<BridgeToolSummary>,
    },
    ToolResult {
        id: String,
        result: ToolResultPayload,
    },
}

/// Messages sent from `webmcp-bridge` to the browser page client.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeServerMessage {
    AuthRequired,
    AuthOk,
    Error {
        message: String,
    },
    ExecuteTool {
        id: String,
        name: String,
        args: Value,
    },
    CancelTool {
        id: String,
    },
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn client_messages_deserialize_from_ts_format() {
        let auth: BridgeClientMessage =
            serde_json::from_str(r#"{"type":"auth","token":"secret"}"#).expect("auth");
        assert_eq!(
            auth,
            BridgeClientMessage::Auth {
                token: "secret".into()
            }
        );

        let result: BridgeClientMessage = serde_json::from_str(
            r#"{"type":"tool_result","id":"1","result":{"content":[{"type":"text","text":"ok"}]}}"#,
        )
        .expect("tool_result");
        assert!(matches!(
            result,
            BridgeClientMessage::ToolResult {
                result: ToolResultPayload::Value(_),
                ..
            }
        ));

        let err_result: BridgeClientMessage =
            serde_json::from_str(r#"{"type":"tool_result","id":"2","result":{"error":"boom"}}"#)
                .expect("tool_result err");
        assert_eq!(
            err_result,
            BridgeClientMessage::ToolResult {
                id: "2".into(),
                result: ToolResultPayload::Error {
                    error: "boom".into()
                }
            }
        );
    }

    #[test]
    fn server_messages_serialize_snake_case_tags() {
        let exec = BridgeServerMessage::ExecuteTool {
            id: "abc".into(),
            name: "echo".into(),
            args: json!({ "msg": "hi" }),
        };
        let v = serde_json::to_value(&exec).expect("serialize");
        assert_eq!(v["type"], "execute_tool");
        assert_eq!(v["name"], "echo");

        let cancel = BridgeServerMessage::CancelTool { id: "abc".into() };
        assert_eq!(
            serde_json::to_value(&cancel).expect("cancel")["type"],
            "cancel_tool"
        );
    }
}
