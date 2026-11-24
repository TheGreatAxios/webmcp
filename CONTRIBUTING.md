# Contributing

## Quick Verification

```bash
# TypeScript workspace
bun install
bun run build
bun run typecheck
bun run test

# Rust workspace
bun run arch:check
bun run rust:test
bun run rust:clippy
```

CI runs both the TypeScript and Rust verification suites plus `bun run build:examples`. All must pass before merging.

## Conventions

- **Architectural boundaries (Rust):** Run `bun run arch:check` after modifying `Cargo.toml` or adding crates. L1 crates must stay zero-I/O, L2 crates must not depend on sibling L2 domains (`webmcp-ws` ⊥ `webmcp-mcp`), and no Rust file may exceed 450 lines.
- **Safety (Rust):** `unsafe_code = "forbid"`, `unused_must_use = "deny"`, and no `unwrap()`/`expect()` in non-test code.
- **Experimental APIs (TS):** Non-spec features use an `experimental_` prefix. Breaking changes there do not require a major stable bump.
- **Tests:** Every non-trivial behavior change or bug fix needs a unit or integration test.
- **Versioning:** npm packages version in lockstep; note user-facing changes in `CHANGELOG.md`.

## Release

```bash
bun run release 0.2.0 --otp <code>   # --dry-run to preview
```

The release script verifies a clean tree, runs build/test/typecheck, bumps workspace packages together, publishes in dependency order, restores `workspace:*` references, and tags `vX.Y.Z`.
