import {
  type ForwardedRef,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  createElement,
  forwardRef,
  useEffect,
  useRef,
} from "react";
import { normalizeResult, textResult } from "../core";
import { clipDiagnosticText, reportWebMCP } from "../debug";
import { addWebMCPEventListener } from "../events";
import { injectWebMCPIndicatorStyles } from "../indicators";
import type { ToolExecuteResult, WebMCPSubmitEvent } from "../types";

/**
 * How long an agent invocation may sit unanswered (form filled, waiting for
 * the user's review submit) before the form auto-cancels it via `reset()`.
 *
 * Chromium keeps exactly ONE pending invocation per declarative form. If the
 * tool is invoked again while one is pending, the browser silently drops the
 * previous invocation's internal reply callback — which closes the page's
 * WebMCP channel and kills EVERY tool on the page until reload. A stale
 * pending invocation is therefore a landmine; `form.reset()` is the
 * sanctioned page-side cancel (the agent receives a proper "cancelled by a
 * form reset" error and the channel stays healthy).
 */
export const DEFAULT_PENDING_TIMEOUT_MS = 120_000;

interface PendingState {
  pending: boolean;
  since: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface ToolFormProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "toolname" | "tooldescription" | "toolautosubmit"> {
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
  onAgentSubmit?: (
    data: FormData,
    event: FormEvent<HTMLFormElement>,
  ) => ToolExecuteResult | Promise<ToolExecuteResult>;
  /**
   * Opt-in visual indicators for the agent-filled/awaiting-review state:
   * injects a small stylesheet (once per page) that highlights the form and
   * its submit button via the native `:tool-form-active` pseudo-class, with a
   * `data-webmcp-active="true"` attribute fallback maintained by this
   * component. Override the color with `--webmcp-indicator-color`, or style
   * those selectors yourself and leave this off.
   */
  indicators?: boolean;
  /**
   * Watchdog for stale invocations: when an agent invocation has been
   * pending (form filled, no user submit) for this long, the form is
   * `reset()`, which makes the browser cancel the invocation *properly* —
   * the agent gets a "cancelled" error and, crucially, the page's WebMCP
   * channel survives. Without it, a second invocation arriving on top of a
   * stale one makes Chromium drop the old invocation's reply callback and
   * silently disables every tool on the page until reload.
   * Milliseconds; default {@link DEFAULT_PENDING_TIMEOUT_MS}. Set `0` to
   * disable (not recommended).
   */
  pendingTimeoutMs?: number;
  /**
   * Reset the form after an agent submission has been answered, so the next
   * invocation starts from a clean slate. The reset is deferred a tick so it
   * can never race the browser's response delivery (a reset while the
   * response is still in flight would cancel it). Default `false`.
   */
  resetAfterAgentSubmit?: boolean;
  /**
   * Observes the pending state (`true` while an agent has filled the form
   * and a user review/submit is awaited; `false` once answered, cancelled,
   * or reset). Useful for rendering custom "review this form" UI.
   */
  onPendingChange?: (pending: boolean) => void;
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
 * are re-validated in the submit handler via `reportValidity()`, so users
 * still get the browser's inline validation UI.
 *
 * Lifecycle safety: the component tracks the browser's `toolactivated` /
 * `toolcanceled` events and the form's `reset` events to know when an
 * invocation is pending, warns loudly when invocations overlap (the
 * channel-killing scenario described on {@link ToolFormProps.pendingTimeoutMs}),
 * and auto-cancels stale invocations via `form.reset()`.
 */
export const ToolForm = forwardRef<HTMLFormElement, ToolFormProps>(
  function ToolForm(
    {
      name,
      description,
      autoSubmit,
      onAgentSubmit,
      onSubmit,
      indicators,
      pendingTimeoutMs = DEFAULT_PENDING_TIMEOUT_MS,
      resetAfterAgentSubmit,
      onPendingChange,
      children,
      ...rest
    },
    forwardedRef: ForwardedRef<HTMLFormElement>,
  ) {
    const formRef = useRef<HTMLFormElement | null>(null);
    const pendingRef = useRef<PendingState>({ pending: false, since: 0, timer: null });

    // Latest props for the long-lived event subscriptions below, so they
    // never observe stale closures and never need to re-subscribe.
    const latest = useRef({ name, pendingTimeoutMs, resetAfterAgentSubmit, onPendingChange });
    latest.current = { name, pendingTimeoutMs, resetAfterAgentSubmit, onPendingChange };

    const setRefs = (node: HTMLFormElement | null) => {
      formRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const setPendingAttribute = (on: boolean) => {
      const form = formRef.current;
      if (!form) return;
      if (on) form.setAttribute("data-webmcp-active", "true");
      else form.removeAttribute("data-webmcp-active");
    };

    /** Ends the pending state (idempotent); stops the watchdog. */
    const clearPending = () => {
      const state = pendingRef.current;
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      if (!state.pending) return;
      state.pending = false;
      setPendingAttribute(false);
      latest.current.onPendingChange?.(false);
    };

    /** Starts (or restarts) the pending state and its watchdog. */
    const beginPending = () => {
      const state = pendingRef.current;
      const wasPending = state.pending;
      if (state.timer) clearTimeout(state.timer);
      state.pending = true;
      state.since = Date.now();
      setPendingAttribute(true);
      if (!wasPending) latest.current.onPendingChange?.(true);

      const timeout = latest.current.pendingTimeoutMs;
      if (timeout > 0) {
        state.timer = setTimeout(() => {
          state.timer = null;
          if (!pendingRef.current.pending) return;
          const form = formRef.current;
          reportWebMCP({
            level: "warn",
            code: "invocation-timeout",
            message:
              `Agent invocation still unanswered after ${timeout}ms — cancelling it via form.reset() ` +
              "so the page's WebMCP channel stays healthy. The agent receives a 'cancelled' error.",
            toolName: latest.current.name,
          });
          if (form?.isConnected) {
            form.reset(); // The browser cancels the invocation; our reset listener clears state.
          } else {
            clearPending();
          }
        }, timeout);
      }

      // Self-correct against the browser's ground truth: for `toolautosubmit`
      // forms the invocation may already be answered by the time
      // `toolactivated` reaches us (the submit happens synchronously during
      // the fill, the event afterwards).
      setTimeout(() => {
        const form = formRef.current;
        if (!form || !pendingRef.current.pending) return;
        try {
          if (!form.matches(":tool-form-active")) clearPending();
        } catch {
          // Pseudo-class not supported (non-WebMCP browser / jsdom): keep
          // our own bookkeeping.
        }
      }, 0);
    };

    /** Whether a toolactivated/toolcanceled event concerns this form. */
    const concernsThisForm = (event: Event, whenUnknown: () => boolean): boolean => {
      const toolName = (event as Event & { toolName?: string }).toolName;
      if (typeof toolName === "string" && toolName.length > 0) {
        return toolName === latest.current.name;
      }
      // Old builds without WebMCPEvent.toolName: fall back to local signals.
      return whenUnknown();
    };

    useEffect(() => {
      const removeActivated = addWebMCPEventListener("toolactivated", (event) => {
        const matchedByState = () => {
          const form = formRef.current;
          if (!form) return false;
          try {
            return form.matches(":tool-form-active");
          } catch {
            return true; // Cannot tell — assume ours rather than miss it.
          }
        };
        if (!concernsThisForm(event, matchedByState)) return;

        if (pendingRef.current.pending) {
          reportWebMCP({
            level: "error",
            code: "invocation-overlap",
            message:
              "Tool was re-invoked while a previous invocation was still awaiting the user's submit. " +
              "Chromium keeps one pending invocation per form and DROPS the previous reply callback — " +
              "this can close the page's WebMCP channel and silently disable every tool until reload. " +
              "Answer or cancel invocations promptly (keep pendingTimeoutMs enabled, or use autoSubmit " +
              "for low-stakes forms).",
            toolName: latest.current.name,
            detail: { pendingSinceMs: Date.now() - pendingRef.current.since },
          });
        } else {
          reportWebMCP({
            level: "info",
            code: "invocation-pending",
            message:
              "Agent filled the form; awaiting the user's review submit (:tool-form-active is set).",
            toolName: latest.current.name,
          });
        }
        beginPending();
      });

      const removeCanceled = addWebMCPEventListener("toolcanceled", (event) => {
        if (!concernsThisForm(event, () => pendingRef.current.pending)) return;
        if (pendingRef.current.pending) {
          reportWebMCP({
            level: "info",
            code: "invocation-canceled",
            message: "The agent cancelled the pending invocation.",
            toolName: latest.current.name,
          });
        }
        clearPending();
      });

      const form = formRef.current;
      const onReset = () => {
        if (pendingRef.current.pending) {
          reportWebMCP({
            level: "info",
            code: "invocation-canceled",
            message:
              "Form was reset while an invocation was pending — the browser cancels the invocation " +
              "and notifies the agent.",
            toolName: latest.current.name,
          });
        }
        clearPending();
      };
      form?.addEventListener("reset", onReset);

      return () => {
        removeActivated();
        removeCanceled();
        form?.removeEventListener("reset", onReset);
        const state = pendingRef.current;
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.pending = false;
      };
      // The subscriptions read everything else through `latest`.
      // biome-ignore lint/correctness/useExhaustiveDependencies: see above
    }, [name]);

    useEffect(() => {
      if (!indicators) return;
      return injectWebMCPIndicatorStyles();
    }, [indicators]);

    /** Post-answer bookkeeping shared by the success and error paths. */
    const finishAnswered = () => {
      clearPending();
      if (!latest.current.resetAfterAgentSubmit) return;
      // Deferred a macrotask: resetting while the browser is still delivering
      // the response would cancel the invocation instead of answering it.
      setTimeout(() => {
        const form = formRef.current;
        if (form?.isConnected && !pendingRef.current.pending) form.reset();
      }, 0);
    };

    const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
      const form = event.currentTarget;
      const native = event.nativeEvent as WebMCPSubmitEvent;
      const respondWith =
        typeof native.respondWith === "function" ? native.respondWith.bind(native) : undefined;
      const isAgentSubmit = Boolean(native.agentInvoked) && respondWith !== undefined;

      if (!isAgentSubmit) {
        if (native.agentInvoked) {
          // agentInvoked without respondWith() support: this page cannot
          // answer in-page. Without preventDefault the form navigates and the
          // response is taken from the target page's ld+json; with a consumer
          // preventDefault the invocation fails browser-side. Never silent:
          reportWebMCP({
            level: "error",
            code: "respondwith-missing",
            message:
              "Agent-invoked submit, but SubmitEvent.respondWith() is unavailable in this browser — " +
              "the invocation cannot be answered in-page.",
            toolName: name,
          });
          onSubmit?.(event);
          return;
        }
        // The form is `noValidate` (so agent submits are never silently
        // blocked); re-apply constraint validation for human submits so they
        // keep the browser's native inline error UI instead of submitting an
        // invalid form. checkValidity()/reportValidity() work regardless of
        // the noValidate attribute.
        if (typeof form.checkValidity === "function" && !form.checkValidity()) {
          event.preventDefault();
          form.reportValidity?.();
          return;
        }
        onSubmit?.(event);
        return;
      }

      // Agent submit: let the consumer observe it, then ALWAYS answer. The
      // promise handed to respondWith must fulfill no matter what — a missing
      // response (whether from a consumer preventDefault, a synchronous throw,
      // or an async rejection in onAgentSubmit) leaves the prevented invocation
      // hanging, which poisons the page's message channel and silences every
      // later tool call.
      onSubmit?.(event);
      if (!onAgentSubmit) {
        reportWebMCP({
          level: "warn",
          code: "agent-submit-navigation",
          message:
            "Agent-invoked submit without an onAgentSubmit handler: the form will perform its " +
            "default submission and the tool response is taken from the target page's " +
            "ld+json. Pass onAgentSubmit to answer in-page without navigating.",
          toolName: name,
        });
        return;
      }

      if (!respondWith) return; // unreachable (isAgentSubmit implies it); narrows the type

      // respondWith requires preventDefault to be called first, and must be
      // called synchronously during dispatch.
      event.preventDefault();
      const data = new FormData(form);
      const startedAt = Date.now();
      reportWebMCP({
        level: "info",
        code: "agent-submit",
        message: "Answering agent-invoked submission via respondWith().",
        toolName: name,
        detail: { fields: Array.from(new Set(data.keys())) },
      });
      respondWith(
        (async () => {
          try {
            const result = normalizeResult(await onAgentSubmit(data, event));
            reportWebMCP({
              level: "info",
              code: "agent-response",
              message: `Agent invocation answered in ${Date.now() - startedAt}ms.`,
              toolName: name,
              detail: clipDiagnosticText(JSON.stringify(result) ?? ""),
            });
            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reportWebMCP({
              level: "error",
              code: "agent-response-error",
              message: `onAgentSubmit failed (answered to the agent as isError): ${message}`,
              toolName: name,
              detail: error,
            });
            return textResult(`Tool "${name}" failed: ${message}`, true);
          } finally {
            finishAnswered();
          }
        })(),
      );
    };

    return createElement(
      "form",
      {
        ...rest,
        ref: setRefs,
        onSubmit: handleSubmit,
        // See the component doc: disable native constraint validation so an
        // agent-filled invalid field can't silently block submission and strand
        // the invocation. Human submits are re-validated in handleSubmit.
        noValidate: true,
        toolname: name,
        tooldescription: description,
        ...(autoSubmit ? { toolautosubmit: "" } : {}),
        ...(indicators ? { "data-webmcp-indicators": "" } : {}),
      },
      children,
    );
  },
);
