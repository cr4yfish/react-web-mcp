# WebMCP — the standard, condensed

A self-contained reference for the **WebMCP** (Web Model Context Protocol) web
standard, so an agent can work offline. For how `@cr4yfish/react-web-mcp` wraps
this standard for React, see [api-reference.md](./api-reference.md).

WebMCP lets a web **page** expose client-side functionality as structured
*tools* that AI agents can discover and invoke — agents built into the browser
(Gemini in Chrome, Copilot in Edge), in extensions, or embedded by the page
author in iframes. Think of it as an in-page MCP server: the same vocabulary as
backend MCP (tools, JSON Schema inputs, content responses) but web-native
(origins, Permissions Policy, DOM, tab lifecycle).

- Spec: https://webmachinelearning.github.io/webmcp/ · Explainer: https://github.com/webmachinelearning/webmcp
- Chrome docs: https://developer.chrome.com/docs/ai/webmcp
- Official demos/tools: https://github.com/GoogleChromeLabs/webmcp-tools
- Incubated by Microsoft + Google in the W3C Web Machine Learning CG.

## Why it exists

Without WebMCP, agents actuate pages via screenshots, accessibility-tree
scraping, and simulated clicks — slow, brittle, multi-step. Backend MCP avoids
that but bypasses the page entirely (UI disintermediation, replicated
auth/state, a separate server to build). WebMCP keeps the **user, page, and
agent in one shared context**: tools run the page's existing client-side code,
the UI updates live, and the user keeps visibility and control. Human-in-the-loop
is an explicit design goal; fully autonomous/headless operation is an explicit
non-goal. Agents can still fall back to ordinary UI actuation when no suitable
tool exists.

## Availability & enabling (as of mid-2026)

| Channel | Status |
| --- | --- |
| Chrome 146+ | `chrome://flags/#enable-webmcp-testing` (local dev) |
| Chrome 149+ | Origin trial — register, then `<meta http-equiv="origin-trial" content="…">` or `Origin-Trial` header |
| Edge 147+ | Native support |
| Other browsers | Not available — feature-detect and degrade |

Early Chrome previews shipped `navigator.modelContext`; the spec settled on
**`document.modelContext`** and Chrome 150 deprecated the navigator alias.
Always resolve as `document.modelContext ?? navigator.modelContext`:

```js
const ctx = document.modelContext ?? navigator.modelContext;
if (ctx) { /* register tools */ }
```

## Imperative API

### `registerTool(tool, options?)`

```js
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string", description: "The text content of the todo item" } },
    required: ["text"],
  },
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  async execute({ text }) {
    await addTodoItemToCollection(text);            // reuse existing app logic
    return { content: [{ type: "text", text: `Added "${text}".` }] };
  },
}, { signal: controller.signal });

// later: controller.abort() unregisters the tool
```

Tool descriptor fields:

- `name` (required): unique per page, descriptive, kebab/camelCase.
- `description` (required): natural language; the agent's only guide for *when*
  to call it.
- `inputSchema`: JSON Schema object. Omit or `{}` for no-arg tools. Treat as
  documentation, not enforcement — validate inside `execute`.
- `outputSchema` (Chrome supports it): JSON Schema for the structured return
  value. When present, return the raw structured value rather than MCP content
  blocks.
- `annotations`: hints, not security — `title`, `readOnlyHint`,
  `destructiveHint`, `idempotentHint`, `openWorldHint`, `untrustedContentHint`
  (output contains third-party/user content; agents must treat it as untrusted).
- `execute(args)`: sync or async. Return an MCP `CallToolResult`
  (`{ content: [{ type: "text", text }], isError? }`) or a plain value/object
  (implementations stringify). Prefer returning readable error responses over
  throwing.

Registration options:

- `signal`: `AbortSignal`; aborting unregisters (the canonical mechanism).
- `exposedTo`: array of secure origins (for author-provided agents in
  cross-origin iframes). Default exposure: the page itself, same-origin frames,
  and the built-in browser agent only.

### Other ModelContext members

- `provideContext({ tools: [...] })` — replaces the page's **entire** registered
  toolset in one call (use on auth/app-state changes). `registerTool` adds
  incrementally on top.
- `unregisterTool(name)` / `clearContext()` — present in some Chrome versions;
  feature-detect before calling.
- Events fired at the ModelContext object: `toolchange` (toolset changed),
  `toolactivated` (a tool ran / a declarative form was filled awaiting review),
  `toolcanceled` (agent canceled an in-flight call).
- Registration rejects with a `NotAllowedError` DOMException when Permissions
  Policy disallows it.

### Permissions Policy / iframes

WebMCP is enabled in top-level windows + same-origin iframes by default.
Delegate to cross-origin iframes with `<iframe allow="tools">`; disable site-wide
with the `Permissions-Policy: tools=()` header. `exposedTo` additionally gates
which embedded/embedding origins can see a specific tool.

## Declarative API

HTML forms become tools via attributes — no JS required:

```html
<form toolname="book_table"
      tooldescription="Books a table. Accepts customer details, timing, and seating preferences.">
  <input type="text" name="name" required minlength="2"
         toolparamdescription="Customer's full name (min 2 chars)">
  <select name="seating" toolparamdescription="Seating preference">
    <option value="inside">Inside</option>
    <option value="terrace">Terrace</option>
  </select>
  <button type="submit">Book</button>
</form>
```

- `toolname` + `tooldescription` on `<form>` are **both required** — missing
  either prevents registration.
- `toolautosubmit` (boolean attribute): lets the agent submit the form itself.
  **Absent by default**: the browser fills the form, focuses the submit button,
  and the *user* reviews and submits — the human-in-the-loop safety default. Use
  autosubmit only for low-stakes actions.
- The browser **synthesizes the input schema** from form controls: each
  control's `name` becomes a property; `required` → required;
  `toolparamdescription` → property description; control types/constraints
  (`type=number`, `min`, `max`, `step`, `<select>` options…) shape the property
  schema.
- Registration/teardown is automatic as annotated forms enter/leave the DOM or
  attributes change. Form reset or tool-attribute changes cancel in-flight
  invocations.

### Returning a response without navigating

```js
form.addEventListener("submit", (e) => {
  if (e.agentInvoked) {                 // SubmitEvent.agentInvoked: agent vs. user
    e.preventDefault();                 // must precede respondWith
    e.respondWith((async () => {
      const result = await doBooking(new FormData(form));
      return { content: [{ type: "text", text: `Confirmed: ${result.code}` }] };
    })());
  }
});
```

### CSS pseudo-classes

- `:tool-form-active` — a form whose declarative tool is "running" (filled by the
  agent, awaiting user review/submission).
- `:tool-submit-active` — that form's submit button.

Use them to visually highlight agent-filled forms for review.

## Security model

1. **Prompt injection both ways.** Tool *outputs* are untrusted data to the
   agent. Malicious *pages* can hide instructions in tool names/descriptions/
   params or in responses — as a tool author, never echo third-party/user content
   without marking `untrustedContentHint: true`.
2. **The agent is an untrusted client.** Assume any registered tool can be called
   at any time with arbitrary arguments. Validate every input server-side as
   usual; client-side schemas are hints. Don't expose tools that bypass
   authorization the UI would enforce.
3. **Exposure scope.** Default: page + same-origin frames + built-in browser
   agent. `exposedTo: [origins]` widens to specific secure origins only — even
   read-only tools leak user data. Disable via Permissions Policy where
   unneeded.
4. **Human-in-the-loop for consequential actions.** Prefer declarative forms
   without `toolautosubmit`, or imperative tools that stage changes for user
   confirmation. Mark `destructiveHint` honestly; browsers/agents may use hints
   to require confirmation.
5. **Secrets.** Never embed credentials/PII in tool descriptions or schemas;
   they ship to the agent platform.

## Best practices (tool design)

- **Granularity**: one tool = one user-meaningful task (`search-flights`,
  `apply-filters`) — not one mega-tool, not one tool per DOM node. Register/
  unregister as state changes (login, route, selection).
- **Naming/descriptions**: action-oriented names; descriptions that state
  purpose, when to use it, inputs, and what it returns. Succinct — verbose
  descriptions waste context and can trip agent guardrails.
- **Schemas**: describe every property; use `enum`/`min`/`max`/`required`
  precisely; prefer flat argument objects.
- **Outputs**: compact, structured JSON, not HTML dumps. Cap length.
- **Errors**: return `{ isError: true, content: [...] }` with an actionable
  message ("No results for that date — try a range") so the agent can
  self-correct; don't throw opaque exceptions.
- **Lifecycle**: register early (agents may query on page load); clean up with
  `AbortSignal` on SPA route changes/unmounts; `provideContext` to swap toolsets
  wholesale.
- **Asynchronous UI**: if a tool triggers UI work that completes later, resolve
  `execute`'s promise only when the action truly finished.

## Framework integration gotchas

These apply whatever your framework — and are exactly what `react-web-mcp`
handles for you in React:

- **SSR safety**: never touch `document`/`navigator` at module scope; only inside
  lifecycle hooks/effects with existence checks.
- **Registration timing**: register from mount/effect lifecycle, not during
  render.
- **Re-registration churn**: inline schema object literals change identity every
  render; key registration on deep equality (e.g. `JSON.stringify`), and keep
  `execute` fresh via a ref instead of re-registering.
- **Stale closures**: an `execute` captured at registration time sees old state;
  route it through a ref or store accessor.
- **Cleanup**: tie registration to an `AbortController` aborted on unmount/route
  change, or the tool outlives its UI.
- **Unhandled rejections**: `registerTool` can reject (`NotAllowedError` under
  Permissions Policy) — catch it. Exceptions in `execute` should become
  `{ isError: true }` responses.
- **The API split**: resolve `document.modelContext` first, fall back to
  `navigator.modelContext`; feature-detect optional members.

## Testing, debugging, evals

- **Chrome DevTools → WebMCP panel**: live list of registered tools + schemas,
  chronological invocation log, manual invocation, built-in Gemini integration,
  "Copy trace" for regression tracking.
- **Model Context Tool Inspector** (Chrome extension): verify exposure,
  visualize schemas.
- **WebMCP Evals CLI** (`GoogleChromeLabs/webmcp-tools` `evals-cli/`): define
  eval cases (`{ messages, expectedCall }`), run against a static `schema.json`
  or the live page via Puppeteer + Chrome Canary; iterate on names/descriptions/
  schemas until models reliably pick the right tool with the right args.
- **Unit tests**: mock the ModelContext — an `EventTarget` exposing
  `registerTool` that honors `options.signal` for unregistration (see
  `tests/mock-model-context.ts` in this repo).

## WebMCP vs. backend MCP

| | Backend MCP | WebMCP |
| --- | --- | --- |
| Runs | Your server (stdio/HTTP, JSON-RPC) | The user's browser tab, page JS |
| Auth/state | Replicated server-side | The user's existing session, as-is |
| UI | Bypassed | Shared & live-updated; user can intervene |
| Reach | Works headless/background | Page must be open; human-in-the-loop |
| Security posture | Tool logic never reaches the client | Tool logic is client-visible; browser mediates |
| Best for | Server actions, data APIs, automation | Interactive flows, anything keyed to UI state |

They compose: many products ship backend MCP for server operations *and* WebMCP
for in-page interaction.
