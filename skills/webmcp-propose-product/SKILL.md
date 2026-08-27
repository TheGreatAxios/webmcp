---
name: webmcp-propose-product
description: Proposes a from-scratch WebMCP product after research and teardown. Defines positioning vs webmcp-react, the 100x thesis, layered architecture, feature tiers, explicit non-goals, phased delivery, and success metrics. Use when scoping a new agent-native web library or deciding what to build instead of agentcathq/webmcp-react.
---

# Propose WebMCP Product (From Scratch)

## Prerequisites

Run first:
1. `webmcp-research` — landscape brief
2. `webmcp-teardown` — gap matrix and verdict

Do not propose features that duplicate table-stakes already solved by extend/fork.

## Step 1: State positioning in one line

Template:

> **[Product name]** is a **[category]** that **[primary outcome]** for **[user]**, unlike **[competitor]** which is only **[competitor category]**.

Example:

> **AgentKit Web** is an **agent-native app framework** that makes React apps **agent-operable with near-zero boilerplate and safe mutations**, unlike **webmcp-react** which is a **registration adapter** for `document.modelContext`.

## Step 2: Define the 100x thesis

The thesis must be **one of these** (pick primary + optional secondary):

| Thesis | 100x means | Not 100x |
|--------|------------|----------|
| **Zero-boilerplate exposure** | Forms, routes, server actions → tools automatically | Slightly nicer `useMcpTool` |
| **Agent-native state** | Agent mutations ↔ UI state, undo, attribution | Returning `CallToolResult` |
| **HITL by default** | Consent, preview, audit for write/destructive tools | Spec-waiting for elicitation |
| **Journeys not tool lists** | Skills with steps, guards, phase context | Flat tool registry |
| **Extension-free desktop** | Pluggable transports, one config | Same Chrome extension |
| **Agent devtools** | Inspect, replay, simulate agent sessions | Wordle playground only |

**Rule:** If you can't explain why it's 10x better in one sentence per thesis, it's incremental.

## Step 3: Layered architecture

Propose packages:

```
@scope/webmcp-core        registry, validation, polyfill, transports
@scope/webmcp-react       hooks, provider, declarative components
@scope/webmcp-devtools    inspector, mock agent, replay
@scope/webmcp-testing     simulateAgent(), Playwright helpers
[optional] @scope/webmcp-cli  codegen from OpenAPI/tRPC
```

Draw data flow:

```
Declarative (FormTool, RouteTool) + Imperative (useMcpTool)
  → Skills layer (defineSkill)
  → State layer (useAgentState / mutation log)
  → HITL layer (confirm, audit)
  → Core (registerTool, polyfill)
  → Transport (native | websocket-mcp | extension-bridge)
```

## Step 4: Feature tiers

### Tier 0 — Must ship (MVP)

Features that justify **replace** not **extend**:

| Feature | User-visible outcome |
|---------|---------------------|
| | |

### Tier 1 — Differentiation

| Feature | Why agents become reliable |
|---------|---------------------------|
| | |

### Tier 2 — Spec extensions (clearly labeled)

Non-standard until W3C catches up: resources, progress, streaming.

Mark each as `spec-extension` in docs.

## Step 5: Explicit non-goals

List what you will **not** build (prevents scope creep):

- [ ] Full in-page MCP server duplicating webmcp.dev
- [ ] Headless autonomous agents without human in loop
- [ ] Backend MCP replacement
- [ ] ...

## Step 6: Phased delivery

| Phase | Ships | Proves |
|-------|-------|--------|
| **P0** | core + react + one transport | Agent can complete one multi-step flow |
| **P1** | state sync + HITL | Production-safe writes |
| **P2** | skills + devtools | 20+ tool apps stay reliable |
| **P3** | declarative forms + discovery manifest | Near-zero boilerplate |

No calendar estimates — use technical gates ("works in Cursor without extension" = P0 gate).

## Step 7: Success metrics

| Metric | Target | How to measure |
|--------|--------|----------------|
| Tools to ship checkout flow | e.g. 0 manual tool components | count `useMcpTool` calls |
| Time to first agent-callable action | | stopwatch / onboarding doc |
| Agent success rate on journey | | simulateAgent harness |
| Desktop setup steps | e.g. ≤2 without extension | setup doc audit |
| User undo rate after agent write | | HITL analytics |

## Step 8: Build vs extend decision

| Option | When | Action |
|--------|------|--------|
| **Use webmcp-react** | Registration-only need, <5 tools, Chrome-only users | npm install |
| **Extend webmcp-react** | Need devtools/state as separate packages atop it | fork polyfill, don't rewrite hooks |
| **Replace from scratch** | Agent-native state + journeys + transport are product core | new monorepo per Step 3 |

## Step 9: Product proposal output template

```markdown
## Positioning (1 line)

## 100x thesis (primary + why it's not incremental)

## Who this is for / not for

## Architecture (packages + diagram)

## Tier 0 / 1 / 2 features (tables)

## Non-goals

## Phases P0–P3 with gates

## Success metrics

## Recommendation: use / extend / replace [competitor]

## If building P0 next: first 3 engineering tasks
```

## Anti-patterns

- "Better hooks" as the product — that's not a company/library thesis
- Shipping 15 features at P0 — pick one 100x wedge
- Forking the polyfill without a transport or state story
- Promising cross-browser native support before Chrome stabilizes
