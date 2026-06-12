import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { registerTool, textResult } from "../core";
import { applyArgsToForm, extractFormSchema } from "../form";
import type { ToolAnnotations, ToolExecuteResult } from "../types";

export interface UseFormToolOptions {
  /** Ref to the form element (any UI library that renders a native form). */
  formRef: RefObject<HTMLFormElement | null>;
  /** Unique, descriptive tool name. */
  name: string;
  /** Natural-language description the agent uses to pick the tool. */
  description: string;
  /**
   * Submit the form (`requestSubmit()`) after filling it. Default `false`:
   * the filled form is left for the user to review and submit — the same
   * human-in-the-loop default as the declarative API's missing
   * `toolautosubmit`.
   */
  autoSubmit?: boolean;
  /**
   * Handle the invocation yourself after the form has been filled, instead
   * of submitting/focusing. Receives the parsed arguments; the return value
   * is sent to the agent.
   */
  onToolCall?: (
    args: Record<string, unknown>,
    form: HTMLFormElement,
  ) => ToolExecuteResult | Promise<ToolExecuteResult>;
  /** Behavioral hints for agents/browsers. */
  annotations?: ToolAnnotations;
  /** Set to `false` to unregister without unmounting. Default `true`. */
  enabled?: boolean;
}

/**
 * Registers an imperative WebMCP tool whose input schema is derived from a
 * real, rendered `<form>` element in the DOM.
 *
 * Unlike React-tree adapters, this works with **any** component library that
 * renders native form controls (Material UI, Ant Design, shadcn/ui, portals,
 * custom wrappers): the schema comes from `form.elements` — control `name`s,
 * `required`, types, `min`/`max`, select options, and descriptions from
 * `toolparamdescription` / `aria-label` / `<label for>` / `placeholder`.
 * Password, hidden, and file inputs are never exposed.
 *
 * When the agent calls the tool, the form is filled using native value
 * setters + `input`/`change` events (so controlled React inputs update),
 * then either submitted (`autoSubmit`), handled by `onToolCall`, or left
 * focused for the user to review.
 *
 * The schema is captured when the form mounts (and when the definition or
 * `enabled` changes). For forms whose fields change dynamically, call the
 * returned `refresh()` after the change.
 */
export function useFormTool(options: UseFormToolOptions): {
  isRegistered: boolean;
  /** Re-extracts the schema from the current DOM and re-registers. */
  refresh: () => void;
} {
  const {
    formRef,
    name,
    description,
    autoSubmit = false,
    onToolCall,
    annotations,
    enabled = true,
  } = options;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isRegistered, setIsRegistered] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((n) => n + 1), []);

  const definitionKey = JSON.stringify({ name, description, autoSubmit, annotations });

  useEffect(() => {
    const form = formRef.current;
    if (!enabled || !form) {
      setIsRegistered(false);
      return;
    }

    const unregister = registerTool({
      name,
      description,
      inputSchema: extractFormSchema(form),
      annotations,
      async execute(args: Record<string, unknown>) {
        const currentForm = optionsRef.current.formRef.current;
        if (!currentForm) {
          return textResult(`Tool "${name}" is no longer available on this page.`, true);
        }
        const unapplied = applyArgsToForm(currentForm, args);
        if (unapplied.length > 0) {
          return textResult(
            `Unknown form field(s): ${unapplied.join(", ")}. Re-check the tool's input schema.`,
            true,
          );
        }
        if (optionsRef.current.onToolCall) {
          return optionsRef.current.onToolCall(args, currentForm);
        }
        if (optionsRef.current.autoSubmit) {
          currentForm.requestSubmit();
          return textResult("Form filled out and submitted.");
        }
        // Human-in-the-loop default: hand control back to the user.
        const submitter = currentForm.querySelector<HTMLElement>(
          'button[type="submit"], input[type="submit"]',
        );
        submitter?.focus();
        return textResult(
          "Form filled out. The user must review and submit it manually.",
        );
      },
    });
    setIsRegistered(true);

    return () => {
      setIsRegistered(false);
      unregister();
    };
    // definitionKey covers name/description/autoSubmit/annotations.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  }, [definitionKey, enabled, refreshCount, formRef]);

  return { isRegistered, refresh };
}
