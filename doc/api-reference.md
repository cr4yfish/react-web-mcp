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

Subscribes to ModelContext events for the component lifetime.

```tsx
useWebMCPEvent("toolactivated", () => { /* e.g. scroll a filled form into view */ });
useWebMCPEvent("toolcanceled", () => { /* agent abandoned an in-flight invocation */ });
useWebMCPEvent("toolchange", () => { /* the page's toolset changed */ });
```

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

- Without `autoSubmit`, the agent fills the form and the **user** reviews and
  submits — the human-in-the-loop default. Style that state with the
  `:tool-form-active` / `:tool-submit-active` CSS pseudo-classes.
- `onAgentSubmit(formData, event)` handles agent-invoked submissions without
  navigation: the default action is prevented and your return value is piped
  back to the agent via `SubmitEvent.respondWith()`. User submissions behave as
  a normal form.
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
| `useWebMCPEvent(name, handler)` | hook | Subscribe to `toolchange` / `toolactivated` / `toolcanceled` |
| `ToolForm` | component | `<form>` registered as a declarative tool, with `onAgentSubmit` |
| `registerTool(tool, options?)` | function | Framework-agnostic registration; returns `unregister()` |
| `provideContext(tools)` | function | Replace the page's whole toolset; returns `unregister()` |
| `getModelContext()` / `isWebMCPSupported()` | function | Feature detection (SSR-safe) |
| `isWebMCPTestingSupported()` | function | Detect the testing flag / Tool Inspector API |
| `extractFormSchema(form)` / `applyArgsToForm(form, args)` | function | DOM schema synthesis & agent form filling |
| `textResult(text, isError?)` / `jsonResult(value, maxLength?)` | function | Build MCP-shaped responses |
| `validateToolInput(args, schema)` | function | Standalone input-schema validation; returns problem list |
| `toolFormAttrs(...)` / `toolParamAttrs(...)` | function | Declarative attribute bags |
| `WebMCPTool`, `ToolResponse`, `ToolAnnotations`, `JSONSchema`, `ModelContext`, … | types | Full typings + global augmentation |
