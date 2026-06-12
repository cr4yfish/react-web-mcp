/**
 * Verbose mode + diagnostics stream. The package must never fail silently:
 * every lifecycle anomaly is funneled through {@link reportWebMCP}, which
 * always notifies subscribers and always sends warnings/errors to the
 * console. Info-level lifecycle logs (registrations, invocations, responses)
 * reach the console only in verbose mode — enable it on debug/test pages
 * with `setWebMCPVerbose(true)`.
 */

export type WebMCPDiagnosticLevel = "info" | "warn" | "error";

export type WebMCPDiagnosticCode =
  /* core */
  | "unsupported"
  | "register"
  | "unregister"
  | "register-failed"
  | "execute"
  | "execute-result"
  | "execute-error"
  | "invalid-arguments"
  | "result-truncated"
  | "invalid-definition"
  | "provide-context-failed"
  /* declarative form lifecycle */
  | "agent-submit"
  | "agent-response"
  | "agent-response-error"
  | "respondwith-missing"
  | "agent-submit-navigation"
  | "invocation-pending"
  | "invocation-overlap"
  | "invocation-timeout"
  | "invocation-canceled";

export interface WebMCPDiagnostic {
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

let verbose = false;
const listeners = new Set<DiagnosticListener>();

/**
 * Enables/disables verbose mode. When enabled, info-level lifecycle
 * diagnostics (tool registration, invocations, agent submissions, responses)
 * are logged to the console with a `[webmcp]` prefix. Warnings and errors
 * are logged regardless of this flag.
 */
export function setWebMCPVerbose(enabled: boolean): void {
  verbose = enabled;
}

/** True when verbose mode is on. */
export function isWebMCPVerbose(): boolean {
  return verbose;
}

/**
 * Subscribes to every diagnostic the package emits (all levels, independent
 * of verbose mode) — ideal for rendering an on-page debug log next to the
 * tools being tested. Returns an unsubscribe function.
 */
export function onWebMCPDiagnostic(listener: DiagnosticListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Internal reporting funnel. Listeners always receive the diagnostic;
 * console output depends on the level (`error`/`warn` always, `info` only
 * in verbose mode). A throwing listener can never break tool execution.
 */
export function reportWebMCP(diagnostic: WebMCPDiagnostic): void {
  for (const listener of listeners) {
    try {
      listener(diagnostic);
    } catch {
      // A diagnostics consumer must never break the page.
    }
  }
  if (typeof console === "undefined") return;
  const tag = diagnostic.toolName ? `[webmcp:${diagnostic.toolName}]` : "[webmcp]";
  const args: unknown[] =
    diagnostic.detail === undefined
      ? [`${tag} ${diagnostic.message}`]
      : [`${tag} ${diagnostic.message}`, diagnostic.detail];
  if (diagnostic.level === "error") {
    console.error(...args);
  } else if (diagnostic.level === "warn") {
    console.warn(...args);
  } else if (verbose) {
    console.info(...args);
  }
}

/** Truncates free-form text destined for diagnostics so an oversized tool
 * result can never flood a console or an on-page log. */
export function clipDiagnosticText(text: string, maxLength = 400): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}… [+${text.length - maxLength} chars]` : text;
}
