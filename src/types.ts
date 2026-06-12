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
export interface JSONSchema {
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
export interface ToolResponseContent {
  type: "text";
  text: string;
}

/**
 * The structured response a tool returns to the agent. Mirrors the MCP
 * `CallToolResult`. `isError: true` signals a tool-level failure the agent
 * can read about in `content` and potentially recover from.
 */
export interface ToolResponse {
  content: ToolResponseContent[];
  isError?: boolean;
}

/**
 * Behavioral hints about a tool. Agents and browsers may use these to decide
 * whether a call needs user confirmation. They are *hints*, not security
 * boundaries.
 */
export interface ToolAnnotations {
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
export type ToolExecuteResult =
  | ToolResponse
  | string
  | number
  | boolean
  | null
  | undefined
  | void
  | object;

/** A WebMCP tool descriptor, as accepted by `modelContext.registerTool()`. */
export interface WebMCPTool<TArgs = Record<string, unknown>> {
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
export interface RegisterToolOptions {
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
export interface ModelContext extends EventTarget {
  /** Adds a single tool without affecting other registered tools. */
  registerTool(
    tool: WebMCPTool<never> | WebMCPTool,
    options?: RegisterToolOptions,
  ): Promise<unknown> | unknown;
  /** Replaces the page's entire toolset in one call. */
  provideContext?(context: { tools: Array<WebMCPTool<never> | WebMCPTool> }): unknown;
  /** Removes a single tool by name (not available in all versions). */
  unregisterTool?(name: string): unknown;
  /** Removes all tools registered via `provideContext` (not in all versions). */
  clearContext?(): unknown;
}

/** `SubmitEvent` additions from the WebMCP declarative API. */
export interface WebMCPSubmitEvent extends SubmitEvent {
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

// Allow the declarative WebMCP attributes in React JSX without type errors.
// React passes unknown lowercase attributes straight through to the DOM.
declare module "react" {
  interface FormHTMLAttributes<T> {
    /** WebMCP declarative API: registers this form as a tool with this name. */
    toolname?: string;
    /** WebMCP declarative API: natural-language description of the form tool. */
    tooldescription?: string;
    /** WebMCP declarative API: lets the agent submit without user review. */
    toolautosubmit?: boolean | "";
  }
  // Covers <input>, <select>, <textarea> and other form-associated elements.
  interface HTMLAttributes<T> {
    /** WebMCP declarative API: description of this field in the tool's input schema. */
    toolparamdescription?: string;
  }
}
