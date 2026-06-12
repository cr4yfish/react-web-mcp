import { useEffect, useRef, useState } from "react";
import { registerTool } from "../core";
import type { WebMCPTool } from "../types";

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
export function useWebMCPTools(
  tools: WebMCPTool[],
  options: { enabled?: boolean } = {},
): { isRegistered: boolean } {
  const { enabled = true } = options;

  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  const [isRegistered, setIsRegistered] = useState(false);

  const definitionKey = JSON.stringify(
    tools.map(({ execute: _execute, ...definition }) => definition),
  );

  useEffect(() => {
    if (!enabled) {
      setIsRegistered(false);
      return;
    }
    const definitions = JSON.parse(definitionKey) as Array<
      Omit<WebMCPTool, "execute">
    >;
    const unregisters = definitions.map((definition, index) =>
      registerTool({
        ...definition,
        execute: (args) => {
          const current = toolsRef.current[index];
          if (!current) {
            throw new Error(`Tool "${definition.name}" is no longer available.`);
          }
          return current.execute(args);
        },
      }),
    );
    setIsRegistered(true);
    return () => {
      setIsRegistered(false);
      for (const unregister of unregisters) unregister();
    };
  }, [definitionKey, enabled]);

  return { isRegistered };
}
