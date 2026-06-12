import * as react from 'react';
import { FormHTMLAttributes, FormEvent, ReactNode, RefObject } from 'react';

/**
 * Type definitions for the WebMCP standard (`document.modelContext` /
 * `navigator.modelContext`).
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 * Explainer: https://github.com/webmachinelearning/webmcp
 * Chrome docs: https://developer.chrome.com/docs/ai/webmcp
 */
/**
 * A permissive JSON Schema type. WebMCP `inputSchema`s are JSON Schema
 * objects, the same vocabulary used by backend MCP servers.
 */
interface JSONSchema {
    type?: string | string[];
    description?: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    items?: JSONSchema | JSONSchema[];
    enum?: ReadonlyArray<string | number | boolean | null>;
    const?: unknown;
    default?: unknown;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    anyOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    allOf?: JSONSchema[];
    additionalProperties?: boolean | JSONSchema;
    [key: string]: unknown;
}
/** A single content block in a tool response (MCP `CallToolResult` shape). */
interface ToolResponseContent {
    type: "text";
    text: string;
}
/**
 * The structured response a tool returns to the agent. Mirrors the MCP
 * `CallToolResult`. `isError: true` signals a tool-level failure the agent
 * can read about in `content` and potentially recover from.
 */
interface ToolResponse {
    content: ToolResponseContent[];
    isError?: boolean;
}
/**
 * Behavioral hints about a tool. Agents and browsers may use these to decide
 * whether a call needs user confirmation. They are *hints*, not security
 * boundaries.
 */
interface ToolAnnotations {
    /** Human-readable title for the tool. */
    title?: string;
    /** The tool does not modify any state. */
    readOnlyHint?: boolean;
    /** The tool may perform destructive, hard-to-undo updates. */
    destructiveHint?: boolean;
    /** Calling the tool twice with the same arguments has no additional effect. */
    idempotentHint?: boolean;
    /** The tool interacts with entities outside the page's own domain. */
    openWorldHint?: boolean;
    /** The tool's output may contain third-party / user-generated content and
     * must be treated as untrusted by the agent. */
    untrustedContentHint?: boolean;
}
/**
 * What a tool's `execute` callback may return. Strings and arbitrary
 * JSON-serializable values are normalized by this library into a
 * {@link ToolResponse} before being handed to the browser.
 */
type ToolExecuteResult = ToolResponse | string | number | boolean | null | undefined | void | object;
/** A WebMCP tool descriptor, as accepted by `modelContext.registerTool()`. */
interface WebMCPTool<TArgs = Record<string, unknown>> {
    /** Unique, descriptive tool name (e.g. `"add-todo"`). */
    name: string;
    /** Natural-language description the agent uses to pick the tool. */
    description: string;
    /** JSON Schema describing the arguments object passed to `execute`. */
    inputSchema?: JSONSchema;
    /**
     * JSON Schema describing the structured value `execute` returns. When set,
     * this library passes the raw return value through to the browser
     * unnormalized (only errors are converted to `isError` responses).
     */
    outputSchema?: JSONSchema;
    /** Behavioral hints for agents/browsers. */
    annotations?: ToolAnnotations;
    /**
     * Whether this library validates incoming arguments against `inputSchema`
     * before calling `execute` (the agent is an untrusted client — browsers do
     * NOT enforce the schema). Invalid calls are answered with an `isError`
     * response listing the problems instead of reaching `execute`.
     * Default `true`; set to `false` to receive raw arguments unchecked.
     */
    validateInput?: boolean;
    /** The tool implementation, invoked by the browser on behalf of an agent. */
    execute: (args: TArgs) => ToolExecuteResult | Promise<ToolExecuteResult>;
}
/** Options bag accepted by `modelContext.registerTool(tool, options)`. */
interface RegisterToolOptions {
    /** Aborting the signal unregisters the tool. */
    signal?: AbortSignal;
    /**
     * Secure origins of cross-origin iframes (author-provided agents) that may
     * discover and call this tool. By default tools are only exposed to the
     * page itself, same-origin frames, and the built-in browser agent.
     */
    exposedTo?: string[];
}
/**
 * The browser-provided ModelContext interface.
 *
 * Chrome shipped this as `navigator.modelContext` in early previews and the
 * Chrome 149 origin trial; from Chrome 150 the spec surface is
 * `document.modelContext` and the navigator alias is deprecated. This type
 * covers both, including methods that only exist on some versions — always
 * feature-detect optional members.
 */
interface ModelContext extends EventTarget {
    /** Adds a single tool without affecting other registered tools. */
    registerTool(tool: WebMCPTool<never> | WebMCPTool, options?: RegisterToolOptions): Promise<unknown> | unknown;
    /** Replaces the page's entire toolset in one call. */
    provideContext?(context: {
        tools: Array<WebMCPTool<never> | WebMCPTool>;
    }): unknown;
    /** Removes a single tool by name (not available in all versions). */
    unregisterTool?(name: string): unknown;
    /** Removes all tools registered via `provideContext` (not in all versions). */
    clearContext?(): unknown;
}
/** `SubmitEvent` additions from the WebMCP declarative API. */
interface WebMCPSubmitEvent extends SubmitEvent {
    /** True when an agent (rather than the user) submitted the form. */
    readonly agentInvoked?: boolean;
    /**
     * Overrides the form's default navigation and pipes a response back to the
     * invoking agent. `preventDefault()` must be called first.
     */
    respondWith?(agentResponse: Promise<unknown>): void;
}
declare global {
    interface Document {
        /** WebMCP ModelContext (spec surface, Chrome 150+). */
        modelContext?: ModelContext;
    }
    interface Navigator {
        /** WebMCP ModelContext (early Chrome surface, deprecated in Chrome 150). */
        modelContext?: ModelContext;
    }
}
declare module "react" {
    interface FormHTMLAttributes<T> {
        /** WebMCP declarative API: registers this form as a tool with this name. */
        toolname?: string;
        /** WebMCP declarative API: natural-language description of the form tool. */
        tooldescription?: string;
        /** WebMCP declarative API: optional human-readable title for the form tool. */
        tooltitle?: string;
        /** WebMCP declarative API: lets the agent submit without user review. */
        toolautosubmit?: boolean | "";
    }
    interface HTMLAttributes<T> {
        /** WebMCP declarative API: description of this field in the tool's input schema. */
        toolparamdescription?: string;
    }
}

/** Default cap applied by {@link jsonResult} so oversized tool outputs don't
 * blow past agent context limits. */
declare const DEFAULT_MAX_RESULT_LENGTH = 50000;
/**
 * Returns the page's ModelContext, preferring the spec surface
 * (`document.modelContext`, Chrome 150+) and falling back to the deprecated
 * `navigator.modelContext`. Returns `null` during SSR or when the browser
 * doesn't support WebMCP.
 */
declare function getModelContext(): ModelContext | null;
/** True when the current browser exposes the WebMCP API. */
declare function isWebMCPSupported(): boolean;
/**
 * True when the WebMCP *testing* API (`navigator.modelContextTesting`) is
 * available — i.e. Chrome with the `#enable-webmcp-testing` flag, as used by
 * the Model Context Tool Inspector extension and the DevTools WebMCP panel.
 */
declare function isWebMCPTestingSupported(): boolean;
/** Wraps plain text in the MCP `CallToolResult` content shape. */
declare function textResult(text: string, isError?: boolean): ToolResponse;
/**
 * Serializes a value as JSON inside a text content block. Output longer than
 * `maxLength` (default {@link DEFAULT_MAX_RESULT_LENGTH}) is truncated with a
 * marker, so a tool can never flood the agent's context window.
 */
declare function jsonResult(value: unknown, maxLength?: number): ToolResponse;
/**
 * Normalizes whatever a tool's `execute` returned into a {@link ToolResponse}:
 * strings become text content, objects are JSON-stringified (with truncation),
 * and well-formed responses pass through untouched.
 */
declare function normalizeResult(value: ToolExecuteResult): ToolResponse;
/**
 * Registers a WebMCP tool and returns an `unregister` function.
 *
 * - Results from `execute` are normalized to the MCP content shape and
 *   thrown errors are converted into `isError` responses.
 * - Unregistration works across implementations: an `AbortSignal` is passed
 *   when supported, and `unregisterTool(name)` is used as a fallback.
 * - No-op (returns a no-op unregister) when WebMCP is unavailable.
 */
declare function registerTool<TArgs = Record<string, unknown>>(tool: WebMCPTool<TArgs>, options?: Omit<RegisterToolOptions, "signal"> & {
    signal?: AbortSignal;
}): () => void;
/**
 * Replaces the page's entire toolset via `provideContext`. Falls back to
 * registering each tool individually when `provideContext` is unavailable.
 * Returns an `unregister` function for the provided tools.
 */
declare function provideContext(tools: Array<WebMCPTool<never> | WebMCPTool>): () => void;
/**
 * Builds the declarative WebMCP attribute bag for a `<form>` element:
 * `toolname`, `tooldescription`, and optionally `toolautosubmit`. Spread it
 * onto a form in any framework: `<form {...toolFormAttrs({...})}>`.
 *
 * Strongly consider `autoSubmit: true`: a form without `toolautosubmit`
 * keeps its invocation pending until the user submits, and in current
 * Chromium a re-invoke on top of a pending invocation drops its reply and
 * closes the page's WebMCP channel (every tool dies until reload). `ToolForm`
 * defaults to auto-submission for exactly this reason.
 */
declare function toolFormAttrs(options: {
    name: string;
    description: string;
    autoSubmit?: boolean;
}): Record<string, string>;
/**
 * Builds the declarative attribute bag for a form control:
 * `<input {...toolParamAttrs("The city to search in")} name="city" />`.
 */
declare function toolParamAttrs(description: string): Record<string, string>;

/**
 * Minimal, dependency-free JSON Schema validation for tool inputs.
 *
 * The WebMCP spec treats `inputSchema` as documentation — browsers do not
 * enforce it, and the agent is an untrusted client that may call a tool with
 * any arguments at any time. This validator closes that gap for the common
 * keywords so tools don't have to hand-roll `typeof` checks in `execute`.
 *
 * It is deliberately conservative: only keywords it fully understands are
 * checked, and any schema node using composition (`$ref`, `anyOf`, `oneOf`,
 * `allOf`, `not`, `if`) is skipped entirely rather than risking a false
 * rejection. Unknown keywords are ignored, exactly like a missing schema.
 */

/**
 * Validates a tool's arguments against its `inputSchema` and returns a list
 * of human-readable problems (empty when the arguments are valid, when there
 * is no schema, or when the schema only uses constructs this validator
 * doesn't understand).
 *
 * Checked keywords: `type` (incl. arrays of types), `required`, `properties`
 * (recursive), `additionalProperties: false`, `enum`, `const`, `minLength`,
 * `maxLength`, `pattern`, `minimum`, `maximum`, `exclusiveMinimum`,
 * `exclusiveMaximum`, `minItems`, `maxItems`, and single-schema `items`.
 * Nodes using `$ref` / `anyOf` / `oneOf` / `allOf` / `not` / `if` are skipped.
 */
declare function validateToolInput(args: unknown, schema: JSONSchema | undefined): string[];

/**
 * DOM-based form tooling: derive a WebMCP input schema from a real
 * `<form>` element and fill it back in from tool arguments.
 *
 * Because this inspects the rendered DOM (not the React element tree), it
 * works with any UI library that ultimately renders native form controls —
 * Material UI, Ant Design, shadcn/ui, portals, custom wrappers — without
 * per-library adapters.
 */

/**
 * Builds a JSON Schema describing a form's named controls, mirroring what
 * the declarative WebMCP API synthesizes natively: control `name`s become
 * properties, `required` controls become required properties, and
 * `toolparamdescription` / `aria-label` / `<label for>` / `placeholder`
 * provide descriptions. Hidden, file, button, and password controls are
 * skipped (passwords must never reach an agent).
 */
declare function extractFormSchema(form: HTMLFormElement): JSONSchema;
/**
 * Fills a form's named controls from a tool-arguments object, dispatching
 * the events React (and other frameworks) need to pick the values up.
 * Returns the names of arguments that could not be applied.
 */
declare function applyArgsToForm(form: HTMLFormElement, args: Record<string, unknown>): string[];

/**
 * Verbose mode + diagnostics stream. The package must never fail silently:
 * every lifecycle anomaly is funneled through {@link reportWebMCP}, which
 * always notifies subscribers and always sends warnings/errors to the
 * console. Info-level lifecycle logs (registrations, invocations, responses)
 * reach the console only in verbose mode — enable it on debug/test pages
 * with `setWebMCPVerbose(true)`.
 */
type WebMCPDiagnosticLevel = "info" | "warn" | "error";
type WebMCPDiagnosticCode = "unsupported" | "register" | "unregister" | "register-failed" | "execute" | "execute-result" | "execute-error" | "invalid-arguments" | "result-truncated" | "invalid-definition" | "provide-context-failed" | "agent-submit" | "agent-response" | "agent-response-error" | "respondwith-missing" | "agent-submit-navigation" | "invocation-pending" | "invocation-overlap" | "invocation-reinvoked" | "invocation-timeout" | "invocation-canceled";
interface WebMCPDiagnostic {
    level: WebMCPDiagnosticLevel;
    code: WebMCPDiagnosticCode;
    /** Human-readable, self-contained message. */
    message: string;
    /** Name of the tool this diagnostic concerns, when known. */
    toolName?: string;
    /** Extra structured context (argument keys, durations, results, errors). */
    detail?: unknown;
}
type DiagnosticListener = (diagnostic: WebMCPDiagnostic) => void;
/**
 * Enables/disables verbose mode. When enabled, info-level lifecycle
 * diagnostics (tool registration, invocations, agent submissions, responses)
 * are logged to the console with a `[webmcp]` prefix. Warnings and errors
 * are logged regardless of this flag.
 */
declare function setWebMCPVerbose(enabled: boolean): void;
/** True when verbose mode is on. */
declare function isWebMCPVerbose(): boolean;
/**
 * Subscribes to every diagnostic the package emits (all levels, independent
 * of verbose mode) — ideal for rendering an on-page debug log next to the
 * tools being tested. Returns an unsubscribe function.
 */
declare function onWebMCPDiagnostic(listener: DiagnosticListener): () => void;

/** Spec-facing event names accepted by this package. */
type WebMCPEventName = "toolchange" | "toolactivated" | "toolcanceled";
/** A WebMCP lifecycle event. Chromium's `WebMCPEvent` carries the name of
 * the tool concerned in `toolName` (empty/undefined on older builds). */
type WebMCPToolEvent = Event & {
    readonly toolName?: string;
};
/**
 * Subscribes to a WebMCP lifecycle event on every surface current
 * implementations use (window + ModelContext, all name variants), invoking
 * `handler` exactly once per event. Returns an unsubscribe function.
 * No-op (returns a no-op unsubscriber) during SSR or without WebMCP.
 */
declare function addWebMCPEventListener(name: WebMCPEventName, handler: (event: WebMCPToolEvent) => void): () => void;

/**
 * Opt-in visual indicators for declarative form tools.
 *
 * While an agent invocation is pending (the agent filled the form and the
 * user is expected to review and submit it), the browser applies the CSS
 * pseudo-classes `:tool-form-active` (on the form) and `:tool-submit-active`
 * (on its submit button). This module ships a small default stylesheet for
 * that state, plus a `data-webmcp-active` attribute fallback maintained by
 * `<ToolForm indicators>` for engines that don't support the pseudo-classes
 * (the attribute also gives page CSS a stable hook).
 *
 * The selectors only match forms that opted in via the
 * `data-webmcp-indicators` attribute, and use `:is()` so the unknown
 * pseudo-class can't invalidate the whole rule in other browsers. Override
 * the color with `--webmcp-indicator-color`, or write your own CSS against
 * `:tool-form-active` / `[data-webmcp-active="true"]` instead.
 */
declare const WEBMCP_INDICATOR_CSS = "\nform[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active=\"true\"]) {\n  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);\n  outline-offset: 3px;\n}\nform[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active=\"true\"])\n  :is(button[type=\"submit\"], input[type=\"submit\"]) {\n  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);\n  outline-offset: 2px;\n}\n@media (prefers-reduced-motion: no-preference) {\n  form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active=\"true\"])\n    :is(button[type=\"submit\"], input[type=\"submit\"]) {\n    animation: webmcp-submit-pulse 1.2s ease-in-out infinite;\n  }\n}\n@keyframes webmcp-submit-pulse {\n  50% { outline-offset: 5px; }\n}\n";
/**
 * Injects the default indicator stylesheet once per document (refcounted).
 * Returns a release function; the `<style>` element is removed when every
 * caller has released. Safe no-op during SSR.
 */
declare function injectWebMCPIndicatorStyles(): () => void;

/**
 * How long an agent invocation may sit unanswered (form filled, waiting for
 * the user's review submit) before the form auto-cancels it via `reset()`.
 *
 * Chromium keeps exactly ONE pending invocation per declarative form. If the
 * tool is invoked again while one is pending, the browser silently drops the
 * previous invocation's internal reply callback — which closes the page's
 * WebMCP channel and kills EVERY tool on the page until reload. A stale
 * pending invocation is therefore a landmine; `form.reset()` is the
 * sanctioned page-side cancel (the agent receives a proper "cancelled by a
 * form reset" error and the channel stays healthy).
 */
declare const DEFAULT_PENDING_TIMEOUT_MS = 120000;
interface ToolFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "toolname" | "tooldescription" | "toolautosubmit"> {
    /** Tool name registered for this form (declarative `toolname` attribute). */
    name: string;
    /** Tool description for the agent (declarative `tooldescription` attribute). */
    description: string;
    /**
     * Whether the agent may submit the form itself (renders the
     * `toolautosubmit` attribute).
     *
     * **Defaults to `true`**, deliberately flipping the platform's
     * human-in-the-loop default, because review mode is currently hazardous:
     * without `toolautosubmit`, the browser keeps the invocation pending while
     * the user reviews the agent-filled form — and Chromium tracks only ONE
     * pending invocation per form. If the agent re-invokes the tool in the
     * meantime (observed in practice within seconds), the previous
     * invocation's reply callback is dropped, the page's WebMCP channel
     * closes, and **every tool on the page silently dies until reload**. The
     * page cannot intercept that drop. Auto-submission answers each invocation
     * immediately, so the dangerous pending state never exists.
     *
     * Set `autoSubmit={false}` for consequential actions that genuinely need
     * user review. Review mode is channel-safe by default via
     * {@link ToolFormProps.reviewResponse} (`"immediate"`): each invocation is
     * answered right away with a staged "form filled, awaiting user review"
     * response, so nothing is ever left pending browser-side.
     */
    autoSubmit?: boolean;
    /**
     * How review mode (`autoSubmit={false}`) answers the agent:
     *
     * - `"immediate"` (default): the invocation is answered **immediately**
     *   with a staged `"Form filled out. The user must review and submit it
     *   manually."` response — the same semantics as `useFormTool`. Nothing is
     *   ever left pending browser-side, so the one-pending-invocation channel
     *   kill (see {@link autoSubmit}) is structurally impossible; a double
     *   invocation simply answers twice. The user's review submit then
     *   completes as a **normal form submission** (`agentInvoked` is false;
     *   handle it in `onSubmit`), and `onAgentSubmit` is not called. The
     *   pending state exposed via `indicators`/`onPendingChange` remains until
     *   the user submits or the form resets.
     *
     * - `"on-submit"`: the platform-native flow — the invocation stays pending
     *   until the user submits, and the agent receives the real, user-approved
     *   result via `onAgentSubmit`. Hazardous in current Chromium: a re-invoke
     *   while pending drops the previous reply and can kill every WebMCP tool
     *   on the page until reload. The re-invoke guard and `pendingTimeoutMs`
     *   watchdog mitigate this, but a re-invoke whose fill changes **no**
     *   control values (identical arguments) is invisible to the page and
     *   cannot be intercepted. Use only when the agent truly needs the final
     *   submitted data.
     */
    reviewResponse?: "immediate" | "on-submit";
    /**
     * Handles agent-invoked submissions without navigating: the default form
     * action is prevented and the handler's (possibly async) return value is
     * piped back to the agent via `SubmitEvent.respondWith()`. The first
     * argument is the form's data; strings/objects are normalized to the MCP
     * result shape. User-driven submissions are unaffected.
     */
    onAgentSubmit?: (data: FormData, event: FormEvent<HTMLFormElement>) => ToolExecuteResult | Promise<ToolExecuteResult>;
    /**
     * Opt-in visual indicators for the agent-filled/awaiting-review state:
     * injects a small stylesheet (once per page) that highlights the form and
     * its submit button via the native `:tool-form-active` pseudo-class, with a
     * `data-webmcp-active="true"` attribute fallback maintained by this
     * component. Override the color with `--webmcp-indicator-color`, or style
     * those selectors yourself and leave this off.
     */
    indicators?: boolean;
    /**
     * Watchdog for stale invocations: when an agent invocation has been
     * pending (form filled, no user submit) for this long, the form is
     * `reset()`, which makes the browser cancel the invocation *properly* —
     * the agent gets a "cancelled" error and, crucially, the page's WebMCP
     * channel survives. Without it, a second invocation arriving on top of a
     * stale one makes Chromium drop the old invocation's reply callback and
     * silently disables every tool on the page until reload.
     * Milliseconds; default {@link DEFAULT_PENDING_TIMEOUT_MS}. Set `0` to
     * disable (not recommended).
     */
    pendingTimeoutMs?: number;
    /**
     * Reset the form after an agent submission has been answered, so the next
     * invocation starts from a clean slate. The reset is deferred a tick so it
     * can never race the browser's response delivery (a reset while the
     * response is still in flight would cancel it). Default `false`.
     */
    resetAfterAgentSubmit?: boolean;
    /**
     * Observes the pending state (`true` while an agent has filled the form
     * and a user review/submit is awaited; `false` once answered, cancelled,
     * or reset). Useful for rendering custom "review this form" UI.
     */
    onPendingChange?: (pending: boolean) => void;
    /**
     * Automatic re-invoke guard for `reviewResponse="on-submit"` forms
     * (default `true`; inert in the other modes, which are channel-safe by
     * construction).
     *
     * When the agent re-invokes the tool while a previous invocation is still
     * awaiting the user's submit, Chromium drops the previous invocation's
     * reply and the page's WebMCP channel dies (see {@link autoSubmit}). The
     * guard exploits the one window the page gets: the new invocation's form
     * fill dispatches `input` events *before* the browser overwrites the old
     * reply slot. On a fill signal (an `input` event on an unfocused control
     * while a review is pending — user interactions target the focused
     * control), the guard snapshots every control, calls `form.reset()` —
     * which makes the browser answer the OLD invocation with a proper
     * "cancelled" error, keeping the channel alive — and restores the values
     * so the new fill completes intact. Emits an `invocation-reinvoked`
     * warning diagnostic.
     *
     * Limits: a re-invoke whose fill changes no control values (identical
     * arguments) dispatches no events and CANNOT be caught — the
     * `invocation-overlap` error then reports the damage after the fact.
     * Don't combine with a `reset`-event listener that calls
     * `preventDefault()`. A misfire (e.g. browser autofill writing to
     * unfocused controls during a pending review) costs only the pending
     * invocation — values are preserved.
     */
    reinvokeGuard?: boolean;
    children?: ReactNode;
}
/**
 * A `<form>` registered as a declarative WebMCP tool.
 *
 * The browser synthesizes the tool's input schema from the form's controls:
 * each control's `name` attribute becomes a schema property, `required`
 * controls become required properties, and the `toolparamdescription`
 * attribute (see `toolParamAttrs`) provides per-field descriptions.
 *
 * In browsers without WebMCP support this renders a perfectly ordinary form —
 * the extra attributes are simply ignored.
 *
 * The rendered form is `noValidate`: an agent-filled control that fails native
 * HTML constraint validation (e.g. a `required` field the agent left empty)
 * would otherwise block submission entirely — the `submit` event would never
 * fire, `respondWith` would never be called, and the agent's invocation would
 * hang unanswered, silencing every later tool call on the page. Human submits
 * are re-validated in the submit handler via `reportValidity()`, so users
 * still get the browser's inline validation UI.
 *
 * Lifecycle safety: the component tracks the browser's `toolactivated` /
 * `toolcanceled` events and the form's `reset` events to know when an
 * invocation is pending, warns loudly when invocations overlap (the
 * channel-killing scenario described on {@link ToolFormProps.pendingTimeoutMs}),
 * and auto-cancels stale invocations via `form.reset()`.
 */
declare const ToolForm: react.ForwardRefExoticComponent<ToolFormProps & react.RefAttributes<HTMLFormElement>>;

interface UseFormToolOptions {
    /** Ref to the form element (any UI library that renders a native form). */
    formRef: RefObject<HTMLFormElement | null>;
    /** Unique, descriptive tool name. */
    name: string;
    /** Natural-language description the agent uses to pick the tool. */
    description: string;
    /**
     * Submit the form (`requestSubmit()`) after filling it. Default `false`:
     * the filled form is left for the user to review and submit — the same
     * human-in-the-loop default as the declarative API's missing
     * `toolautosubmit`.
     */
    autoSubmit?: boolean;
    /**
     * Handle the invocation yourself after the form has been filled, instead
     * of submitting/focusing. Receives the parsed arguments; the return value
     * is sent to the agent.
     */
    onToolCall?: (args: Record<string, unknown>, form: HTMLFormElement) => ToolExecuteResult | Promise<ToolExecuteResult>;
    /** Behavioral hints for agents/browsers. */
    annotations?: ToolAnnotations;
    /** Set to `false` to unregister without unmounting. Default `true`. */
    enabled?: boolean;
}
/**
 * Registers an imperative WebMCP tool whose input schema is derived from a
 * real, rendered `<form>` element in the DOM.
 *
 * Unlike React-tree adapters, this works with **any** component library that
 * renders native form controls (Material UI, Ant Design, shadcn/ui, portals,
 * custom wrappers): the schema comes from `form.elements` — control `name`s,
 * `required`, types, `min`/`max`, select options, and descriptions from
 * `toolparamdescription` / `aria-label` / `<label for>` / `placeholder`.
 * Password, hidden, and file inputs are never exposed.
 *
 * When the agent calls the tool, the form is filled using native value
 * setters + `input`/`change` events (so controlled React inputs update),
 * then either submitted (`autoSubmit`), handled by `onToolCall`, or left
 * focused for the user to review.
 *
 * The schema is captured when the form mounts (and when the definition or
 * `enabled` changes). For forms whose fields change dynamically, call the
 * returned `refresh()` after the change.
 *
 * Unlike declarative form tools, this imperative tool answers the agent
 * immediately on every call (even in the review flow), so it is immune to
 * the browser's one-pending-invocation-per-form hazard that makes
 * `ToolForm` default to `autoSubmit` — `autoSubmit` can safely stay `false`
 * here.
 */
declare function useFormTool(options: UseFormToolOptions): {
    isRegistered: boolean;
    /** Re-extracts the schema from the current DOM and re-registers. */
    refresh: () => void;
};

/**
 * Registers a batch of WebMCP tools for the lifetime of the component.
 *
 * Tools are registered **individually** (not via `provideContext`), so
 * multiple components can each own a batch without clobbering each other's
 * registrations. Definitions are compared by value, so inline arrays and
 * object literals don't cause re-registration churn; each tool's `execute`
 * stays fresh via a ref. Use the module-level `provideContext()` instead
 * when you genuinely want to replace the page's entire toolset.
 */
declare function useWebMCPTools(tools: WebMCPTool[], options?: {
    enabled?: boolean;
}): {
    isRegistered: boolean;
};

/**
 * Reports WebMCP availability in the current browser.
 *
 * Returns `isSupported: false` on the server and during hydration, then the
 * real value after mount — so it is SSR-safe and never causes a hydration
 * mismatch as long as you branch on it consistently.
 */
declare function useWebMCP(): {
    isSupported: boolean;
    modelContext: ModelContext | null;
};

/**
 * Subscribes to a WebMCP lifecycle event:
 *
 * - `"toolchange"` — the page's toolset changed (tools registered/unregistered).
 * - `"toolactivated"` — an agent ran a tool (for declarative form tools
 *   without `toolautosubmit`, this fires once the form is filled out, so the
 *   page can bring it to the user's attention for review).
 * - `"toolcanceled"` — the agent canceled an in-flight tool invocation.
 *
 * Listeners are attached to every surface current implementations use:
 * Chromium dispatches `toolactivated` and the cancel event (named
 * `toolcancel` there) at the `window`, and only `toolchange` at the
 * ModelContext object — this hook covers both targets and both cancel-event
 * spellings, deduped per event. The event's `toolName` property (when the
 * browser provides it) names the tool concerned.
 *
 * The handler always sees the latest render's closure. No-op when WebMCP is
 * unavailable.
 */
declare function useWebMCPEvent(event: WebMCPEventName, handler: (event: WebMCPToolEvent) => void): void;

interface UseWebMCPToolOptions<TArgs = Record<string, unknown>> {
    /** Unique, descriptive tool name (e.g. `"add-todo"`). */
    name: string;
    /** Natural-language description the agent uses to pick the tool. */
    description: string;
    /** JSON Schema for the arguments object. */
    inputSchema?: JSONSchema;
    /** JSON Schema for the structured return value (disables result normalization). */
    outputSchema?: JSONSchema;
    /** Behavioral hints (`readOnlyHint`, `untrustedContentHint`, …). */
    annotations?: ToolAnnotations;
    /** Secure origins of embedded agents allowed to call this tool. */
    exposedTo?: string[];
    /** Set to `false` to unregister the tool without unmounting. Default `true`. */
    enabled?: boolean;
    /**
     * Validate incoming arguments against `inputSchema` before `execute` runs
     * (invalid calls get an `isError` response). Default `true`.
     */
    validateInput?: boolean;
    /**
     * The tool implementation. Always sees the latest render's closure — you
     * do NOT need to memoize it; changing it does not re-register the tool.
     */
    execute: (args: TArgs) => ToolExecuteResult | Promise<ToolExecuteResult>;
}
/**
 * Registers a WebMCP tool for the lifetime of the component.
 *
 * The tool is registered on mount and unregistered on unmount. It is only
 * re-registered when its *definition* changes (name, description, schema,
 * annotations, exposure, enabled) — `execute` is kept fresh via a ref, so
 * inline closures over current props/state work without re-registration.
 *
 * No-op during SSR and in browsers without WebMCP support.
 */
declare function useWebMCPTool<TArgs = Record<string, unknown>>(options: UseWebMCPToolOptions<TArgs>): {
    isRegistered: boolean;
};

export { DEFAULT_MAX_RESULT_LENGTH, DEFAULT_PENDING_TIMEOUT_MS, type JSONSchema, type ModelContext, type RegisterToolOptions, type ToolAnnotations, type ToolExecuteResult, ToolForm, type ToolFormProps, type ToolResponse, type ToolResponseContent, type UseFormToolOptions, type UseWebMCPToolOptions, WEBMCP_INDICATOR_CSS, type WebMCPDiagnostic, type WebMCPDiagnosticCode, type WebMCPDiagnosticLevel, type WebMCPEventName, type WebMCPSubmitEvent, type WebMCPTool, type WebMCPToolEvent, addWebMCPEventListener, applyArgsToForm, extractFormSchema, getModelContext, injectWebMCPIndicatorStyles, isWebMCPSupported, isWebMCPTestingSupported, isWebMCPVerbose, jsonResult, normalizeResult, onWebMCPDiagnostic, provideContext, registerTool, setWebMCPVerbose, textResult, toolFormAttrs, toolParamAttrs, useFormTool, useWebMCP, useWebMCPEvent, useWebMCPTool, useWebMCPTools, validateToolInput };
