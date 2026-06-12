import { useEffect, useMemo, useRef, useState } from "react";
import { registerTool } from "../core";
import type {
  JSONSchema,
  ToolAnnotations,
  ToolExecuteResult,
  WebMCPTool,
} from "../types";

export interface UseWebMCPToolOptions<TArgs = Record<string, unknown>> {
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
export function useWebMCPTool<TArgs = Record<string, unknown>>(
  options: UseWebMCPToolOptions<TArgs>,
): { isRegistered: boolean } {
  const {
    name,
    description,
    inputSchema,
    outputSchema,
    annotations,
    exposedTo,
    enabled = true,
    validateInput,
    execute,
  } = options;

  const executeRef = useRef(execute);
  executeRef.current = execute;

  const [isRegistered, setIsRegistered] = useState(false);

  // Re-register only when the serialized definition changes, not on every
  // render with a fresh schema object literal.
  const definitionKey = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        inputSchema,
        outputSchema,
        annotations,
        exposedTo,
        validateInput,
      }),
    [name, description, inputSchema, outputSchema, annotations, exposedTo, validateInput],
  );

  useEffect(() => {
    if (!enabled) {
      setIsRegistered(false);
      return;
    }
    const { exposedTo: parsedExposedTo, ...definition } = JSON.parse(
      definitionKey,
    ) as Omit<WebMCPTool<TArgs>, "execute"> & { exposedTo?: string[] };
    const unregister = registerTool<TArgs>(
      { ...definition, execute: (args) => executeRef.current(args) },
      parsedExposedTo ? { exposedTo: parsedExposedTo } : {},
    );
    setIsRegistered(true);
    return () => {
      setIsRegistered(false);
      unregister();
    };
  }, [definitionKey, enabled]);

  return { isRegistered };
}
