import { useEffect, useRef } from "react";
import { addWebMCPEventListener, type WebMCPEventName, type WebMCPToolEvent } from "../events";

export type { WebMCPEventName };

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
export function useWebMCPEvent(
  event: WebMCPEventName,
  handler: (event: WebMCPToolEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return addWebMCPEventListener(event, (e) => handlerRef.current(e));
  }, [event]);
}
