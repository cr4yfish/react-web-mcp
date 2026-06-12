# AGENTS.md — @cr4yfish/react-web-mcp

If you are an AI coding agent working in a repo that depends on this package,
the documentation you need ships **inside the package** and is readable offline.
You do not need web access.

## Where the docs are

Relative to this package's root (i.e. `node_modules/@cr4yfish/react-web-mcp/`):

- `doc/index.md` — overview, a quick start, and the invariants worth knowing.
- `doc/api-reference.md` — every export (hooks, `ToolForm`, the `/vanilla` core,
  attribute helpers, types) with behavior notes. **Read this before writing code
  against the package.**
- `doc/webmcp-standard.md` — the WebMCP standard itself: imperative + declarative
  APIs, schemas, annotations, security model, best practices, browser support.
- `doc/llms.txt` — a one-read, machine-readable digest of the whole API surface.

## The one thing to remember

`@cr4yfish/react-web-mcp` is a zero-runtime-dependency React hooks/components
library for **WebMCP** (Web Model Context Protocol): it lets a web page expose
client-side functionality as tools that in-browser AI agents (Gemini in Chrome,
Copilot in Edge) can call. Every primitive is a safe no-op when the browser has
no WebMCP support, so it is safe to ship unconditionally. Import hooks/components
from `@cr4yfish/react-web-mcp` (has a `"use client"` directive) and the
React-free core from `@cr4yfish/react-web-mcp/vanilla`.

For the canonical, always-current docs see the
[README](https://github.com/cr4yfish/react-web-mcp#readme).
