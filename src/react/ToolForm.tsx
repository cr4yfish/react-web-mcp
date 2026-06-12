import {
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  createElement,
  forwardRef,
} from "react";
import { normalizeResult, textResult } from "../core";
import type { ToolExecuteResult, WebMCPSubmitEvent } from "../types";

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
 * are re-validated in {@link handleSubmit} via `reportValidity()`, so users
 * still get the browser's inline validation UI.
 */
export const ToolForm = forwardRef<HTMLFormElement, ToolFormProps>(
  function ToolForm(
    { name, description, autoSubmit, onAgentSubmit, onSubmit, children, ...rest },
    ref,
  ) {
    const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
      const form = event.currentTarget;
      const native = event.nativeEvent as WebMCPSubmitEvent;
      const isAgentSubmit =
        Boolean(native.agentInvoked) && typeof native.respondWith === "function";

      if (!isAgentSubmit) {
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
      if (!onAgentSubmit || typeof native.respondWith !== "function") return;

      // respondWith requires preventDefault to be called first.
      event.preventDefault();
      const data = new FormData(form);
      native.respondWith(
        (async () => {
          try {
            return normalizeResult(await onAgentSubmit(data, event));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return textResult(`Tool "${name}" failed: ${message}`, true);
          }
        })(),
      );
    };

    return createElement(
      "form",
      {
        ...rest,
        ref,
        onSubmit: handleSubmit,
        // See the component doc: disable native constraint validation so an
        // agent-filled invalid field can't silently block submission and strand
        // the invocation. Human submits are re-validated in handleSubmit.
        noValidate: true,
        toolname: name,
        tooldescription: description,
        ...(autoSubmit ? { toolautosubmit: "" } : {}),
      },
      children,
    );
  },
);
