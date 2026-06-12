# react-web-mcp — agent guide

React hooks/components for the **WebMCP** standard. Zero runtime dependencies, React 18+ peer dep, TypeScript, tsup build (ESM + CJS), vitest + jsdom tests.

## Commands

- `pnpm install` — install dev deps
- `pnpm test` — run vitest (jsdom)
- `pnpm tsc` — type-check (`--noEmit`)
- `pnpm build` — tsup → `dist/` (ESM, CJS, `.d.ts`, sourcemaps)

**`dist/` is committed on purpose** so the package installs straight from git (`github:cr4yfish/react-web-mcp`) until it's published to npm. If you touch anything in `src/`, run `pnpm build` and commit the updated `dist/` too — CI fails on a stale `dist/`.

## CI & releasing

- `.github/workflows/ci.yml` (push to main + PRs): `pnpm audit --audit-level=high`, type-check, tests, build, and a stale-`dist/` check.
- `.github/workflows/publish.yml`: publishes to npm when a GitHub **release** is published. The release tag must be `v<version>` matching `package.json`. Needs the `NPM_TOKEN` repository secret (granular npm token with read/write on this package). Release flow: bump `version` in `package.json` → `pnpm build` → commit → tag `v<version>` → create the GitHub release. Add `--provenance` to the publish step once the repo is public.
- Consumers vendoring the tarball (genie-demo): `pnpm pack` and copy the `.tgz` over (see genie-demo's `docs/webmcp-test-page.md`).

## Layout

- `src/types.ts` — WebMCP type definitions + global augmentation (`document.modelContext`, `navigator.modelContext`) + React JSX augmentation for the declarative attributes (`toolname`, `tooldescription`, `toolautosubmit`, `toolparamdescription`).
- `src/core.ts` — framework-agnostic core: `getModelContext`, `registerTool`, `provideContext`, result normalization (`textResult`, `jsonResult`, `normalizeResult`), declarative attribute helpers. Every function is a safe no-op without browser support / during SSR.
- `src/form.ts` — DOM-based form tooling: `extractFormSchema` (form → JSON Schema; skips password/hidden/file) and `applyArgsToForm` (fills controls via native setters + input/change events for React compatibility).
- `src/react/` — `useWebMCPTool`, `useWebMCPTools`, `useFormTool`, `useWebMCP`, `useWebMCPEvent`, `ToolForm`.
- `src/index.ts` — main entry (gets a `"use client"` banner at build time); `src/vanilla.ts` — React-free entry (`@cr4yfish/react-web-mcp/vanilla`, no directive).
- `tests/` — vitest suites + `mock-model-context.ts` (in-memory ModelContext mock).
- `.claude/skills/webmcp/` — the deep-dive WebMCP skill. Read it before changing API surface. **Don't edit it here**: it's vendored from [cr4yfish/web-mcp-skill](https://github.com/cr4yfish/web-mcp-skill) via the [skills.sh CLI](https://github.com/vercel-labs/skills) (`skills-lock.json` tracks the source). Change it upstream, then re-import with `npx skills update`.

## Invariants — don't break these

1. **SSR safety**: nothing in `src/` may touch `document`/`navigator` at module scope; only inside functions/effects with existence checks.
2. **No re-registration churn**: `useWebMCPTool` must not re-register when only `execute` or inline schema object identity changes (definition is keyed by `JSON.stringify`); `execute` stays fresh via ref.
3. **Both API surfaces**: always resolve the context via `getModelContext()` — `document.modelContext` first (Chrome 150+ spec surface), `navigator.modelContext` fallback (deprecated). Optional members (`provideContext`, `unregisterTool`, `clearContext`) must stay feature-detected.
4. **Errors become responses**: tool `execute` exceptions must surface to the agent as `{ isError: true }` text responses, never unhandled rejections.
5. **`outputSchema` disables normalization**: tools declaring an output schema return raw structured values; don't wrap them in MCP content blocks.
6. **Zero runtime deps** and `react` stays a peer dependency, externalized in tsup.

## What WebMCP is (short)

WebMCP (Web Model Context Protocol) is a proposed web standard (W3C WebML CG, Google + Microsoft) that lets a web page expose client-side functionality as MCP-style *tools* for in-browser AI agents (e.g. Gemini in Chrome, Edge Copilot). Frontend-only: tools run in the page, share the user's session/auth/UI state, and keep the human in the loop.

Two surfaces:

- **Imperative**: `document.modelContext.registerTool({ name, description, inputSchema, outputSchema?, annotations?, execute }, { signal?, exposedTo? })`; `provideContext({ tools })` replaces the whole toolset. Events on the ModelContext: `toolchange`, `toolactivated`, `toolcanceled`.
- **Declarative**: `<form toolname tooldescription [toolautosubmit]>` with `toolparamdescription` on controls; the browser synthesizes the input schema from the form. `SubmitEvent.agentInvoked` + `SubmitEvent.respondWith(promise)` pipe responses back without navigation. CSS: `:tool-form-active`, `:tool-submit-active`.

Availability: Chrome 146+ behind `chrome://flags/#enable-webmcp-testing`, Chrome 149+ origin trial (`<meta http-equiv="origin-trial" …>`), Edge 147+ native. Cross-origin iframe access via Permissions Policy `allow="tools"`; registration rejects with `NotAllowedError` when disallowed.

For the full standard (schema synthesis rules, security model, best practices, evals, comparison with backend MCP), read the skill: `.claude/skills/webmcp/SKILL.md`.

References: [spec/explainer](https://github.com/webmachinelearning/webmcp) · [Chrome docs](https://developer.chrome.com/docs/ai/webmcp) · [official demos & evals CLI](https://github.com/GoogleChromeLabs/webmcp-tools) (contains `demos/react-flightsearch`, the official React example this package's patterns are validated against).

## Live consumer

[genie-demo](https://github.com/cr4yfish/genie-demo) consumes this package (git dependency) and exercises it on its `/test/webmcp` page. Breaking API changes need a matching update there.
