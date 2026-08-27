---
name: webmcp-research
description: Research the WebMCP ecosystem before building or evaluating a competitor. Maps the W3C standard, hook libraries (webmcp-react), legacy in-page MCP servers (webmcp.dev), browser support, transport bridges, and open spec questions. Use when comparing WebMCP packages, deciding build vs buy, or scoping a from-scratch agent-native web library.
---

# WebMCP Ecosystem Research

## Goal

Produce a **landscape brief** that separates three often-conflated things and states what is stable vs experimental.

## Step 1: Name the three layers (do this first)

| Layer | What it is | Primary sources |
|-------|------------|-----------------|
| **L1 — W3C WebMCP** | Browser API: `document.modelContext.registerTool()` | https://github.com/webmachinelearning/webmcp, https://webmachinelearning.github.io/webmcp/, Chrome WebMCP docs |
| **L2 — React hooks** | App integration: `WebMCPProvider`, `useMcpTool` | https://github.com/agentcathq/webmcp-react, npm `webmcp-react` |
| **L3 — Legacy in-page MCP** | Full MCP server in tab (tools + prompts + resources + sampling + widget) | https://webmcp.dev, `@jason.today/webmcp` |

**Rule:** Never compare L2 to L3 as "missing features" without noting L1 scope. L3 is a different product category.

## Step 2: Document L1 (the standard)

Read the W3C explainer README and capture:

1. **Core API surface today**
   - `registerTool(tool, { signal, exposedTo })` — Promise, AbortSignal-only unregister
   - `getTools({ fromOrigins })`, `executeTool(tool, args, { signal })`
   - `toolchange` event on `document.modelContext`
   - Permissions Policy: `tools`, `allow="tools"` on iframes
   - Origin isolation requirement

2. **What the spec explicitly does NOT cover yet** (open questions)
   - User confirmation / elicitation (ModelContextClient removed from early drafts)
   - Streaming I/O, progress reporting, multimodal
   - Skills / multi-step journeys
   - Service worker / background tools
   - Declarative forms (`toolname`, `tooldescription`) — in progress
   - Output schema standardization

3. **Browser support**
   - Chrome Early Preview status
   - Polyfill necessity for other browsers
   - Native vs polyfill behavioral drift (e.g. aborted signal on registerTool)

## Step 3: Document L2 (hook library under review)

For `webmcp-react` (or competitor):

| Field | Capture |
|-------|---------|
| Version / maturity | e.g. 0.2.0 experimental |
| Package size / deps | runtime deps, peer deps |
| Public API | exports, hooks, components |
| Polyfill | what it implements vs native |
| Desktop client path | extension + stdio MCP server? |
| Examples / playground | what they demo |
| Breaking change velocity | changelog |

Fetch: README, docs/api.md, AGENTS.md, CHANGELOG, package.json, extension README.

## Step 4: Document L3 (legacy in-page MCP)

For webmcp.dev-style projects:

- Widget UX (token paste, connect flow)
- MCP primitives beyond tools (prompts, resources, sampling)
- Transport: npx stdio bridge vs browser-native
- Security model (token auth, user in loop for sampling)

Note: **Not spec-aligned.** Useful for transport/UX ideas, not as the API to fork.

## Step 5: Map adoption paths

How does a desktop agent (Cursor, Claude Code) reach page tools today?

```
Page registers tools on document.modelContext
  → testing shim / native discovery
  → Chrome extension polls navigator.modelContextTesting
  → local MCP server (stdio)
  → Desktop MCP client
```

Document friction: extension install, port 12315, tab namespacing `tab-{id}:tool`, reload/navigation tool loss.

## Step 6: Research output template

Deliver this structure:

```markdown
## Landscape summary (1 paragraph)

## Three layers table

## What the W3C spec guarantees (stable-ish)

## What is explicitly unfinished in the spec

## What [package] adds on top

## How desktop agents connect today (steps + friction)

## Competitor / adjacent projects

## Implications for build vs extend vs buy
```

## Sources checklist

- [ ] webmachinelearning/webmcp README + declarative-api-explainer.md
- [ ] Chrome developer docs on WebMCP
- [ ] agentcathq/webmcp-react README + api.md + CHANGELOG + extension README
- [ ] webmcp.dev (legacy MCP-in-browser)
- [ ] npm package metadata (version, deps, weekly downloads if available)

## Anti-patterns

- Calling webmcp-react "WebMCP" without disambiguating from the W3C spec
- Listing prompts/resources as gaps without noting they're L3 / not in L1
- Assuming Chrome extension bridge is permanent (authors intend to deprecate when native bridge exists)
