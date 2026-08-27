---
name: webmcp-teardown
description: Technical teardown of a WebMCP integration package (e.g. webmcp-react). Maps architecture, API surface, what problems it actually solves, explicit non-goals, failure modes, and gap matrix vs production agent-native apps. Use after webmcp-research when deciding what to rebuild from scratch.
---

# WebMCP Package Teardown

## Goal

Produce a **honest teardown**: what the package is, what it is not, where it breaks in real apps, and a scored gap matrix.

## Step 1: Classify the package

Pick one label (be precise):

| Label | Definition |
|-------|------------|
| **Registration adapter** | Wraps `registerTool` + lifecycle only |
| **Integration framework** | State sync, HITL, journeys, devtools |
| **Transport product** | Extension + MCP server is the main value |
| **Full agent-native stack** | All of the above |

Most hook libraries are **registration adapters + polyfill + transport workaround**.

## Step 2: Architecture map

Draw or list:

```
App components
  → hooks (useMcpTool)
  → provider (polyfill install)
  → document.modelContext.registerTool
  → [native Chrome | in-memory polyfill]
  → [optional] navigator.modelContextTesting
  → [optional] extension → MCP server → desktop client
```

For each box, note file/module ownership and lines-of-code concentration.

## Step 3: API inventory

| Category | List every export | Verdict |
|----------|-------------------|---------|
| Components | e.g. WebMCPProvider | |
| Hooks | e.g. useMcpTool, useWebMCPStatus | |
| Types | | |
| Polyfill internals | should consumers see these? | |

Per hook, document:
- Mount/unmount behavior (StrictMode)
- Re-registration triggers (schema fingerprint deps)
- Dual execution paths (UI `execute()` vs agent shim)
- Error semantics (throw vs `isError` result)

## Step 4: Problem → solution matrix

Fill honestly:

| Developer problem | Does package solve? | How | Left for app dev |
|-------------------|---------------------|-----|------------------|
| Register typed tools | | | |
| SSR / Next.js | | | |
| StrictMode safe registration | | | |
| Validate tool inputs | | | |
| Connect Cursor/Claude to page | | | |
| Keep UI in sync after agent acts | | | |
| Confirm destructive actions | | | |
| Multi-step agent workflows | | | |
| Debug why agent picked wrong tool | | | |
| Dynamic tools by route/auth | | | partial |
| Forms as tools (declarative) | | | |
| Long-running + progress | | | |
| Audit who changed what | | | |

## Step 5: Failure modes (production)

List concrete failures, not abstractions:

1. Agent calls tool → handler runs → **UI doesn't update** (no state bridge)
2. Agent calls `delete_*` → **no confirmation** (removed ModelContextClient)
3. 20+ tools → **agent picks wrong tool** (flat list, no journeys)
4. Navigation → **tools disappear** (extension "until reload" mode)
5. Tool name collision across tabs → **awkward namespacing**
6. Spec/native drift → **polyfill behavior differs** from Chrome
7. Every tool = **new headless component** → boilerplate explosion

## Step 6: Dependency & footprint

| Metric | Value |
|--------|-------|
| Runtime dependencies | |
| Peer dependencies | |
| Ships extension? separate npm? | |
| Test coverage areas | |
| Maturity signal | version, breaking changes in 0.2 |

## Step 7: Gap scoring

Score each gap 1–5 (5 = blocks production):

| Gap | Severity (1-5) | Build cost to fix in-app | Fix belongs in library? |
|-----|----------------|--------------------------|-------------------------|
| No agent↔state sync | | | |
| No HITL UI | | | |
| Extension-required desktop path | | | |
| No skills/journeys | | | |
| No declarative forms | | | |
| No devtools in package | | | |
| React-only | | | |
| No streaming/progress | | | |

## Step 8: Teardown output template

```markdown
## One-sentence classification

## Architecture (diagram or bullets)

## What it solves well (keep these)

## What it explicitly does NOT solve (non-goals)

## Production failure modes (numbered, concrete)

## Gap matrix (table)

## Top 5 gaps ranked by severity × frequency

## Verdict: extend vs fork vs replace
```

## Anti-patterns

- Praising Zod/SSR/StrictMode as "100x" — table stakes, not differentiation
- Treating removed APIs (ModelContextClient) as "fine" without naming the product gap
- Ignoring the extension as core adoption path — it's half the desktop story today
