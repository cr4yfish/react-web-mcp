# react-web-mcp — offline docs for coding agents

You are reading the documentation that ships **inside** the
`@cr4yfish/react-web-mcp` package (under `node_modules/@cr4yfish/react-web-mcp/doc/`).
It is bundled on purpose so a coding agent working in a repo that depends on
this package can read it directly — no web access required.

`react-web-mcp` is a zero-runtime-dependency React hooks/components library for
**WebMCP** (Web Model Context Protocol): the proposed W3C web standard that lets
a web page expose its client-side functionality as structured *tools* that
in-browser AI agents (Gemini in Chrome, Copilot in Edge) can discover and call.
React 18+ peer dependency, SSR-safe, TypeScript, MIT.

## Where to look

- **[api-reference.md](./api-reference.md)** — every export of this package:
  hooks (`useWebMCPTool`, `useWebMCPTools`, `useFormTool`, `useWebMCP`,
  `useWebMCPEvent`), the `ToolForm` component, the framework-agnostic core
  (`registerTool`, `provideContext`, `textResult`, `jsonResult`, …), the
  declarative attribute helpers, and the exported types. Start here when
  writing code against the package.
- **[webmcp-standard.md](./webmcp-standard.md)** — the underlying WebMCP
  standard itself: imperative + declarative APIs, tool schemas, annotations,
  security model, best practices, browser support, and how WebMCP compares to
  backend MCP. Read this to understand *why* the package is shaped the way it
  is, or when working with WebMCP directly without React.
- **[llms.txt](./llms.txt)** — a single-file, machine-readable digest of the
  whole API surface and behavior guarantees. Good for stuffing into a context
  window in one read.

## 30-second quick start

```tsx
import { useWebMCPTool } from "@cr4yfish/react-web-mcp";

function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);

  useWebMCPTool({
    name: "add-todo",
    description: "Add a new item to the user's todo list",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "The todo text" } },
      required: ["text"],
    },
    // `execute` may close over props/state freely — it always sees the latest
    // values, and changing it never re-registers the tool.
    execute: ({ text }) => {
      setTodos((prev) => [...prev, text]);
      return `Added todo: "${text}"`;
    },
  });

  return <ul>{todos.map((t) => <li key={t}>{t}</li>)}</ul>;
}
```

While `<TodoList />` is mounted, any WebMCP-capable browser agent can add todos
through your own application logic. In browsers without WebMCP, every primitive
in this package is a safe no-op.

## Invariants worth remembering when generating code

- **SSR-safe**: nothing touches `document`/`navigator` at module scope. Hooks
  return `false`/no-op on the server and during hydration.
- **No re-registration churn**: `useWebMCPTool` keys its registration on a
  `JSON.stringify` of the definition; inline `inputSchema` object literals and a
  changing `execute` closure do **not** cause re-registration.
- **Errors become responses**: a thrown error inside `execute` is surfaced to
  the agent as an `{ isError: true }` text response, never an unhandled
  rejection.
- **`outputSchema` disables normalization**: declare one and your raw return
  value is passed through for the browser to validate, instead of being wrapped
  in MCP content blocks.
- **Both context surfaces**: the package resolves `document.modelContext`
  (Chrome 150+ spec surface) first, with the deprecated `navigator.modelContext`
  as fallback.
- **Never silent**: every failure or lifecycle anomaly is reported through the
  diagnostics stream (`onWebMCPDiagnostic`) and the console; enable
  `setWebMCPVerbose(true)` on debug pages for full lifecycle logging.
- **Declarative lifecycle safety**: `ToolForm` auto-submits by default
  (`autoSubmit={false}` opts into review mode), watches `toolactivated`, warns
  on overlapping invocations, and auto-cancels stale ones via `form.reset()`
  (`pendingTimeoutMs`) — because in current Chromium a pending review-mode
  invocation that gets re-invoked silently kills the page's WebMCP channel.

For the canonical, always-current copy of these docs see the
[README](https://github.com/cr4yfish/react-web-mcp#readme).
