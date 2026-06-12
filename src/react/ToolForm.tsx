import {
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
  createElement,
  forwardRef,
} from "react";
import { normalizeResult } from "../core";
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
 */
export const ToolForm = forwardRef<HTMLFormElement, ToolFormProps>(
  function ToolForm(
    { name, description, autoSubmit, onAgentSubmit, onSubmit, children, ...rest },
    ref,
  ) {
    const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
      onSubmit?.(event);
      if (!onAgentSubmit || event.defaultPrevented) return;

      const native = event.nativeEvent as WebMCPSubmitEvent;
      if (!native.agentInvoked || typeof native.respondWith !== "function") return;

      // respondWith requires preventDefault to be called first.
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      native.respondWith(
        Promise.resolve(onAgentSubmit(data, event)).then(normalizeResult),
      );
    };

    return createElement(
      "form",
      {
        ...rest,
        ref,
        onSubmit: handleSubmit,
        toolname: name,
        tooldescription: description,
        ...(autoSubmit ? { toolautosubmit: "" } : {}),
      },
      children,
    );
  },
);
