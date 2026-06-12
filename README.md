# react-web-mcp

React hooks and components for **WebMCP** — the emerging web standard that lets your web app expose its functionality as *tools* that in-browser AI agents (like Gemini in Chrome) can discover and call.

```tsx
import { useWebMCPTool } from "react-web-mcp";

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
npm install react-web-mcp
# or
pnpm add react-web-mcp
```

Requires React 18+. Works in Vite, CRA, Remix, and Next.js (App Router and Pages Router — the main entry ships a `"use client"` directive).

## Usage

### Check for support: `useWebMCP`

```tsx
import { useWebMCP } from "react-web-mcp";

function AgentBadge() {
  const { isSupported } = useWebMCP();
  if (!isSupported) return null;
  return <span>🤖 This page is agent-ready</span>;
}
```

SSR-safe: returns `false` on the server and during hydration, the real value after mount.

### Register a tool: `useWebMCPTool`

```tsx
import { useWebMCPTool } from "react-web-mcp";

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
- Declare an `outputSchema` and your raw return value is passed through unnormalized for the browser to validate.

### Declarative forms: `ToolForm`

```tsx
import { ToolForm, toolParamAttrs } from "react-web-mcp";

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
import { toolFormAttrs, toolParamAttrs } from "react-web-mcp";

<form {...toolFormAttrs({ name: "search", description: "Search the site", autoSubmit: true })}>
  <input name="q" required {...toolParamAttrs("The search query")} />
</form>
```

### React to agent activity: `useWebMCPEvent`

```tsx
import { useWebMCPEvent } from "react-web-mcp";

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

### Outside React: `react-web-mcp/vanilla`

A React-free entry point, safe to import from server components and plain scripts:

```ts
import { registerTool, provideContext, isWebMCPSupported } from "react-web-mcp/vanilla";

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
| `useWebMCP()` | hook | `{ isSupported, modelContext }` |
| `useWebMCPEvent(name, handler)` | hook | Subscribe to `toolchange` / `toolactivated` / `toolcanceled` |
| `ToolForm` | component | `<form>` registered as a declarative tool, with `onAgentSubmit` |
| `registerTool(tool, options?)` | function | Framework-agnostic registration; returns `unregister()` |
| `provideContext(tools)` | function | Replace the page's whole toolset; returns `unregister()` |
| `getModelContext()` / `isWebMCPSupported()` | function | Feature detection (SSR-safe) |
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

## Testing your tools

- **Chrome DevTools → WebMCP panel**: inspect registered tools, schemas, and a live invocation log; invoke tools manually or via built-in Gemini integration.
- **[Model Context Tool Inspector](https://github.com/beaufortfrancois/model-context-tool-inspector)**: Chrome extension for verifying exposed tools.
- **[webmcp-tools evals CLI](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/evals-cli)**: scripted LLM evals against your live page's toolset.
- **Unit tests**: this package's `tests/mock-model-context.ts` shows how to mock `document.modelContext` in jsdom.

## Live example

This package is used in production-style fashion by [genie-demo](https://github.com/cr4yfish/genie-demo) — see its `/test/webmcp` page for an end-to-end playground (support detection, imperative tools, declarative form, invocation log).

## License

MIT
