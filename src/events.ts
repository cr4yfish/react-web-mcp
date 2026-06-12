/**
 * WebMCP lifecycle event plumbing.
 *
 * The spec/explainer describe `toolchange`, `toolactivated`, and
 * `toolcanceled` as ModelContext events, but Chromium's shipping
 * implementation differs in two ways this module papers over:
 *
 * 1. **Target**: `toolactivated` and the cancel event are dispatched at the
 *    `window`, not at the ModelContext object (only `toolchange` fires at the
 *    ModelContext). Listeners attached only to the ModelContext never fire.
 * 2. **Name**: Chromium's cancel event is named `toolcancel`, while the
 *    explainer (and this package's public API) use `toolcanceled`.
 *
 * `addWebMCPEventListener` therefore attaches to both targets and both
 * spellings, and dedupes per event object so a future implementation that
 * fires on both surfaces can't double-invoke a handler.
 */
import { getModelContext } from "./core";

/** Spec-facing event names accepted by this package. */
export type WebMCPEventName = "toolchange" | "toolactivated" | "toolcanceled";

/** A WebMCP lifecycle event. Chromium's `WebMCPEvent` carries the name of
 * the tool concerned in `toolName` (empty/undefined on older builds). */
export type WebMCPToolEvent = Event & { readonly toolName?: string };

const EVENT_NAME_ALIASES: Record<WebMCPEventName, readonly string[]> = {
  toolchange: ["toolchange"],
  toolactivated: ["toolactivated"],
  // Chromium ships "toolcancel"; the explainer says "toolcanceled".
  toolcanceled: ["toolcanceled", "toolcancel"],
};

/**
 * Subscribes to a WebMCP lifecycle event on every surface current
 * implementations use (window + ModelContext, all name variants), invoking
 * `handler` exactly once per event. Returns an unsubscribe function.
 * No-op (returns a no-op unsubscriber) during SSR or without WebMCP.
 */
export function addWebMCPEventListener(
  name: WebMCPEventName,
  handler: (event: WebMCPToolEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const targets: EventTarget[] = [];
  const context = getModelContext();
  if (context && typeof context.addEventListener === "function") {
    targets.push(context);
  }
  targets.push(window);

  const seen = new WeakSet<Event>();
  const listener = (event: Event) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event as WebMCPToolEvent);
  };

  const names = EVENT_NAME_ALIASES[name] ?? [name];
  for (const target of targets) {
    for (const eventName of names) {
      target.addEventListener(eventName, listener);
    }
  }
  return () => {
    for (const target of targets) {
      for (const eventName of names) {
        target.removeEventListener(eventName, listener);
      }
    }
  };
}
