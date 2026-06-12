---
name: webmcp
description: Deep reference for the WebMCP web standard (Web Model Context Protocol) and the react-web-mcp package. Use when implementing, reviewing, or debugging WebMCP tools — imperative API (document.modelContext / navigator.modelContext, registerTool, provideContext), declarative API (toolname/tooldescription form attributes, respondWith), tool schemas, annotations, security, best practices, evals, browser support, or when integrating react-web-mcp into a React/Next.js app.
---

# WebMCP — complete reference

WebMCP ("Web Model Context Protocol") is a proposed web standard that lets a web **page** expose client-side functionality as structured *tools* that AI agents can discover and invoke — agents built into the browser (Gemini in Chrome, Copilot in Edge), running in extensions, or embedded by the page author in iframes. Think of it as an in-page MCP server: same vocabulary as backend MCP (tools, JSON Schema inputs, content responses) but web-native (origins, Permissions Policy, DOM, tab lifecycle).

- Spec: https://webmachinelearning.github.io/webmcp/ · Explainer: https://github.com/webmachinelearning/webmcp
- Chrome docs: https://developer.chrome.com/docs/ai/webmcp (imperative-api, declarative-api, best-practices, secure-tools, evals, compare-mcp subpages)
- Official demos/tools: https://github.com/GoogleChromeLabs/webmcp-tools
- Incubated by Microsoft + Google in the W3C Web Machine Learning CG; first published Aug 2025.

## Why it exists

Without WebMCP, agents actuate pages via screenshots, accessibility-tree scraping, and simulated clicks — slow, brittle, multi-step. Backend MCP integrations avoid that but bypass the page entirely (UI disintermediation, replicated auth/state, separate server to build). WebMCP keeps the **user, page, and agent in one shared context**: tools run the page's existing client-side code, the UI updates live, the user keeps visibility and control (human-in-the-loop is an explicit design goal; fully autonomous/headless operation is an explicit non-goal). Agents can still fall back to ordinary UI actuation when no suitable tool exists.

## Availability & enabling (as of mid-2026)

| Channel | Status |
| --- | --- |
| Chrome 146+ | `chrome://flags/#enable-webmcp-testing` (local dev) |
| Chrome 149+ | Origin trial — register, then `<meta http-equiv="origin-trial" content="…">` or `Origin-Trial` header |
| Edge 147+ | Native support |
| Other browsers | Not available — feature-detect and degrade |

API surface history: early Chrome previews shipped `navigator.modelContext`; the spec settled on **`document.modelContext`** and Chrome 150 deprecated the navigator alias. Always resolve as `document.modelContext || navigator.modelContext`.

Feature detection:

```js
const ctx = document.modelContext ?? navigator.modelContext;
if (ctx) { /* register tools */ }
```

## Imperative API

### registerTool(tool, options?)

```js
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text content of the todo item" }
    },
    required: ["text"]
  },
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  async execute({ text }) {
    await addTodoItemToCollection(text);          // reuse existing app logic
    return { content: [{ type: "text", text: `Added "${text}".` }] };
  }
}, { signal: controller.signal });

// later: controller.abort() unregisters the tool
```

Tool descriptor fields:

- `name` (required): unique per page, descriptive, kebab/camelCase (`search-flights`, `listFlights`).
- `description` (required): natural language; the agent's only guide for *when* to call it.
- `inputSchema`: JSON Schema object (same vocabulary as backend MCP). Omit or `{}` for no-arg tools. Treat as documentation, not enforcement — validate inside `execute`.
- `outputSchema` (Chrome supports it; spec issue #9): JSON Schema for the structured return value. Official demos wrap results as `{ result: … }`. When present, return the raw structured value.
- `annotations`: hints, not security — `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `untrustedContentHint` (output contains third-party/user content; agents must treat it as untrusted).
- `execute(args)`: sync or async. Return either an MCP `CallToolResult` (`{ content: [{ type: "text", text }], isError? }`) or a plain value/object (implementations stringify). Prefer returning readable error responses over throwing.

Registration options:

- `signal`: `AbortSignal`; aborting unregisters (the canonical unregistration mechanism).
- `exposedTo`: array of secure origins (for author-provided agents in cross-origin iframes). Default exposure: the page itself, same-origin frames, and the built-in browser agent only.

### Other ModelContext members

- `provideContext({ tools: [...] })` — replaces the page's **entire** registered toolset in one call (use on auth/app-state changes). `registerTool` adds incrementally on top.
- `unregisterTool(name)` / `clearContext()` — present in some Chrome versions; feature-detect before calling.
- Events fired at the ModelContext object: `toolchange` (toolset changed), `toolactivated` (a tool ran / a declarative form was filled awaiting review), `toolcanceled` (agent canceled an in-flight call).
- Registration rejects with `NotAllowedError` DOMException when Permissions Policy disallows it.

### Permissions Policy / iframes

WebMCP is enabled in top-level windows + same-origin iframes by default. Delegate to cross-origin iframes with `<iframe allow="tools">`; disable site-wide with the `Permissions-Policy: tools=()` header. `exposedTo` additionally gates which embedded/embedding origins can see a specific tool.

## Declarative API

HTML forms become tools via attributes — no JS required:

```html
<form
  toolname="book_table"
  tooldescription="Books a table. Accepts customer details, timing, and seating preferences."
>
  <input type="text" name="name" required minlength="2"
         toolparamdescription="Customer's full name (min 2 chars)">
  <select name="seating" toolparamdescription="Seating preference">
    <option value="inside">Inside</option>
    <option value="terrace">Terrace</option>
  </select>
  <button type="submit">Book</button>
</form>
```

- `toolname` + `tooldescription` on `<form>` are **both required** — missing either prevents registration.
- `toolautosubmit` (boolean attribute): lets the agent submit the form itself. **Absent by default**: the browser fills the form, focuses the submit button, and the *user* reviews and submits — the human-in-the-loop safety default. Use autosubmit only for low-stakes actions.
- The browser **synthesizes the input schema** from form controls: each control's `name` becomes a property; `required` → required; `toolparamdescription` → property description; control types/constraints (`type=number`, `min`, `max`, `step`, `<select>` options…) shape the property schema (exact algorithm still being specced; Chromium ships a loose version).
- Registration/teardown is automatic as annotated forms enter/leave the DOM or attributes change. Form reset or tool-attribute changes cancel in-flight invocations.

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

If the form *does* navigate, the proposal is to use the first `<script type="application/ld+json">` on the target page as the tool response (cross-document response handling is still under discussion, spec issue #135).

### CSS pseudo-classes

- `:tool-form-active` — matches a form whose declarative tool is "running" (filled by the agent, awaiting user review/submission).
- `:tool-submit-active` — matches that form's submit button.

Use them to visually highlight agent-filled forms for review.

## Security model & secure-tools guidance

Threats to design for:

1. **Prompt injection both ways.** Tool *outputs* are untrusted data to the agent (Chrome treats WebMCP outputs as strictly untrusted; outputs are base64-encoded in transport). Malicious *pages* can hide instructions in tool names/descriptions/params ("malicious manifests") or in responses ("contaminated outputs") — as a tool author, never echo third-party/user-generated content without marking `untrustedContentHint: true`.
2. **The agent is an untrusted client.** Assume any registered tool can be called at any time with arbitrary arguments. Validate every input server-side as usual; client-side schemas are hints. Don't expose tools that bypass authorization the UI would enforce.
3. **Exposure scope.** Default: page + same-origin frames + built-in browser agent. `exposedTo: [origins]` widens to specific secure origins — only ones you'd directly share that data with (even read-only tools leak user data). Disable via Permissions Policy where unneeded.
4. **Human-in-the-loop for consequential actions.** Prefer declarative forms without `toolautosubmit`, or imperative tools that stage changes for user confirmation (e.g. navigate to a checkout rather than charging). Mark `destructiveHint` honestly; browsers/agents may use hints to require confirmation.
5. **Secrets.** Never embed credentials/PII in tool descriptions or schemas; they're shipped to the agent platform.

## Best practices (tool design)

- **Granularity**: one tool = one user-meaningful task (`search-flights`, `apply-filters`, `list-results`) — not one mega-tool, not one tool per DOM node. Expose the page's *current* capabilities; register/unregister as state changes (login, route, selection).
- **Naming/descriptions**: action-oriented names; descriptions that state purpose, when to use it, inputs, and what it returns. Succinct — verbose descriptions and outputs can trip agent guardrails and waste context.
- **Schemas**: describe every property; use `enum`/`min`/`max`/`required` precisely; prefer flat argument objects.
- **Outputs**: compact, structured (JSON), relevant — not HTML dumps. Cap length. For long operations consider returning staged status.
- **Errors**: return `{ isError: true, content: [...] }` with an actionable message ("No results for that date — try a range") so the agent can self-correct; don't throw opaque exceptions.
- **Lifecycle**: register early (agents may query on page load); clean up with `AbortSignal` on SPA route changes/unmounts; `provideContext` to swap toolsets wholesale.
- **Asynchronous UI**: if a tool triggers UI work that completes later, resolve `execute`'s promise only when the action truly finished (the official React demo bridges this with custom events + request IDs and a hard timeout).

## Testing, debugging, evals

- **Chrome DevTools → WebMCP panel** (`developer.chrome.com/docs/devtools/application/webmcp`): live list of registered tools + schemas, chronological invocation log, manual invocation, built-in Gemini integration to exercise tools with natural language, "Copy trace" for regression tracking.
- **Model Context Tool Inspector** (Chrome extension, github.com/beaufortfrancois/model-context-tool-inspector): verify exposure, visualize schemas.
- **WebMCP Evals CLI** (github.com/GoogleChromeLabs/webmcp-tools `evals-cli/`): define eval cases as `{ messages: [{role:"user", content:"…"}], expectedCall: [{ functionName, arguments }] }`; run against a static `schema.json` (`runevals`) or against the live page's tools via Puppeteer + Chrome Canary with the WebMCP flag (`webmcpevals`). Backends: Gemini (primary), Ollama/Vercel AI SDK (experimental). Generates HTML pass-rate reports. Iterate on names/descriptions/schemas until models reliably pick the right tool with the right args.
- **Unit tests**: mock the ModelContext (see `tests/mock-model-context.ts` in this repo) — an `EventTarget` with `registerTool` honoring `options.signal`.
- **Official demo corpus** for reference patterns: `demos/react-flightsearch` (imperative React + outputSchema), `demos/french-bistro` (declarative form), `demos/hotel-chain` & `demos/doors` (both styles), `demos/page-agent` (Gemini-driven meta-agent).

## WebMCP vs. backend MCP

| | Backend MCP | WebMCP |
| --- | --- | --- |
| Runs | Your server (stdio/HTTP, JSON-RPC) | The user's browser tab, page JS |
| Auth/state | Replicated server-side | The user's existing session, as-is |
| UI | Bypassed | Shared & live-updated; user can intervene |
| Reach | Works without a browser, background, headless | Page must be open; human-in-the-loop |
| Security posture | Tool logic never reaches the client | Tool logic is client-visible; browser mediates |
| Best for | Server actions, data APIs, automation | Interactive flows, anything keyed to UI state |

They compose: many products ship backend MCP for server operations *and* WebMCP for in-page interaction.

## Using react-web-mcp (this repo's package)

```tsx
import { useWebMCP, useWebMCPTool, useWebMCPEvent, ToolForm,
         toolFormAttrs, toolParamAttrs } from "@cr4yfish/react-web-mcp";
import { registerTool, provideContext } from "@cr4yfish/react-web-mcp/vanilla"; // React-free / RSC-safe
```

- `useWebMCPTool({ name, description, inputSchema?, outputSchema?, annotations?, exposedTo?, enabled?, execute })` — registers for the component lifetime; `execute` sees fresh closures without re-registration (ref-based); definition changes (deep-compared via JSON) re-register; `enabled:false` unregisters in place. Returns `{ isRegistered }`.
- `useWebMCPTools(tools, { enabled? })` — batch registration; tools are registered individually (composable across components), unlike `provideContext` which replaces the page's toolset.
- `useFormTool({ formRef, name, description, autoSubmit?, onToolCall?, annotations?, enabled? })` — derives the input schema from the **rendered DOM form** (`extractFormSchema`), so it works with MUI/AntD/shadcn/portals without adapters; on invocation fills controls via native setters + input/change events (`applyArgsToForm`, React-controlled-input compatible), then user-review (default) / `requestSubmit()` (`autoSubmit`) / custom `onToolCall`. Skips password/hidden/file inputs. Returns `{ isRegistered, refresh }` — call `refresh()` after dynamic field changes.
- `useWebMCP()` → `{ isSupported, modelContext }`, SSR/hydration-safe (false until mounted).
- `useWebMCPEvent("toolchange" | "toolactivated" | "toolcanceled", handler)`.
- `<ToolForm name description autoSubmit? onAgentSubmit?>` — declarative form wrapper; `onAgentSubmit(formData, event)` answers agent submissions via `respondWith` without navigation.
- Core (`/vanilla`): `getModelContext`, `isWebMCPSupported`, `isWebMCPTestingSupported` (detects `navigator.modelContextTesting` from the testing flag / Tool Inspector), `registerTool` (returns `unregister()`; wraps execute with normalization + error-to-`isError`; validates name/description/schema — throws in dev, console+no-op in prod), `provideContext`, `textResult`, `jsonResult` (truncates at 50k chars), `toolFormAttrs`, `toolParamAttrs`, `extractFormSchema`, `applyArgsToForm`.
- Everything is a no-op without browser support — safe to ship unconditionally.
- Next.js: main entry has `"use client"`; call hooks from client components. Add the origin-trial `<meta>` in the root layout for production.

Gotchas this package already handles — don't reintroduce them when writing app code:

- Registering inside render (must be effect-time), re-registering every render because of inline schema literals, stale closures in `execute`, unhandled `registerTool` promise rejections (`NotAllowedError`), SSR `document` access, and the `document.modelContext` vs `navigator.modelContext` split.
