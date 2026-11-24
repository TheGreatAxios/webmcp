# @thegreataxios/webmcp-elements

Framework-agnostic Web Components for the [W3C WebMCP](https://github.com/webmachinelearning/webmcp) API — works in plain HTML, Lit, Astro, htmx, or any framework.

## Install

```bash
bun add @thegreataxios/webmcp-elements @thegreataxios/webmcp-core
```

## Quick Start

```html
<webmcp-provider>
  <webmcp-tool
    id="search-tool"
    name="search_catalog"
    title="Search Catalog"
    description="Search products by keyword"
    read-only
  >
    <script type="application/json" slot="input-schema">
      {"type":"object","properties":{"q":{"type":"string"}},"required":["q"]}
    </script>
  </webmcp-tool>
</webmcp-provider>

<script type="module">
  import { registerWebMCPElements } from "@thegreataxios/webmcp-elements";
  registerWebMCPElements();

  document.getElementById("search-tool").addEventListener("webmcp-execute", (e) => {
    e.detail.respondWith({ query: e.detail.args.q, results: [] });
  });
</script>
```

## Elements

| Element | Attributes / Events |
|---|---|
| `<webmcp-provider>` | `bridge-url`, `bridge-token`; emits `webmcp-ready`, `webmcp-bridge-status` |
| `<webmcp-tool>` | `name`, `title`, `description`, `read-only`, `untrusted-content`, `consequential`, `debugging`, `exposed-to`; `.execute` property or `webmcp-execute` event |
| `<webmcp-journey>` | `name`, `tools` (CSV), `active`, `description` |

## License

MIT
