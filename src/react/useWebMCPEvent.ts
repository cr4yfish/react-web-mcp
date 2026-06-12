import { useEffect, useRef } from "react";
import { getModelContext } from "../core";

/** Events fired at the ModelContext object by the browser. */
export type WebMCPEventName = "toolchange" | "toolactivated" | "toolcanceled";

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
export function useWebMCPEvent(
  event: WebMCPEventName,
  handler: (event: Event) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const context = getModelContext();
    if (!context || typeof context.addEventListener !== "function") return;
    const listener = (e: Event) => handlerRef.current(e);
    context.addEventListener(event, listener);
    return () => context.removeEventListener(event, listener);
  }, [event]);
}
