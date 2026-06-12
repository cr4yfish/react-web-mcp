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

export { DEFAULT_MAX_RESULT_LENGTH, type JSONSchema, type ModelContext, type RegisterToolOptions, type ToolAnnotations, type ToolExecuteResult, type ToolResponse, type ToolResponseContent, WEBMCP_INDICATOR_CSS, type WebMCPDiagnostic, type WebMCPDiagnosticCode, type WebMCPDiagnosticLevel, type WebMCPEventName, type WebMCPSubmitEvent, type WebMCPTool, type WebMCPToolEvent, addWebMCPEventListener, applyArgsToForm, extractFormSchema, getModelContext, injectWebMCPIndicatorStyles, isWebMCPSupported, isWebMCPTestingSupported, isWebMCPVerbose, jsonResult, normalizeResult, onWebMCPDiagnostic, provideContext, registerTool, setWebMCPVerbose, textResult, toolFormAttrs, toolParamAttrs, validateToolInput };
