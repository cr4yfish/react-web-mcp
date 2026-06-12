import { useSyncExternalStore } from "react";
import { getModelContext, isWebMCPSupported } from "../core";
import type { ModelContext } from "../types";

const noopSubscribe = () => () => {};

/**
 * Reports WebMCP availability in the current browser.
 *
 * Returns `isSupported: false` on the server and during hydration, then the
 * real value after mount — so it is SSR-safe and never causes a hydration
 * mismatch as long as you branch on it consistently.
 */
export function useWebMCP(): {
  isSupported: boolean;
  modelContext: ModelContext | null;
} {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    isWebMCPSupported,
    () => false,
  );
  return { isSupported, modelContext: isSupported ? getModelContext() : null };
}
