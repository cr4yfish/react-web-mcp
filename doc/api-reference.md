# react-web-mcp — API reference

Every public export of `@cr4yfish/react-web-mcp`, with the behavior a coding
agent needs to use it correctly. For the WebMCP standard itself (schemas,
annotations, security, browser support) see [webmcp-standard.md](./webmcp-standard.md).

## Entry points

```ts
// React hooks + components (ships a "use client" directive — call from client components)
import {
  useWebMCPTool, useWebMCPTools, useFormTool, useWebMCP, useWebMCPEvent,
  ToolForm, toolFormAttrs, toolParamAttrs,
} from "@cr4yfish/react-web-mcp";

// Framework-free core (safe in React Server Components and plain scripts — no "use client")
import {
  registerTool, provideContext, getModelContext,
  isWebMCPSupported, isWebMCPTestingSupported,
  textResult, jsonResult, extractFormSchema, applyArgsToForm,
} from "@cr4yfish/react-web-mcp/vanilla";
```

Both entry points are no-ops when the browser has no WebMCP support, so they are
safe to ship unconditionally. Requires React 18+. Works in Vite, CRA, Remix, and
Next.js (App Router and Pages Router).

## Hooks

### `useWebMCPTool(options) → { isRegistered }`

Registers a single imperative tool for the component's lifetime.

```tsx
const { isRegistered } = useWebMCPTool({
  name: "search-products",
  description:
    "Searches the product catalog and updates the visible result list. Returns matching products as JSON.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search query" },
      maxPrice: { type: "number", description: "Optional price ceiling in EUR" },
    },
    required: ["query"],
  },
  annotations: { readOnlyHint: true },
  execute: async ({ query, maxPrice }) => {
    const products = await searchProducts(query, { maxPrice });
    setResults(products);
    return products; // objects are JSON-stringified (and length-capped) for the agent
  },
});
```

Options: `name` (required), `description` (required), `inputSchema?`,
`outputSchema?`, `annotations?`, `exposedTo?`, `enabled?`, `validateInput?`,
`execute` (required).

Behavior:

- Registered while mounted, unregistered on unmount (via `AbortController`).
- Re-registers **only** when the definition changes (name, description, schemas,
  annotations, `exposedTo`, `enabled`) — keyed on a `JSON.stringify` of the
  definition, so inline `inputSchema` object literals are fine.
- `execute` is held in a ref: it always sees fresh props/state and changing its
  identity never re-registers the tool (no stale-closure trap, no churn).
- `enabled: false` unregisters in place without unmounting (e.g. tie tools to
  auth state).
- Return values are normalized: strings → text content, objects → JSON text
  (truncated at 50,000 chars by default), `ToolResponse` objects pass through,
  thrown errors become `{ isError: true }` responses the agent can read and
  recover from.
- Incoming arguments are validated against `inputSchema` before `execute` runs
  (`validateToolInput`): schema-violating calls are answered with a readable
  `{ isError: true }` response and never reach your code. Checked keywords:
  `type`, `required`, `properties` (recursive), `additionalProperties: false`,
  `enum`, `const`, `minLength`/`maxLength`, `pattern`, `minimum`/`maximum`
  (incl. exclusive), `minItems`/`maxItems`, single-schema `items`. Nodes using
  `$ref`/`anyOf`/`oneOf`/`allOf`/`not`/`if` are skipped rather than guessed at.
  Opt out per tool with `validateInput: false`.
- Declaring an `outputSchema` disables normalization — your raw return value is
  passed through for the browser to validate.

### `useWebMCPTools(tools, options?) → { isRegistered }`

Registers a **batch** of tools, each individually (not via `provideContext`), so
multiple components can own batches without clobbering each other.

```tsx
useWebMCPTools([
  { name: "get-cart", description: "…", annotations: { readOnlyHint: true }, execute: () => cart },
  { name: "add-to-cart", description: "…", inputSchema, execute: addToCart },
]);
```

`options.enabled?: boolean` toggles the whole batch.

### `useFormTool(options) → { isRegistered, refresh }`

Registers a tool whose input schema is derived from a **rendered `<form>`
element**, not a hand-written schema. Because the schema comes from the DOM, it
works with any UI library (MUI, Ant Design, shadcn/ui), portals included, with
no per-library adapters — useful when components don't forward the declarative
`tool*` attributes to the DOM.

```tsx
const formRef = useRef<HTMLFormElement>(null);

useFormTool({
  formRef,
  name: "fill-checkout",
  description: "Fills out the checkout form with shipping details.",
  // autoSubmit: false (default) → agent fills, user reviews & submits
});

return (
  <form ref={formRef}>
    <TextField name="street" label="Street" required />
    <Select name="country" label="Country">…</Select>
    <Button type="submit">Order</Button>
  </form>
);
```

Options: `formRef` (required), `name` (required), `description` (required),
`autoSubmit?`, `onToolCall?(args, form)`, `annotations?`, `enabled?`.

- Schema source (`extractFormSchema`): control `name`s become properties; types
  map (`number` → number, `checkbox` → boolean, radio groups & `<select>` →
  enums); `required`, `min`/`max`/`maxLength`/`pattern` become constraints;
  descriptions come from `toolparamdescription` / `aria-label` / `<label for>` /
  `placeholder`. **Password, hidden, and file inputs are never exposed.**
- On invocation (`applyArgsToForm`): fields are filled via native value setters +
  `input`/`change` events so controlled React inputs update correctly. Then:
  user review (default), `autoSubmit: true` (`requestSubmit()`), or your own
  `onToolCall(args, form)`.
- Dynamic forms: call the returned `refresh()` after fields change.

### `useWebMCP() → { isSupported, modelContext }`

Feature detection for use in render. SSR-safe: returns `isSupported: false` on
the server and during hydration, the real value after mount.

```tsx
const { isSupported } = useWebMCP();
if (!isSupported) return null;
```

### `useWebMCPEvent(name, handler)`

Subscribes to WebMCP lifecycle events for the component lifetime.

```tsx
useWebMCPEvent("toolactivated", (e) => { /* e.toolName: scroll that form into view */ });
useWebMCPEvent("toolcanceled", () => { /* agent abandoned an in-flight invocation */ });
useWebMCPEvent("toolchange", () => { /* the page's toolset changed */ });
```

Chromium dispatches `toolactivated` and the cancel event at the **window**
(only `toolchange` fires at the ModelContext object) and names the cancel
event `toolcancel`. The hook listens on both targets and both spellings,
deduped per event, so handlers fire in every implementation. The event's
`toolName` property (when the browser provides it) names the tool concerned.
Framework-agnostic equivalent: `addWebMCPEventListener(name, handler) →
unsubscribe()`, also exported from `/vanilla`.

## Components

### `<ToolForm name description autoSubmit? onAgentSubmit? … >`

Renders a regular `<form>` carrying the declarative WebMCP attributes
(`toolname`, `tooldescription`, optional `toolautosubmit`); the **browser**
synthesizes the input schema from the form controls.

```tsx
<ToolForm
  name="book-table"
  description="Books a table at the restaurant. Asks for party size and a date."
  onAgentSubmit={async (data) => {
    const c = await bookTable({ partySize: Number(data.get("partySize")), date: String(data.get("date")) });
    return `Booked! Confirmation code: ${c.code}`;
  }}
>
  <input type="number" name="partySize" min={1} max={12} required {...toolParamAttrs("Number of guests (1-12)")} />
  <input type="date" name="date" required {...toolParamAttrs("Reservation date")} />
  <button type="submit">Book</button>
</ToolForm>
```

- **`autoSubmit` defaults to `true`** (the agent submits the form itself).
  This deliberately flips the platform's human-in-the-loop default: review
  mode keeps the invocation pending until the user submits, Chromium tracks
  only one pending invocation per form, and a re-invoke drops the previous
  reply and closes the page's WebMCP channel (every tool dies until reload).
  Opt into review mode per form with `autoSubmit={false}` for consequential
  actions, and keep `pendingTimeoutMs`/`indicators` on when you do.
- `onAgentSubmit(formData, event)` handles agent-invoked submissions without
  navigation: the default action is prevented and your return value is piped
  back to the agent via `SubmitEvent.respondWith()`. User submissions behave as
  a normal form.
- `indicators?: boolean` — opt-in visual highlight of the agent-filled /
  awaiting-review state. Injects a shared stylesheet (once per page) keyed on
  the native `:tool-form-active` / `:tool-submit-active` pseudo-classes plus a
  `data-webmcp-active="true"` attribute fallback maintained by the component.
  Customize via the `--webmcp-indicator-color` CSS custom property, or style
  the selectors yourself (`WEBMCP_INDICATOR_CSS` / `injectWebMCPIndicatorStyles()`
  are exported).
- `pendingTimeoutMs?: number` (default `120000`, `0` disables) — stale-invocation
  watchdog. Chromium keeps **one** pending invocation per declarative form; a
  re-invoke on top of a stale one silently drops the older reply callback and
  can close the page's WebMCP channel, disabling every tool until reload. When
  an invocation stays unanswered past the timeout, the form is `reset()` — the
  sanctioned page-side cancel: the agent receives a proper "cancelled" error
  and the channel stays healthy.
- `onPendingChange?: (pending: boolean) => void` — observe the pending state
  (true from agent fill until answered/cancelled/reset).
- `reinvokeGuard?: boolean` (default `true`) — automatic protection against
  the re-invoke channel kill: a re-invocation's form fill dispatches `input`
  events before the browser overwrites the old reply slot; the guard detects
  the programmatic fill (non-user `input` event on an unfocused control while
  a review is pending), snapshots all control values, `reset()`s the form so
  the OLD invocation is answered with a proper "cancelled" error, restores
  the values, and lets the new invocation proceed. Emits
  `invocation-reinvoked` (warn). Caveat: a `reset`-event listener calling
  `preventDefault()` defeats it; a misfire (e.g. browser autofill during a
  pending review) costs only the pending invocation — values are preserved.
- `resetAfterAgentSubmit?: boolean` — `reset()` the form one tick after an
  agent submission was answered (deferred so it cannot race the browser's
  response delivery).
- Diagnostics: overlapping invocations emit an `invocation-overlap` **error**
  diagnostic; an agent submit without `respondWith()` support emits
  `respondwith-missing`; a missing `onAgentSubmit` emits
  `agent-submit-navigation` (the form then navigates and the response is taken
  from the target page's ld+json). See `onWebMCPDiagnostic`.
- In browsers without WebMCP it is just a normal form.

## Declarative attribute helpers

For your own `<form>`/controls instead of `ToolForm` (TypeScript JSX types for
`toolname` etc. are included):

```tsx
<form {...toolFormAttrs({ name: "search", description: "Search the site", autoSubmit: true })}>
  <input name="q" required {...toolParamAttrs("The search query")} />
</form>
```

- `toolFormAttrs({ name, description, autoSubmit? })` → `{ toolname, tooldescription, toolautosubmit? }`.
- `toolParamAttrs(description)` → `{ toolparamdescription }`.

## Framework-agnostic core (`/vanilla`)

Importable from any framework or plain scripts; no React import, no `"use client"`.

- `registerTool(tool, { signal?, exposedTo? }) → unregister()` — wraps `execute`
  with input validation (see `useWebMCPTool` above; opt out with
  `validateInput: false` on the tool), result normalization, and
  error-to-`isError`; validates name/description/schema (throws in development,
  console-warns + no-ops in production). Returns an `unregister()` function.
- `provideContext(tools) → unregister()` — replaces the page's **entire**
  toolset in one call (e.g. after login).
- `getModelContext()` — resolves `document.modelContext` first, then
  `navigator.modelContext`; returns `undefined` when unsupported / during SSR.
- `isWebMCPSupported()` — boolean feature detection (SSR-safe).
- `isWebMCPTestingSupported()` — detects the `#enable-webmcp-testing` flag /
  Model Context Tool Inspector API.
- `textResult(text, isError?)` / `jsonResult(value, maxLength?)` — build
  MCP-shaped `CallToolResult` responses (`jsonResult` truncates at 50,000 chars
  by default).
- `validateToolInput(args, schema) → string[]` — the standalone input
  validator: returns human-readable problems (empty when valid or when the
  schema isn't validatable). Used internally by `registerTool`; exported for
  custom flows.
- `extractFormSchema(form)` — form → JSON Schema (skips password/hidden/file).
- `applyArgsToForm(form, args)` — fill controls via native setters +
  `input`/`change` events (React-controlled-input compatible).
- `setWebMCPVerbose(on)` / `isWebMCPVerbose()` — verbose mode: info-level
  lifecycle logs (registrations, invocations, agent submissions, responses)
  reach the console with a `[webmcp]` prefix. Warnings/errors log regardless.
- `onWebMCPDiagnostic(listener) → unsubscribe()` — subscribe to every
  diagnostic the package emits (`{ level, code, message, toolName?, detail? }`),
  independent of verbose mode — ideal for an on-page debug log. Codes include
  `register`, `unregister`, `register-failed`, `execute`, `execute-error`,
  `invalid-arguments`, `result-truncated`, `agent-submit`, `agent-response`,
  `agent-response-error`, `respondwith-missing`, `agent-submit-navigation`,
  `invocation-pending`, `invocation-overlap`, `invocation-timeout`,
  `invocation-canceled`, `unsupported`.
- `addWebMCPEventListener(name, handler) → unsubscribe()` — lifecycle events on
  every implementation surface (window + ModelContext, `toolcancel` alias).
- `injectWebMCPIndicatorStyles() → release()` / `WEBMCP_INDICATOR_CSS` — the
  default visual-indicator stylesheet (refcounted injection).

## Exported types

`WebMCPTool`, `ToolResponse`, `ToolAnnotations`, `JSONSchema`, `ModelContext`,
and more — full typings including the `document.modelContext` /
`navigator.modelContext` global augmentation and the declarative JSX attribute
augmentation (`toolname`, `tooldescription`, `toolautosubmit`,
`toolparamdescription`).

## Export summary

| Export | Kind | Purpose |
| --- | --- | --- |
| `useWebMCPTool(options)` | hook | Register one imperative tool for the component lifetime |
| `useWebMCPTools(tools, options?)` | hook | Register a batch of tools (individually, composable) |
| `useFormTool(options)` | hook | Tool with a schema derived from a rendered `<form>` |
| `useWebMCP()` | hook | `{ isSupported, modelContext }` |
| `useWebMCPEvent(name, handler)` | hook | Subscribe to `toolchange` / `toolactivated` / `toolcanceled` (window + ModelContext, `toolcancel` alias) |
| `ToolForm` | component | Declarative form tool: `onAgentSubmit`, `indicators`, `pendingTimeoutMs`, `onPendingChange`, `resetAfterAgentSubmit` |
| `setWebMCPVerbose(on)` / `isWebMCPVerbose()` | function | Verbose lifecycle logging |
| `onWebMCPDiagnostic(listener)` | function | Subscribe to all package diagnostics |
| `addWebMCPEventListener(name, handler)` | function | Framework-agnostic lifecycle event subscription |
| `injectWebMCPIndicatorStyles()` / `WEBMCP_INDICATOR_CSS` | function/const | Visual indicators for agent-filled forms |
| `registerTool(tool, options?)` | function | Framework-agnostic registration; returns `unregister()` |
| `provideContext(tools)` | function | Replace the page's whole toolset; returns `unregister()` |
| `getModelContext()` / `isWebMCPSupported()` | function | Feature detection (SSR-safe) |
| `isWebMCPTestingSupported()` | function | Detect the testing flag / Tool Inspector API |
| `extractFormSchema(form)` / `applyArgsToForm(form, args)` | function | DOM schema synthesis & agent form filling |
| `textResult(text, isError?)` / `jsonResult(value, maxLength?)` | function | Build MCP-shaped responses |
| `validateToolInput(args, schema)` | function | Standalone input-schema validation; returns problem list |
| `toolFormAttrs(...)` / `toolParamAttrs(...)` | function | Declarative attribute bags |
| `WebMCPTool`, `ToolResponse`, `ToolAnnotations`, `JSONSchema`, `ModelContext`, … | types | Full typings + global augmentation |
