//! Validation rules matching W3C WebMCP tool constraints.

use thiserror::Error;

use crate::types::BridgeToolSummary;

pub const MAX_TOOL_NAME_LEN: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ValidationError {
    #[error("invalid tool name '{0}': must be 1..=128 chars of [A-Za-z0-9_.-]")]
    InvalidName(String),
    #[error("tool description must not be empty")]
    EmptyDescription,
    #[error("inputSchema must be a JSON object")]
    InvalidInputSchema,
    #[error("outputSchema must be a JSON object")]
    InvalidOutputSchema,
}

pub fn validate_tool_name(name: &str) -> Result<(), ValidationError> {
    if name.is_empty()
        || name.len() > MAX_TOOL_NAME_LEN
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'-'))
    {
        return Err(ValidationError::InvalidName(name.to_string()));
    }
    Ok(())
}

pub fn validate_tool_description(description: &str) -> Result<(), ValidationError> {
    if description.trim().is_empty() {
        return Err(ValidationError::EmptyDescription);
    }
    Ok(())
}

pub fn validate_tool_summary(tool: &BridgeToolSummary) -> Result<(), ValidationError> {
    validate_tool_name(&tool.name)?;
    validate_tool_description(&tool.description)?;
    if let Some(schema) = &tool.input_schema
        && !schema.is_object()
    {
        return Err(ValidationError::InvalidInputSchema);
    }
    if let Some(schema) = &tool.output_schema
        && !schema.is_object()
    {
        return Err(ValidationError::InvalidOutputSchema);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_names_and_descriptions() {
        assert!(validate_tool_name("search.products-v2_ok").is_ok());
        assert!(validate_tool_name("").is_err());
        assert!(validate_tool_name("has space").is_err());
        assert!(validate_tool_name(&"a".repeat(129)).is_err());
        assert!(validate_tool_description("   ").is_err());
        assert!(validate_tool_description("Runs search").is_ok());
    }

    #[test]
    fn rejects_non_object_schemas() {
        let tool = BridgeToolSummary {
            name: "t1".into(),
            title: None,
            description: "desc".into(),
            input_schema: Some(json!("not-an-object")),
            output_schema: None,
            annotations: None,
        };
        assert_eq!(
            validate_tool_summary(&tool),
            Err(ValidationError::InvalidInputSchema)
        );
    }
}
