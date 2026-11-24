//! CLI entry point for `arch-lint` (`check` | `tree`).

use std::{env, fs, path::PathBuf, process};

use arch_lint::metadata::load_workspace_graph;
use arch_lint::rules::ArchRules;
use arch_lint::{check_workspace, render_tree};

fn main() {
    let cmd = env::args().nth(1).unwrap_or_else(|| "check".into());
    let root = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let rules_path = root.join("arch-rules.toml");

    let rules_text = match fs::read_to_string(&rules_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("arch-lint: failed to read {}: {e}", rules_path.display());
            process::exit(2);
        }
    };

    let rules: ArchRules = match toml::from_str(&rules_text) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("arch-lint: invalid arch-rules.toml: {e}");
            process::exit(2);
        }
    };

    let graph = match load_workspace_graph(&root) {
        Ok(g) => g,
        Err(e) => {
            eprintln!("arch-lint: {e}");
            process::exit(2);
        }
    };

    match cmd.as_str() {
        "tree" | "graph" => {
            print!("{}", render_tree(&graph, &rules));
        }
        "check" => {
            let violations = check_workspace(&graph, &rules);
            if violations.is_empty() {
                println!(
                    "arch-lint: OK ({} crates verified against arch-rules.toml)",
                    graph.crates.len()
                );
            } else {
                eprintln!("arch-lint: FAILED — {} violation(s):", violations.len());
                for v in &violations {
                    eprintln!("  [{}] ({}) {}", v.rule, v.crate_name, v.message);
                }
                process::exit(1);
            }
        }
        other => {
            eprintln!("usage: arch-lint [check|tree]  (got '{other}')");
            process::exit(2);
        }
    }
}
