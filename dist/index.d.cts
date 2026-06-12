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
        /** WebMCP declarative API: lets the agent submit without user review. */
        toolautosubmit?: boolean | "";
    }
    interface HTMLAttributes<T> {
        /** WebMCP declarative API: description of this field in the tool's input schema. */
        toolparamdescription?: string;
    }
}

/**
 * Framework-agnostic WebMCP core. Safe to import anywhere (including SSR /
 * Node) — every function degrades to a no-op when WebMCP is unavailable.
 */

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

interface ToolFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "toolname" | "tooldescription" | "toolautosubmit"> {
    /** Tool name registered for this form (declarative `toolname` attribute). */
    name: string;
    /** Tool description for the agent (declarative `tooldescription` attribute). */
    description: string;
    /**
     * Allow the agent to submit the form itself. When `false` (default), the
     * browser fills the form and the user reviews + submits manually — the
     * human-in-the-loop default of the declarative API.
     */
    autoSubmit?: boolean;
    /**
     * Handles agent-invoked submissions without navigating: the default form
     * action is prevented and the handler's (possibly async) return value is
     * piped back to the agent via `SubmitEvent.respondWith()`. The first
     * argument is the form's data; strings/objects are normalized to the MCP
     * result shape. User-driven submissions are unaffected.
     */
    onAgentSubmit?: (data: FormData, event: FormEvent<HTMLFormElement>) => ToolExecuteResult | Promise<ToolExecuteResult>;
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
 * are re-validated in {@link handleSubmit} via `reportValidity()`, so users
 * still get the browser's inline validation UI.
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

/** Events fired at the ModelContext object by the browser. */
type WebMCPEventName = "toolchange" | "toolactivated" | "toolcanceled";
/**
 * Subscribes to a ModelContext event:
 *
 * - `"toolchange"` — the page's toolset changed (tools registered/unregistered).
 * - `"toolactivated"` — an agent ran a tool (for declarative form tools
 *   without `toolautosubmit`, this fires once the form is filled out, so the
 *   page can bring it to the user's attention for review).
 * - `"toolcanceled"` — the agent canceled an in-flight tool invocation.
 *
 * The handler always sees the latest render's closure. No-op when WebMCP is
 * unavailable.
 */
declare function useWebMCPEvent(event: WebMCPEventName, handler: (event: Event) => void): void;

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

export { DEFAULT_MAX_RESULT_LENGTH, type JSONSchema, type ModelContext, type RegisterToolOptions, type ToolAnnotations, type ToolExecuteResult, ToolForm, type ToolFormProps, type ToolResponse, type ToolResponseContent, type UseFormToolOptions, type UseWebMCPToolOptions, type WebMCPEventName, type WebMCPSubmitEvent, type WebMCPTool, applyArgsToForm, extractFormSchema, getModelContext, isWebMCPSupported, isWebMCPTestingSupported, jsonResult, normalizeResult, provideContext, registerTool, textResult, toolFormAttrs, toolParamAttrs, useFormTool, useWebMCP, useWebMCPEvent, useWebMCPTool, useWebMCPTools, validateToolInput };
