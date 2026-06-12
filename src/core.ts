/**
 * Framework-agnostic WebMCP core. Safe to import anywhere (including SSR /
 * Node) — every function degrades to a no-op when WebMCP is unavailable.
 */
import type {
  ModelContext,
  RegisterToolOptions,
  ToolExecuteResult,
  ToolResponse,
  WebMCPTool,
} from "./types";

/** Default cap applied by {@link jsonResult} so oversized tool outputs don't
 * blow past agent context limits. */
export const DEFAULT_MAX_RESULT_LENGTH = 50_000;

// Bundlers statically replace process.env.NODE_ENV; this keeps the access
// type-safe without depending on @types/node.
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/**
 * Returns the page's ModelContext, preferring the spec surface
 * (`document.modelContext`, Chrome 150+) and falling back to the deprecated
 * `navigator.modelContext`. Returns `null` during SSR or when the browser
 * doesn't support WebMCP.
 */
export function getModelContext(): ModelContext | null {
  if (typeof document !== "undefined" && document.modelContext) {
    return document.modelContext;
  }
  if (typeof navigator !== "undefined" && navigator.modelContext) {
    return navigator.modelContext;
  }
  return null;
}

/** True when the current browser exposes the WebMCP API. */
export function isWebMCPSupported(): boolean {
  return getModelContext() !== null;
}

/**
 * True when the WebMCP *testing* API (`navigator.modelContextTesting`) is
 * available — i.e. Chrome with the `#enable-webmcp-testing` flag, as used by
 * the Model Context Tool Inspector extension and the DevTools WebMCP panel.
 */
export function isWebMCPTestingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean((navigator as { modelContextTesting?: unknown }).modelContextTesting)
  );
}

/**
 * Validates a tool definition with developer-friendly errors. Throws in
 * development; in production it reports to the console and returns false so
 * a bad definition can never crash the page for end users.
 */
function validateTool(tool: WebMCPTool<never> | WebMCPTool): boolean {
  let problem: string | null = null;
  if (typeof tool.name !== "string" || tool.name.length === 0) {
    problem = "Tool name must be a non-empty string.";
  } else if (typeof tool.description !== "string" || tool.description.length === 0) {
    problem = `Tool "${tool.name}" needs a non-empty description.`;
  } else if (tool.inputSchema !== undefined) {
    try {
      JSON.stringify(tool.inputSchema);
    } catch {
      problem = `Tool "${tool.name}" has a non-JSON-serializable inputSchema.`;
    }
  }
  if (problem === null) return true;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    throw new TypeError(`WebMCP: ${problem}`);
  }
  reportError(`WebMCP: ${problem}`, undefined);
  return false;
}

/** Wraps plain text in the MCP `CallToolResult` content shape. */
export function textResult(text: string, isError = false): ToolResponse {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

/**
 * Serializes a value as JSON inside a text content block. Output longer than
 * `maxLength` (default {@link DEFAULT_MAX_RESULT_LENGTH}) is truncated with a
 * marker, so a tool can never flood the agent's context window.
 */
export function jsonResult(
  value: unknown,
  maxLength: number = DEFAULT_MAX_RESULT_LENGTH,
): ToolResponse {
  let text: string;
  try {
    text = JSON.stringify(value) ?? "null";
  } catch {
    return textResult("Error: tool result could not be serialized to JSON.", true);
  }
  if (maxLength > 0 && text.length > maxLength) {
    text = `${text.slice(0, maxLength)}… [truncated ${text.length - maxLength} characters]`;
  }
  return { content: [{ type: "text", text }] };
}

function isToolResponse(value: unknown): value is ToolResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ToolResponse).content)
  );
}

/**
 * Normalizes whatever a tool's `execute` returned into a {@link ToolResponse}:
 * strings become text content, objects are JSON-stringified (with truncation),
 * and well-formed responses pass through untouched.
 */
export function normalizeResult(value: ToolExecuteResult): ToolResponse {
  if (isToolResponse(value)) return value;
  if (value === undefined || value === null) return textResult("OK");
  if (typeof value === "string") return textResult(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return textResult(String(value));
  }
  return jsonResult(value);
}

function wrapExecute<TArgs>(tool: WebMCPTool<TArgs>): WebMCPTool<TArgs> {
  return {
    ...tool,
    async execute(args: TArgs) {
      try {
        const result = await tool.execute(args);
        // Tools with an outputSchema return structured values the browser
        // validates against that schema — don't re-shape them.
        return tool.outputSchema ? result : normalizeResult(result);
      } catch (error) {
        // Best practice: report failures to the agent as a readable tool
        // response instead of an opaque exception, so it can self-correct.
        const message = error instanceof Error ? error.message : String(error);
        return textResult(`Tool "${tool.name}" failed: ${message}`, true);
      }
    },
  };
}

/**
 * Registers a WebMCP tool and returns an `unregister` function.
 *
 * - Results from `execute` are normalized to the MCP content shape and
 *   thrown errors are converted into `isError` responses.
 * - Unregistration works across implementations: an `AbortSignal` is passed
 *   when supported, and `unregisterTool(name)` is used as a fallback.
 * - No-op (returns a no-op unregister) when WebMCP is unavailable.
 */
export function registerTool<TArgs = Record<string, unknown>>(
  tool: WebMCPTool<TArgs>,
  options: Omit<RegisterToolOptions, "signal"> & { signal?: AbortSignal } = {},
): () => void {
  if (!validateTool(tool as WebMCPTool)) return () => {};
  const context = getModelContext();
  if (!context) return () => {};

  const controller = new AbortController();
  const { signal: outerSignal, ...rest } = options;
  if (outerSignal) {
    if (outerSignal.aborted) return () => {};
    outerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let registered = true;
  try {
    // Promise rejections (e.g. NotAllowedError from Permissions Policy) must
    // not become unhandled — surface them on the console instead.
    const result = context.registerTool(wrapExecute(tool) as WebMCPTool, {
      ...rest,
      signal: controller.signal,
    });
    if (result instanceof Promise) {
      result.catch((error) => {
        registered = false;
        reportError(`WebMCP: failed to register tool "${tool.name}"`, error);
      });
    }
  } catch (error) {
    reportError(`WebMCP: failed to register tool "${tool.name}"`, error);
    return () => {};
  }

  return () => {
    if (!registered) return;
    registered = false;
    controller.abort();
    try {
      context.unregisterTool?.(tool.name);
    } catch {
      // Older implementations may throw for unknown names — ignore.
    }
  };
}

/**
 * Replaces the page's entire toolset via `provideContext`. Falls back to
 * registering each tool individually when `provideContext` is unavailable.
 * Returns an `unregister` function for the provided tools.
 */
export function provideContext(tools: Array<WebMCPTool<never> | WebMCPTool>): () => void {
  tools = tools.filter(validateTool);
  const context = getModelContext();
  if (!context) return () => {};

  if (typeof context.provideContext === "function") {
    try {
      context.provideContext({ tools: tools.map((t) => wrapExecute(t as WebMCPTool)) });
    } catch (error) {
      reportError("WebMCP: provideContext failed", error);
      return () => {};
    }
    return () => {
      try {
        context.clearContext ? context.clearContext() : context.provideContext?.({ tools: [] });
      } catch {
        // ignore
      }
    };
  }

  const unregisters = tools.map((tool) => registerTool(tool as WebMCPTool));
  return () => {
    for (const unregister of unregisters) unregister();
  };
}

function reportError(prefix: string, error: unknown): void {
  if (typeof console !== "undefined") {
    console.error(prefix, error);
  }
}

/**
 * Builds the declarative WebMCP attribute bag for a `<form>` element:
 * `toolname`, `tooldescription`, and optionally `toolautosubmit`. Spread it
 * onto a form in any framework: `<form {...toolFormAttrs({...})}>`.
 */
export function toolFormAttrs(options: {
  name: string;
  description: string;
  autoSubmit?: boolean;
}): Record<string, string> {
  const attrs: Record<string, string> = {
    toolname: options.name,
    tooldescription: options.description,
  };
  if (options.autoSubmit) attrs.toolautosubmit = "";
  return attrs;
}

/**
 * Builds the declarative attribute bag for a form control:
 * `<input {...toolParamAttrs("The city to search in")} name="city" />`.
 */
export function toolParamAttrs(description: string): Record<string, string> {
  return { toolparamdescription: description };
}
