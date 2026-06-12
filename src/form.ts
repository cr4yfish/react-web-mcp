/**
 * DOM-based form tooling: derive a WebMCP input schema from a real
 * `<form>` element and fill it back in from tool arguments.
 *
 * Because this inspects the rendered DOM (not the React element tree), it
 * works with any UI library that ultimately renders native form controls —
 * Material UI, Ant Design, shadcn/ui, portals, custom wrappers — without
 * per-library adapters.
 */
import type { JSONSchema } from "./types";

/** Control types that never belong in a tool schema. */
const SKIPPED_INPUT_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  // Never expose passwords to an agent.
  "password",
]);

const FORMAT_BY_INPUT_TYPE: Record<string, string> = {
  email: "email",
  url: "uri",
  date: "date",
  time: "time",
  "datetime-local": "date-time",
};

type NamedControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isNamedControl(element: Element): element is NamedControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function controlDescription(control: NamedControl, form: HTMLFormElement): string | undefined {
  const explicit = control.getAttribute("toolparamdescription");
  if (explicit) return explicit;
  const ariaLabel = control.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  if (control.id) {
    const label = form.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    const text = label?.textContent?.trim();
    if (text) return text;
  }
  const placeholder = control.getAttribute("placeholder");
  return placeholder ?? undefined;
}

function numberOrUndefined(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function schemaForControl(
  control: NamedControl,
  group: NamedControl[],
): JSONSchema | null {
  if (control instanceof HTMLSelectElement) {
    const values = Array.from(control.options)
      .map((option) => option.value)
      .filter((value) => value !== "");
    const item: JSONSchema = values.length > 0 ? { type: "string", enum: values } : { type: "string" };
    return control.multiple ? { type: "array", items: item } : item;
  }

  if (control instanceof HTMLTextAreaElement) {
    const schema: JSONSchema = { type: "string" };
    if (control.maxLength > 0) schema.maxLength = control.maxLength;
    if (control.minLength > 0) schema.minLength = control.minLength;
    return schema;
  }

  const type = control.type;
  if (SKIPPED_INPUT_TYPES.has(type)) return null;

  if (type === "radio") {
    const values = group
      .filter((c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === "radio")
      .map((c) => c.value);
    return values.length > 0 ? { type: "string", enum: values } : { type: "string" };
  }
  if (type === "checkbox") return { type: "boolean" };
  if (type === "number" || type === "range") {
    const schema: JSONSchema = { type: "number" };
    const min = numberOrUndefined(control.min);
    const max = numberOrUndefined(control.max);
    if (min !== undefined) schema.minimum = min;
    if (max !== undefined) schema.maximum = max;
    return schema;
  }

  const schema: JSONSchema = { type: "string" };
  const format = FORMAT_BY_INPUT_TYPE[type];
  if (format) schema.format = format;
  if (control.maxLength > 0) schema.maxLength = control.maxLength;
  if (control.minLength > 0) schema.minLength = control.minLength;
  if (control.pattern) schema.pattern = control.pattern;
  return schema;
}

/**
 * Builds a JSON Schema describing a form's named controls, mirroring what
 * the declarative WebMCP API synthesizes natively: control `name`s become
 * properties, `required` controls become required properties, and
 * `toolparamdescription` / `aria-label` / `<label for>` / `placeholder`
 * provide descriptions. Hidden, file, button, and password controls are
 * skipped (passwords must never reach an agent).
 */
export function extractFormSchema(form: HTMLFormElement): JSONSchema {
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];
  const byName = new Map<string, NamedControl[]>();

  for (const element of Array.from(form.elements)) {
    if (!isNamedControl(element) || !element.name || element.disabled) continue;
    const list = byName.get(element.name) ?? [];
    list.push(element);
    byName.set(element.name, list);
  }

  for (const [name, group] of byName) {
    const first = group[0];
    if (!first) continue;
    const schema = schemaForControl(first, group);
    if (!schema) continue;
    const description = controlDescription(first, form);
    if (description && schema.description === undefined) {
      schema.description = description;
    }
    properties[name] = schema;
    if (group.some((control) => control.required)) required.push(name);
  }

  const result: JSONSchema = { type: "object", properties };
  if (required.length > 0) result.required = required;
  return result;
}

function setNativeValue(control: NamedControl, value: string): void {
  // Use the prototype's value setter so React's controlled-component value
  // tracker registers the change when the input event fires.
  const prototype = Object.getPrototypeOf(control) as object;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(control, value);
  } else {
    control.value = value;
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Fills a form's named controls from a tool-arguments object, dispatching
 * the events React (and other frameworks) need to pick the values up.
 * Returns the names of arguments that could not be applied.
 */
export function applyArgsToForm(
  form: HTMLFormElement,
  args: Record<string, unknown>,
): string[] {
  const unapplied: string[] = [];

  for (const [name, value] of Object.entries(args)) {
    const controls = Array.from(form.elements).filter(
      (element): element is NamedControl =>
        isNamedControl(element) && element.name === name && !element.disabled,
    );
    const first = controls[0];
    if (!first) {
      unapplied.push(name);
      continue;
    }

    if (first instanceof HTMLInputElement && first.type === "radio") {
      const match = controls.find(
        (c): c is HTMLInputElement =>
          c instanceof HTMLInputElement && c.value === String(value),
      );
      if (match) {
        if (!match.checked) match.click();
      } else {
        unapplied.push(name);
      }
      continue;
    }

    if (first instanceof HTMLInputElement && first.type === "checkbox") {
      const desired = value === true || value === "true";
      if (first.checked !== desired) first.click();
      continue;
    }

    if (first instanceof HTMLSelectElement && first.multiple) {
      const values = Array.isArray(value) ? value.map(String) : [String(value)];
      for (const option of Array.from(first.options)) {
        option.selected = values.includes(option.value);
      }
      first.dispatchEvent(new Event("change", { bubbles: true }));
      continue;
    }

    setNativeValue(first, String(value));
  }

  return unapplied;
}
