//! Core WebMCP tool vocabulary aligned with W3C WebMCP (Nov 2026) and MCP.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Tool annotations aligned with the W3C WebMCP `ToolAnnotations` dictionary.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolAnnotations {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read_only_hint: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub untrusted_content_hint: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consequential_hint: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub debugging: Option<bool>,
}

/// Content block returned inside a `CallToolResult`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Image {
        data: String,
        #[serde(rename = "mimeType")]
        mime_type: String,
    },
}

/// Structured MCP tool call result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallToolResult {
    pub content: Vec<ContentBlock>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structured_content: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

/// Serializable tool metadata exchanged between browser pages and the bridge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeToolSummary {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_schema: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub annotations: Option<ToolAnnotations>,
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tool_summary_roundtrips_camel_case() {
        let summary = BridgeToolSummary {
            name: "search_catalog".into(),
            title: Some("Search Catalog".into()),
            description: "Search products".into(),
            input_schema: Some(json!({ "type": "object" })),
            output_schema: Some(json!({ "type": "array" })),
            annotations: Some(ToolAnnotations {
                read_only_hint: Some(true),
                untrusted_content_hint: None,
                consequential_hint: Some(false),
                debugging: Some(false),
            }),
        };

        let encoded = serde_json::to_value(&summary).expect("serialize");
        assert_eq!(encoded["inputSchema"]["type"], "object");
        assert_eq!(encoded["outputSchema"]["type"], "array");
        assert_eq!(encoded["annotations"]["readOnlyHint"], true);
        assert_eq!(encoded["annotations"]["consequentialHint"], false);

        let decoded: BridgeToolSummary = serde_json::from_value(encoded).expect("deserialize");
        assert_eq!(decoded, summary);
    }
}
