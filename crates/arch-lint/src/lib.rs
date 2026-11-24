//! `arch-lint` — workspace architectural boundary checker.

pub mod metadata;
pub mod rules;

use metadata::WorkspaceGraph;
use rules::ArchRules;

#[derive(Debug)]
pub struct Violation {
    pub rule: String,
    pub crate_name: String,
    pub message: String,
}

pub fn check_workspace(graph: &WorkspaceGraph, rules: &ArchRules) -> Vec<Violation> {
    let mut violations = Vec::new();

    let name_to_layer: std::collections::HashMap<&str, &str> = graph
        .crates
        .iter()
        .filter_map(|c| rules::find_layer(&c.name, &rules.layers).map(|l| (c.name.as_str(), l)))
        .collect();

    for krate in &graph.crates {
        let this_layer = name_to_layer.get(krate.name.as_str()).copied();
        let layer_rule = this_layer.and_then(|l| rules.layers.iter().find(|r| r.name == l));

        if let Some(max) = rules.global.max_file_lines {
            for src in &krate.src_files {
                if let Ok(content) = std::fs::read_to_string(src) {
                    let count = content.lines().count();
                    if count > max {
                        violations.push(Violation {
                            rule: "max_file_lines".to_string(),
                            crate_name: krate.name.clone(),
                            message: format!("{} has {count} lines (limit: {max})", src.display()),
                        });
                    }
                }
            }
        }

        let Some(rule) = layer_rule else { continue };

        for dep in &krate.dependencies {
            if !graph.crates.iter().any(|c| &c.name == dep) {
                let dep_base = dep.split('-').next().unwrap_or(dep);
                if rule
                    .forbidden_external_crates
                    .iter()
                    .any(|f| dep == f || dep_base == f)
                {
                    violations.push(Violation {
                        rule: "forbidden_external_crate".to_string(),
                        crate_name: krate.name.clone(),
                        message: format!("layer `{}` forbids external crate `{dep}`", rule.name),
                    });
                }
            }
        }

        for dep in &krate.dependencies {
            if let Some(&dep_layer) = name_to_layer.get(dep.as_str()) {
                let same_layer = this_layer == Some(dep_layer);
                let allowed = rule.allowed_layer_deps.iter().any(|a| a == dep_layer);
                if !same_layer && !allowed {
                    violations.push(Violation {
                        rule: "layer_dep".to_string(),
                        crate_name: krate.name.clone(),
                        message: format!(
                            "depends on `{dep}` (layer `{dep_layer}`) — layer `{}` only allows {:?}",
                            rule.name, rule.allowed_layer_deps
                        ),
                    });
                }
            }
        }

        for domain in &rules.domain_rules {
            let from_match = domain
                .from_prefixes
                .iter()
                .any(|p| krate.name.starts_with(p.as_str()));
            if from_match {
                for dep in &krate.dependencies {
                    let deny = domain
                        .deny_target_prefixes
                        .iter()
                        .any(|p| dep.starts_with(p.as_str()));
                    if deny {
                        violations.push(Violation {
                            rule: format!("domain:{}", domain.name),
                            crate_name: krate.name.clone(),
                            message: format!(
                                "domain rule `{}` violated: depends on `{dep}`",
                                domain.name
                            ),
                        });
                    }
                }
            }
        }
    }

    violations
}

pub fn render_tree(graph: &WorkspaceGraph, rules: &ArchRules) -> String {
    let mut out = String::new();
    out.push_str("Workspace crate tree (arch-lint)\n");
    out.push_str("================================\n\n");

    for krate in &graph.crates {
        let layer = rules::find_layer(&krate.name, &rules.layers).unwrap_or("?");
        out.push_str(&format!("  [{}] {}\n", layer, krate.name));
        for dep in &krate.dependencies {
            out.push_str(&format!("        → {dep}\n"));
        }
    }
    out
}
