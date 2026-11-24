//! Journey-scoped tool exposure policy.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use webmcp_protocol::BridgeToolSummary;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JourneyDefinition {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub tools: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<String>>,
}

#[derive(Debug, Default)]
pub struct JourneyState {
    journeys: HashMap<String, JourneyDefinition>,
    active: HashSet<String>,
}

impl JourneyState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, definition: JourneyDefinition) {
        self.journeys.insert(definition.name.clone(), definition);
    }

    pub fn unregister(&mut self, name: &str) {
        self.journeys.remove(name);
        self.active.remove(name);
    }

    pub fn set_active(&mut self, name: &str, active: bool) {
        if active {
            if self.journeys.contains_key(name) {
                self.active.insert(name.to_string());
            }
        } else {
            self.active.remove(name);
        }
    }

    pub fn is_tool_exposed(&self, tool_name: &str) -> bool {
        if self.active.is_empty() {
            return true;
        }
        self.active.iter().any(|j| {
            self.journeys
                .get(j)
                .is_some_and(|def| def.tools.iter().any(|t| t == tool_name))
        })
    }

    pub fn filter_tools<'a>(&self, tools: &'a [BridgeToolSummary]) -> Vec<&'a BridgeToolSummary> {
        tools
            .iter()
            .filter(|t| self.is_tool_exposed(&t.name))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_all_when_no_journey_active_else_only_active_tools() {
        let mut state = JourneyState::new();
        assert!(state.is_tool_exposed("any_tool"));

        state.register(JourneyDefinition {
            name: "checkout".into(),
            description: None,
            tools: vec!["add_card".into(), "submit_order".into()],
            steps: None,
        });
        assert!(state.is_tool_exposed("other_tool"));

        state.set_active("checkout", true);
        assert!(state.is_tool_exposed("add_card"));
        assert!(!state.is_tool_exposed("other_tool"));

        state.set_active("checkout", false);
        assert!(state.is_tool_exposed("other_tool"));
    }
}
