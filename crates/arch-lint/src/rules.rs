//! `arch-rules.toml` schema types.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ArchRules {
    pub global: GlobalRules,
    #[serde(default)]
    pub layers: Vec<LayerRule>,
    #[serde(rename = "domain_rules", default)]
    pub domain_rules: Vec<DomainRule>,
}

#[derive(Debug, Deserialize)]
pub struct GlobalRules {
    pub max_file_lines: Option<usize>,
    #[serde(default)]
    pub forbidden_terms: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct LayerRule {
    pub name: String,
    pub match_suffix: Option<String>,
    #[serde(default)]
    pub match_exact: Vec<String>,
    #[serde(default)]
    pub match_prefixes: Vec<String>,
    pub exclude_suffix: Option<String>,
    #[serde(default)]
    pub exclude_exact: Vec<String>,
    #[serde(default)]
    pub allowed_layer_deps: Vec<String>,
    #[serde(default)]
    pub forbidden_external_crates: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct DomainRule {
    pub name: String,
    pub from_prefixes: Vec<String>,
    pub deny_target_prefixes: Vec<String>,
}

pub fn find_layer<'a>(name: &str, layers: &'a [LayerRule]) -> Option<&'a str> {
    for layer in layers {
        if layer.match_exact.iter().any(|e| e == name) {
            return Some(&layer.name);
        }
    }
    for layer in layers {
        let suffix_ok = layer
            .match_suffix
            .as_deref()
            .is_some_and(|s| name.ends_with(s));
        let prefix_ok = layer
            .match_prefixes
            .iter()
            .any(|p| name.starts_with(p.as_str()));

        if suffix_ok || prefix_ok {
            let excl_suffix = layer
                .exclude_suffix
                .as_deref()
                .is_some_and(|s| name.ends_with(s));
            let excl_exact = layer.exclude_exact.iter().any(|e| e == name);
            if !excl_suffix && !excl_exact {
                return Some(&layer.name);
            }
        }
    }
    None
}
