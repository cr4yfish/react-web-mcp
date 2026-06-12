# react-web-mcp

React hooks and components for **WebMCP** — the emerging web standard that lets your web app expose its functionality as *tools* that in-browser AI agents (like Gemini in Chrome) can discover and call.

```tsx
import { useWebMCPTool } from "@cr4yfish/react-web-mcp";

function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);

  useWebMCPTool({
    name: "add-todo",
    description: "Add a new item to the user's todo list",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text of the todo item" },
      },
      required: ["text"],
    },
    execute: ({ text }) => {
      setTodos((prev) => [...prev, text]);
      return `Added todo: "${text}"`;
    },
  });

  return <ul>{todos.map((t) => <li key={t}>{t}</li>)}</ul>;
}
```

That's it. While `<TodoList />` is mounted, any WebMCP-capable agent in the browser can add todos through your own application logic — state updates, UI, and user all stay in sync.

> **Using an AI coding agent?** This package ships its full docs inside the
> tarball, at `node_modules/@cr4yfish/react-web-mcp/doc/` (plus an `AGENTS.md`
> pointer at the package root). Point your agent there to use the API and the
> WebMCP standard reference offline — start with `doc/index.md` or `doc/llms.txt`.

---

## What is WebMCP?

[WebMCP](https://github.com/webmachinelearning/webmcp) (Web Model Context Protocol) is a proposed web standard, incubated by Google and Microsoft in the W3C Web Machine Learning group, that turns a web *page* into an in-browser [MCP](https://modelcontextprotocol.io/)-style tool server.

Today, browser agents interact with pages the hard way: screenshots, accessibility-tree scraping, and simulated clicks. That's slow and brittle. WebMCP instead lets the page **describe its capabilities directly**:

- **Imperative API** — JavaScript registers tools on `document.modelContext` (early Chrome versions: `navigator.modelContext`, deprecated since Chrome 150). Each tool has a name, a natural-language description, a JSON Schema for its inputs, and an `execute` callback that runs your existing client-side code.
- **Declarative API** — plain HTML `<form>` elements become tools via the `toolname`, `tooldescription`, and `toolautosubmit` attributes; the browser synthesizes the input schema from the form's controls (`name`, `required`, `toolparamdescription`, …).

Unlike backend MCP servers, everything runs **client-side in the page**: tools share the user's existing session, auth, and UI state — no separate server, no replicated credentials, and the user watches (and can intervene in) everything the agent does. WebMCP complements backend MCP; it doesn't replace it.

**Browser support (as of mid-2026):** Chrome 146+ behind the `chrome://flags/#enable-webmcp-testing` flag, Chrome 149+ via [origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial), Edge 147+ natively. In every other browser the API simply doesn't exist — which is why this package makes every primitive a safe no-op when WebMCP is unavailable.

Further reading:

- [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) — [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api), [best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), [security](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [evals](https://developer.chrome.com/docs/ai/webmcp/evals), [WebMCP vs. MCP](https://developer.chrome.com/docs/ai/webmcp/compare-mcp)
- [Spec & explainer](https://github.com/webmachinelearning/webmcp)
- [Official demos & tooling](https://github.com/GoogleChromeLabs/webmcp-tools) (includes a React demo, an evals CLI, and a tool inspector)

## Why this package?

Using WebMCP from raw React means hand-rolling the same plumbing in every app:

- registering on mount / unregistering on unmount (with `AbortController`);
- **not** re-registering on every render while still letting `execute` see fresh state (the stale-closure trap);
- supporting both `document.modelContext` and the deprecated `navigator.modelContext`;
- staying SSR-safe in Next.js (no `navigator`/`document` on the server);
- normalizing return values and errors into the MCP `CallToolResult` shape;
- TypeScript types for an API that isn't in `lib.dom.d.ts` yet (including the declarative JSX attributes).

`react-web-mcp` packages all of that, with zero runtime dependencies.

## Installation

```bash
npm install @cr4yfish/react-web-mcp
# or
pnpm add @cr4yfish/react-web-mcp
```

Requires React 18+. Works in Vite, CRA, Remix, and Next.js (App Router and Pages Router — the main entry ships a `"use client"` directive).

## Usage

### Check for support: `useWebMCP`

```tsx
import { useWebMCP } from "@cr4yfish/react-web-mcp";

function AgentBadge() {
  const { isSupported } = useWebMCP();
  if (!isSupported) return null;
  return <span>🤖 This page is agent-ready</span>;
}
```

SSR-safe: returns `false` on the server and during hydration, the real value after mount.

### Register a tool: `useWebMCPTool`

```tsx
import { useWebMCPTool } from "@cr4yfish/react-web-mcp";

function ProductSearch({ category }: { category: string }) {
  const [results, setResults] = useState<Product[]>([]);

  const { isRegistered } = useWebMCPTool({
    name: "search-products",
    description:
      "Searches the product catalog and updates the visible result list. Returns the matching products as JSON.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search query" },
        maxPrice: { type: "number", description: "Optional price ceiling in EUR" },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
    // `execute` may close over props/state freely — it always sees the
    // latest values and changing it never re-registers the tool.
    execute: async ({ query, maxPrice }) => {
      const products = await searchProducts(query, { category, maxPrice });
      setResults(products);
      return products; // objects are JSON-stringified (and length-capped) for the agent
    },
  });

  return <ResultList items={results} highlight={isRegistered} />;
}
```

Behavior:

- Registered while mounted, unregistered on unmount.
- Re-registers **only** when the definition changes (name, description, schemas, annotations, `exposedTo`, `enabled`) — inline `inputSchema` object literals are fine.
- `enabled: false` unregisters without unmounting (e.g. tie tools to auth state).
- Return values are normalized: strings → text content, objects → JSON text (truncated at 50 000 chars by default), `ToolResponse` objects pass through, thrown errors become `isError` responses the agent can read and recover from.
- Incoming arguments are **validated against `inputSchema`** before `execute` runs — the agent is an untrusted client and browsers don't enforce the schema. Schema-violating calls are answered with a readable `isError` response (so the agent can self-correct) and never reach your code: no more hand-rolled `typeof` checks for types, `required`, `enum`, `min`/`maxLength`, ranges. Conservative by design (composition keywords like `anyOf`/`$ref` are skipped, unknown keywords ignored); opt out per tool with `validateInput: false`.
- Declare an `outputSchema` and your raw return value is passed through unnormalized for the browser to validate.

### Declarative forms: `ToolForm`

```tsx
import { ToolForm, toolParamAttrs } from "@cr4yfish/react-web-mcp";

function ReservationForm() {
  return (
    <ToolForm
      name="book-table"
      description="Books a table at the restaurant. Asks for party size and a date."
      onAgentSubmit={async (data) => {
        const confirmation = await bookTable({
          partySize: Number(data.get("partySize")),
          date: String(data.get("date")),
        });
        return `Booked! Confirmation code: ${confirmation.code}`;
      }}
    >
      <input
        type="number"
        name="partySize"
        min={1}
        max={12}
        required
        {...toolParamAttrs("Number of guests (1-12)")}
      />
      <input type="date" name="date" required {...toolParamAttrs("Reservation date")} />
      <button type="submit">Book</button>
    </ToolForm>
  );
}
```

- Renders a regular `<form>` with the declarative WebMCP attributes; the **browser** synthesizes the input schema from the form controls.
- Without `autoSubmit`, the agent fills the form and the **user reviews and submits** — the human-in-the-loop default. Style that state with the `:tool-form-active` / `:tool-submit-active` CSS pseudo-classes.
- `onAgentSubmit` handles agent-invoked submissions without navigation: the default action is prevented and your return value is piped back to the agent via `SubmitEvent.respondWith()`. User submissions behave exactly as before.
- In browsers without WebMCP it's just a normal form.

Prefer to keep your own `<form>`? Use the attribute helpers (TypeScript JSX types for `toolname` etc. are included):

```tsx
import { toolFormAttrs, toolParamAttrs } from "@cr4yfish/react-web-mcp";

<form {...toolFormAttrs({ name: "search", description: "Search the site", autoSubmit: true })}>
  <input name="q" required {...toolParamAttrs("The search query")} />
</form>
```

### Any UI library, zero adapters: `useFormTool`

Component libraries like Material UI or Ant Design often don't forward the declarative `tool*` attributes to the DOM. `useFormTool` sidesteps the problem entirely: it derives the input schema from the **rendered form element** — so it works with any library, portals included, with no per-library adapters.

```tsx
import { useRef } from "react";
import { useFormTool } from "@cr4yfish/react-web-mcp";

function CheckoutForm() {
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
      <TextField name="zip" label="ZIP code" required inputProps={{ pattern: "\\d{5}" }} />
      <Select name="country" label="Country">…</Select>
      <Button type="submit">Order</Button>
    </form>
  );
}
```

- The schema comes from `form.elements`: control `name`s, types (`number`→number, `checkbox`→boolean, radio groups & `<select>`→enums), `required`, `min`/`max`/`maxLength`/`pattern`, and descriptions from `toolparamdescription`/`aria-label`/`<label for>`/`placeholder`. Password, hidden, and file inputs are never exposed.
- When the agent calls the tool, fields are filled via native value setters + `input`/`change` events, so controlled React inputs update correctly. Then: user review (default), `autoSubmit: true` (`requestSubmit()`), or your own `onToolCall(args, form)`.
- Dynamic forms: call the returned `refresh()` after fields change.

### Batches of tools: `useWebMCPTools`

```tsx
useWebMCPTools([
  { name: "get-cart", description: "…", annotations: { readOnlyHint: true }, execute: () => cart },
  { name: "add-to-cart", description: "…", inputSchema, execute: addToCart },
]);
```

Registers each tool individually (not via `provideContext`), so multiple components can own batches without clobbering each other.

### React to agent activity: `useWebMCPEvent`

```tsx
import { useWebMCPEvent } from "@cr4yfish/react-web-mcp";

useWebMCPEvent("toolactivated", () => {
  // e.g. scroll a filled-out form into view for user review
});
useWebMCPEvent("toolcanceled", () => {
  // the agent abandoned an in-flight invocation
});
useWebMCPEvent("toolchange", () => {
  // the page's toolset changed
});
```

### Outside React: `@cr4yfish/react-web-mcp/vanilla`

A React-free entry point, safe to import from server components and plain scripts:

```ts
import { registerTool, provideContext, isWebMCPSupported } from "@cr4yfish/react-web-mcp/vanilla";

const unregister = registerTool({
  name: "get-cart",
  description: "Returns the current shopping cart contents as JSON.",
  annotations: { readOnlyHint: true },
  execute: () => cartStore.getState(),
});

// Replace the whole toolset at once (e.g. after login):
const clear = provideContext([toolA, toolB, toolC]);
```

## API reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `useWebMCPTool(options)` | hook | Register an imperative tool for the component's lifetime |
| `useWebMCPTools(tools, options?)` | hook | Register a batch of tools (individually, composable) |
| `useFormTool(options)` | hook | Tool with a schema derived from a rendered `<form>` (works with MUI/AntD/any library) |
| `useWebMCP()` | hook | `{ isSupported, modelContext }` |
| `useWebMCPEvent(name, handler)` | hook | Subscribe to `toolchange` / `toolactivated` / `toolcanceled` |
| `ToolForm` | component | `<form>` registered as a declarative tool, with `onAgentSubmit` |
| `registerTool(tool, options?)` | function | Framework-agnostic registration; returns `unregister()` |
| `provideContext(tools)` | function | Replace the page's whole toolset; returns `unregister()` |
| `getModelContext()` / `isWebMCPSupported()` | function | Feature detection (SSR-safe) |
| `isWebMCPTestingSupported()` | function | Detects the `#enable-webmcp-testing` flag / Tool Inspector API |
| `extractFormSchema(form)` / `applyArgsToForm(form, args)` | function | DOM-based schema synthesis & agent-driven form filling |
| `textResult(text, isError?)` / `jsonResult(value, maxLength?)` | function | Build MCP-shaped tool responses |
| `toolFormAttrs(...)` / `toolParamAttrs(...)` | function | Declarative attribute bags for your own elements |
| `WebMCPTool`, `ToolResponse`, `ToolAnnotations`, `JSONSchema`, `ModelContext`, … | types | Full typings, incl. `document.modelContext` global augmentation |

## Best practices (short version)

From [Chrome's guidance](https://developer.chrome.com/docs/ai/webmcp/best-practices) and the [security docs](https://developer.chrome.com/docs/ai/webmcp/secure-tools):

1. **Names & descriptions are your API docs for the model.** Use clear, action-oriented names (`search-flights`, not `tool1`) and succinct descriptions that say what the tool does, when to use it, and what it returns.
2. **Validate inputs.** Treat tool arguments like any other untrusted user input — agents make mistakes and schemas are hints, not enforcement.
3. **Keep outputs succinct and structured.** Return compact JSON, not HTML dumps. (`jsonResult` truncates oversized payloads for you.)
4. **Return errors as information**, not exceptions — an agent can read `"No flights found for that date"` and try again. This package converts thrown errors into `isError` responses automatically.
5. **Honor human-in-the-loop.** Mark read-only tools with `readOnlyHint`, destructive ones with `destructiveHint`; prefer review-before-submit forms (no `toolautosubmit`) for consequential actions.
6. **Mind exposure.** Tools are visible to the page, same-origin frames, and the built-in browser agent by default. Only widen this with `exposedTo: [origins]` for origins you'd trust with the same data.
7. **Treat agents as another client, not a trusted principal.** Anything a tool allows, assume it will be called with arbitrary arguments at arbitrary times.
8. **Evaluate.** Use the [WebMCP evals CLI](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/evals-cli) and the Chrome DevTools **WebMCP panel** to test that real models pick the right tools with the right arguments.

## Security & supply chain

WebMCP tools execute inside your page with your users' sessions — a compromised dependency in the tool-registration path could silently register, alter, or hijack tools. This package is built to keep that surface minimal and verifiable:

- **Zero runtime dependencies.** The only thing `react-web-mcp` adds to your bundle is its own code; `react` is a peer dependency you already ship. No transitive packages can be compromised because there are none.
- **Small, auditable codebase.** A few hundred lines of TypeScript in `src/` — review it in one sitting. What you audit is what runs: the committed `dist/` is checked in CI against a fresh build and fails the pipeline if it drifts from the source.
- **Locked, audited installs.** The lockfile is committed; CI installs with `--frozen-lockfile` and runs `pnpm audit --audit-level=high` on every push and pull request (this covers dev dependencies — the runtime has none).
- **CI-gated releases.** npm publishes happen only through the GitHub Actions release workflow, gated on the test suite and on the release tag matching `package.json`'s version, using a granular npm token scoped to this package. Once the repository is public, releases will also carry [npm provenance](https://docs.npmjs.com/generating-provenance-statements) so you can verify the published artifact was built from this repo (`npm audit signatures`).

What you can do as a consumer:

- Pin an exact version (or commit your lockfile) and review the small diff between releases — `dist/index.js` is readable output.
- Run `npm audit signatures` in your own CI to verify registry signatures (and provenance attestations once available).
- Remember the broader rule from the [WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools): *every* script you ship can touch `document.modelContext`, so the same supply-chain scrutiny applies to all third-party code on pages that register tools — not just this package.

## Testing your tools

- **Chrome DevTools → WebMCP panel**: inspect registered tools, schemas, and a live invocation log; invoke tools manually or via built-in Gemini integration.
- **[Model Context Tool Inspector](https://github.com/beaufortfrancois/model-context-tool-inspector)**: Chrome extension for verifying exposed tools.
- **[webmcp-tools evals CLI](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/evals-cli)**: scripted LLM evals against your live page's toolset.
- **Unit tests**: this package's `tests/mock-model-context.ts` shows how to mock `document.modelContext` in jsdom.

## Live example

This package is used in production-style fashion by [genie-demo](https://github.com/cr4yfish/genie-demo) — see its `/test/webmcp` page for an end-to-end playground (support detection, imperative tools, declarative form, invocation log).

## Bundled docs for coding agents

This package ships a `doc/` folder **inside the published tarball** (it lands at
`node_modules/@cr4yfish/react-web-mcp/doc/`). A coding agent working in a repo
that depends on `react-web-mcp` can read these directly — no web access needed:

- `doc/index.md` — overview, quick start, and the invariants worth knowing.
- `doc/api-reference.md` — every export, with behavior notes.
- `doc/webmcp-standard.md` — the WebMCP standard itself (imperative + declarative APIs, security, best practices, browser support).
- `doc/llms.txt` — a one-read, machine-readable digest of the whole API surface.

## Agent skill

Working on WebMCP with a coding agent (Claude Code, Cursor, Codex, …)? Install the [web-mcp-skill](https://github.com/cr4yfish/web-mcp-skill) — a framework-agnostic deep-dive WebMCP reference skill — via the [skills.sh CLI](https://www.skills.sh):

```bash
npx skills add cr4yfish/web-mcp-skill
```

## License

MIT
