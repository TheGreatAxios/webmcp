//! Workspace metadata loader — reads Cargo.toml files to build a crate graph.

use serde::Deserialize;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MetadataError {
    #[error("I/O error reading {path}: {err}")]
    Io { path: String, err: std::io::Error },
    #[error("TOML parse error in {path}: {err}")]
    Toml { path: String, err: toml::de::Error },
}

#[derive(Debug)]
pub struct CrateInfo {
    pub name: String,
    pub path: PathBuf,
    pub dependencies: Vec<String>,
    pub src_files: Vec<PathBuf>,
}

pub struct WorkspaceGraph {
    pub root: PathBuf,
    pub crates: Vec<CrateInfo>,
}

#[derive(Deserialize)]
struct WorkspaceCargo {
    workspace: WorkspaceSection,
}

#[derive(Deserialize)]
struct WorkspaceSection {
    members: Vec<String>,
}

#[derive(Deserialize)]
struct CrateCargo {
    package: PackageSection,
    #[serde(default)]
    dependencies: HashMap<String, toml::Value>,
    #[serde(rename = "dev-dependencies", default)]
    dev_dependencies: HashMap<String, toml::Value>,
    #[serde(rename = "build-dependencies", default)]
    build_dependencies: HashMap<String, toml::Value>,
}

#[derive(Deserialize)]
struct PackageSection {
    name: String,
}

pub fn load_workspace_graph(root: &Path) -> Result<WorkspaceGraph, MetadataError> {
    let ws_path = root.join("Cargo.toml");
    let ws_text = read(&ws_path)?;
    let ws: WorkspaceCargo = parse(&ws_path, &ws_text)?;

    let mut crates = Vec::new();

    for member_glob in &ws.workspace.members {
        let member_paths = expand_member(root, member_glob);
        for member_path in member_paths {
            let cargo_path = member_path.join("Cargo.toml");
            if !cargo_path.exists() {
                continue;
            }
            let cargo_text = read(&cargo_path)?;
            let cargo: CrateCargo = parse(&cargo_path, &cargo_text)?;

            let dependencies = collect_dep_names(&cargo);
            let src_files = collect_src_files(&member_path);

            crates.push(CrateInfo {
                name: cargo.package.name,
                path: member_path,
                dependencies,
                src_files,
            });
        }
    }

    Ok(WorkspaceGraph {
        root: root.to_path_buf(),
        crates,
    })
}

fn read(path: &Path) -> Result<String, MetadataError> {
    fs::read_to_string(path).map_err(|err| MetadataError::Io {
        path: path.display().to_string(),
        err,
    })
}

fn parse<T: serde::de::DeserializeOwned>(path: &Path, text: &str) -> Result<T, MetadataError> {
    toml::from_str(text).map_err(|err| MetadataError::Toml {
        path: path.display().to_string(),
        err,
    })
}

fn collect_dep_names(cargo: &CrateCargo) -> Vec<String> {
    cargo
        .dependencies
        .keys()
        .chain(cargo.dev_dependencies.keys())
        .chain(cargo.build_dependencies.keys())
        .cloned()
        .collect()
}

fn collect_src_files(crate_path: &Path) -> Vec<PathBuf> {
    let src = crate_path.join("src");
    if !src.exists() {
        return Vec::new();
    }
    walkdir::WalkDir::new(&src)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && e.path().extension().is_some_and(|x| x == "rs"))
        .map(|e| e.path().to_path_buf())
        .collect()
}

fn expand_member(root: &Path, pattern: &str) -> Vec<PathBuf> {
    if !pattern.contains('*') {
        return vec![root.join(pattern)];
    }

    if let Some(prefix) = pattern.strip_suffix("/*") {
        let dir = root.join(prefix);
        if let Ok(entries) = fs::read_dir(&dir) {
            return entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect();
        }
    }

    vec![root.join(pattern)]
}
