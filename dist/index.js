"use client";

// src/debug.ts
var verbose = false;
var listeners = /* @__PURE__ */ new Set();
function setWebMCPVerbose(enabled) {
  verbose = enabled;
}
function isWebMCPVerbose() {
  return verbose;
}
function onWebMCPDiagnostic(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function reportWebMCP(diagnostic) {
  for (const listener of listeners) {
    try {
      listener(diagnostic);
    } catch {
    }
  }
  if (typeof console === "undefined") return;
  const tag = diagnostic.toolName ? `[webmcp:${diagnostic.toolName}]` : "[webmcp]";
  const args = diagnostic.detail === void 0 ? [`${tag} ${diagnostic.message}`] : [`${tag} ${diagnostic.message}`, diagnostic.detail];
  if (diagnostic.level === "error") {
    console.error(...args);
  } else if (diagnostic.level === "warn") {
    console.warn(...args);
  } else if (verbose) {
    console.info(...args);
  }
}
function clipDiagnosticText(text, maxLength = 400) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}\u2026 [+${text.length - maxLength} chars]` : text;
}

// src/validate.ts
var SKIP_KEYWORDS = ["$ref", "anyOf", "oneOf", "allOf", "not", "if"];
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function matchesType(value, type) {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}
function validateNode(value, schema, path, problems, depth) {
  if (depth > 32) return;
  if (!isPlainObject(schema)) return;
  if (SKIP_KEYWORDS.some((keyword) => schema[keyword] !== void 0)) return;
  const label = path === "" ? "arguments" : `"${path}"`;
  if (schema.type !== void 0) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const stringTypes = types.filter((t) => typeof t === "string");
    if (stringTypes.length > 0 && !stringTypes.some((type) => matchesType(value, type))) {
      problems.push(
        `${label} must be of type ${stringTypes.join(" | ")} (got ${describe(value)})`
      );
      return;
    }
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (!schema.enum.some((allowed) => allowed === value)) {
      problems.push(
        `${label} must be one of: ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`
      );
      return;
    }
  }
  if (schema.const !== void 0 && schema.const !== value) {
    problems.push(`${label} must be ${JSON.stringify(schema.const)}`);
    return;
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      problems.push(`${label} must be at least ${schema.minLength} characters`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      problems.push(`${label} must be at most ${schema.maxLength} characters`);
    }
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          problems.push(`${label} must match pattern ${schema.pattern}`);
        }
      } catch {
      }
    }
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      problems.push(`${label} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      problems.push(`${label} must be <= ${schema.maximum}`);
    }
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
      problems.push(`${label} must be > ${schema.exclusiveMinimum}`);
    }
    if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
      problems.push(`${label} must be < ${schema.exclusiveMaximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      problems.push(`${label} must have at least ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      problems.push(`${label} must have at most ${schema.maxItems} items`);
    }
    if (isPlainObject(schema.items)) {
      value.forEach((item, index) => {
        validateNode(
          item,
          schema.items,
          path === "" ? `[${index}]` : `${path}[${index}]`,
          problems,
          depth + 1
        );
      });
    }
  }
  if (isPlainObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === "string" && value[key] === void 0) {
          problems.push(`missing required argument "${path === "" ? key : `${path}.${key}`}"`);
        }
      }
    }
    if (isPlainObject(schema.properties)) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (value[key] !== void 0) {
          validateNode(
            value[key],
            propertySchema,
            path === "" ? key : `${path}.${key}`,
            problems,
            depth + 1
          );
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in schema.properties)) {
            problems.push(`unexpected argument "${path === "" ? key : `${path}.${key}`}"`);
          }
        }
      }
    }
  }
}
function validateToolInput(args, schema) {
  if (!isPlainObject(schema)) return [];
  const problems = [];
  const value = args === void 0 && (schema.type === "object" || schema.properties) ? {} : args;
  validateNode(value, schema, "", problems, 0);
  return problems;
}

// src/core.ts
var DEFAULT_MAX_RESULT_LENGTH = 5e4;
function getModelContext() {
  if (typeof document !== "undefined" && document.modelContext) {
    return document.modelContext;
  }
  if (typeof navigator !== "undefined" && navigator.modelContext) {
    return navigator.modelContext;
  }
  return null;
}
function isWebMCPSupported() {
  return getModelContext() !== null;
}
function isWebMCPTestingSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.modelContextTesting);
}
function validateTool(tool) {
  let problem = null;
  if (typeof tool.name !== "string" || tool.name.length === 0) {
    problem = "Tool name must be a non-empty string.";
  } else if (typeof tool.description !== "string" || tool.description.length === 0) {
    problem = `Tool "${tool.name}" needs a non-empty description.`;
  } else if (tool.inputSchema !== void 0) {
    try {
      JSON.stringify(tool.inputSchema);
    } catch {
      problem = `Tool "${tool.name}" has a non-JSON-serializable inputSchema.`;
    }
  }
  if (problem === null) return true;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    throw new TypeError(`WebMCP: ${problem}`);
  }
  reportWebMCP({ level: "error", code: "invalid-definition", message: problem });
  return false;
}
function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], ...isError ? { isError: true } : {} };
}
function jsonResult(value, maxLength = DEFAULT_MAX_RESULT_LENGTH) {
  let text;
  try {
    text = JSON.stringify(value) ?? "null";
  } catch {
    return textResult("Error: tool result could not be serialized to JSON.", true);
  }
  if (maxLength > 0 && text.length > maxLength) {
    reportWebMCP({
      level: "warn",
      code: "result-truncated",
      message: `Tool result truncated from ${text.length} to ${maxLength} characters.`
    });
    text = `${text.slice(0, maxLength)}\u2026 [truncated ${text.length - maxLength} characters]`;
  }
  return { content: [{ type: "text", text }] };
}
function isToolResponse(value) {
  return typeof value === "object" && value !== null && Array.isArray(value.content);
}
function normalizeResult(value) {
  if (isToolResponse(value)) return value;
  if (value === void 0 || value === null) return textResult("OK");
  if (typeof value === "string") return textResult(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return textResult(String(value));
  }
  return jsonResult(value);
}
function wrapExecute(tool) {
  const { validateInput = true, ...descriptor } = tool;
  return {
    ...descriptor,
    async execute(args) {
      reportWebMCP({
        level: "info",
        code: "execute",
        message: "Tool invoked by an agent.",
        toolName: tool.name,
        detail: isWebMCPVerbose() ? args : void 0
      });
      if (validateInput) {
        const problems = validateToolInput(args, tool.inputSchema);
        if (problems.length > 0) {
          reportWebMCP({
            level: "warn",
            code: "invalid-arguments",
            message: `Rejected agent call with invalid arguments: ${problems.join("; ")}`,
            toolName: tool.name
          });
          return textResult(
            `Invalid arguments for tool "${tool.name}": ${problems.join("; ")}`,
            true
          );
        }
      }
      try {
        const result = await tool.execute(args);
        reportWebMCP({
          level: "info",
          code: "execute-result",
          message: "Tool answered the agent.",
          toolName: tool.name,
          detail: isWebMCPVerbose() ? clipDiagnosticText(safeStringify(result)) : void 0
        });
        return tool.outputSchema ? result : normalizeResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reportWebMCP({
          level: "error",
          code: "execute-error",
          message: `execute() threw (answered to the agent as isError): ${message}`,
          toolName: tool.name,
          detail: error
        });
        return textResult(`Tool "${tool.name}" failed: ${message}`, true);
      }
    }
  };
}
function registerTool(tool, options = {}) {
  if (!validateTool(tool)) return () => {
  };
  const context = getModelContext();
  if (!context) {
    reportWebMCP({
      level: "info",
      code: "unsupported",
      message: "WebMCP is unavailable in this environment; registerTool() is a no-op.",
      toolName: tool.name
    });
    return () => {
    };
  }
  const controller = new AbortController();
  const { signal: outerSignal, ...rest } = options;
  if (outerSignal) {
    if (outerSignal.aborted) return () => {
    };
    outerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  let registered = true;
  try {
    const result = context.registerTool(wrapExecute(tool), {
      ...rest,
      signal: controller.signal
    });
    if (result instanceof Promise) {
      result.catch((error) => {
        registered = false;
        reportWebMCP({
          level: "error",
          code: "register-failed",
          message: `Failed to register tool (e.g. NotAllowedError under Permissions Policy): ${String(error)}`,
          toolName: tool.name,
          detail: error
        });
      });
    }
  } catch (error) {
    reportWebMCP({
      level: "error",
      code: "register-failed",
      message: `registerTool() threw: ${String(error)}`,
      toolName: tool.name,
      detail: error
    });
    return () => {
    };
  }
  reportWebMCP({
    level: "info",
    code: "register",
    message: "Tool registered.",
    toolName: tool.name
  });
  return () => {
    if (!registered) return;
    registered = false;
    controller.abort();
    try {
      context.unregisterTool?.(tool.name);
    } catch {
    }
    reportWebMCP({
      level: "info",
      code: "unregister",
      message: "Tool unregistered.",
      toolName: tool.name
    });
  };
}
function provideContext(tools) {
  tools = tools.filter(validateTool);
  const context = getModelContext();
  if (!context) return () => {
  };
  if (typeof context.provideContext === "function") {
    try {
      context.provideContext({ tools: tools.map((t) => wrapExecute(t)) });
    } catch (error) {
      reportWebMCP({
        level: "error",
        code: "provide-context-failed",
        message: `provideContext() threw: ${String(error)}`,
        detail: error
      });
      return () => {
      };
    }
    return () => {
      try {
        context.clearContext ? context.clearContext() : context.provideContext?.({ tools: [] });
      } catch {
      }
    };
  }
  const unregisters = tools.map((tool) => registerTool(tool));
  return () => {
    for (const unregister of unregisters) unregister();
  };
}
function safeStringify(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
function toolFormAttrs(options) {
  const attrs = {
    toolname: options.name,
    tooldescription: options.description
  };
  if (options.autoSubmit) attrs.toolautosubmit = "";
  return attrs;
}
function toolParamAttrs(description) {
  return { toolparamdescription: description };
}

// src/form.ts
var SKIPPED_INPUT_TYPES = /* @__PURE__ */ new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  // Never expose passwords to an agent.
  "password"
]);
var FORMAT_BY_INPUT_TYPE = {
  email: "email",
  url: "uri",
  date: "date",
  time: "time",
  "datetime-local": "date-time"
};
function isNamedControl(element) {
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
}
function controlDescription(control, form) {
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
  return placeholder ?? void 0;
}
function numberOrUndefined(value) {
  if (value === "") return void 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function schemaForControl(control, group) {
  if (control instanceof HTMLSelectElement) {
    const values = Array.from(control.options).map((option) => option.value).filter((value) => value !== "");
    const item = values.length > 0 ? { type: "string", enum: values } : { type: "string" };
    return control.multiple ? { type: "array", items: item } : item;
  }
  if (control instanceof HTMLTextAreaElement) {
    const schema2 = { type: "string" };
    if (control.maxLength > 0) schema2.maxLength = control.maxLength;
    if (control.minLength > 0) schema2.minLength = control.minLength;
    return schema2;
  }
  const type = control.type;
  if (SKIPPED_INPUT_TYPES.has(type)) return null;
  if (type === "radio") {
    const values = group.filter((c) => c instanceof HTMLInputElement && c.type === "radio").map((c) => c.value);
    return values.length > 0 ? { type: "string", enum: values } : { type: "string" };
  }
  if (type === "checkbox") return { type: "boolean" };
  if (type === "number" || type === "range") {
    const schema2 = { type: "number" };
    const min = numberOrUndefined(control.min);
    const max = numberOrUndefined(control.max);
    if (min !== void 0) schema2.minimum = min;
    if (max !== void 0) schema2.maximum = max;
    return schema2;
  }
  const schema = { type: "string" };
  const format = FORMAT_BY_INPUT_TYPE[type];
  if (format) schema.format = format;
  if (control.maxLength > 0) schema.maxLength = control.maxLength;
  if (control.minLength > 0) schema.minLength = control.minLength;
  if (control.pattern) schema.pattern = control.pattern;
  return schema;
}
function extractFormSchema(form) {
  const properties = {};
  const required = [];
  const byName = /* @__PURE__ */ new Map();
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
    if (description && schema.description === void 0) {
      schema.description = description;
    }
    properties[name] = schema;
    if (group.some((control) => control.required)) required.push(name);
  }
  const result = {
    type: "object",
    properties,
    additionalProperties: false
  };
  if (required.length > 0) result.required = required;
  return result;
}
function setNativeValue(control, value) {
  const prototype = Object.getPrototypeOf(control);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(control, value);
  } else {
    control.value = value;
  }
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}
function applyArgsToForm(form, args) {
  const unapplied = [];
  for (const [name, value] of Object.entries(args)) {
    const controls = Array.from(form.elements).filter(
      (element) => isNamedControl(element) && element.name === name && !element.disabled
    );
    const first = controls[0];
    if (!first) {
      unapplied.push(name);
      continue;
    }
    if (first instanceof HTMLInputElement && first.type === "radio") {
      const match = controls.find(
        (c) => c instanceof HTMLInputElement && c.value === String(value)
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

// src/events.ts
var EVENT_NAME_ALIASES = {
  toolchange: ["toolchange"],
  toolactivated: ["toolactivated"],
  // Chromium ships "toolcancel"; the explainer says "toolcanceled".
  toolcanceled: ["toolcanceled", "toolcancel"]
};
function addWebMCPEventListener(name, handler) {
  if (typeof window === "undefined") return () => {
  };
  const targets = [];
  const context = getModelContext();
  if (context && typeof context.addEventListener === "function") {
    targets.push(context);
  }
  targets.push(window);
  const seen = /* @__PURE__ */ new WeakSet();
  const listener = (event) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event);
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

// src/indicators.ts
var STYLE_ATTRIBUTE = "data-webmcp-indicator-styles";
var WEBMCP_INDICATOR_CSS = `
form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"]) {
  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);
  outline-offset: 3px;
}
form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"])
  :is(button[type="submit"], input[type="submit"]) {
  outline: 2px solid var(--webmcp-indicator-color, #6d28d9);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: no-preference) {
  form[data-webmcp-indicators]:is(:tool-form-active, [data-webmcp-active="true"])
    :is(button[type="submit"], input[type="submit"]) {
    animation: webmcp-submit-pulse 1.2s ease-in-out infinite;
  }
}
@keyframes webmcp-submit-pulse {
  50% { outline-offset: 5px; }
}
`;
var injectionCount = 0;
function injectWebMCPIndicatorStyles() {
  if (typeof document === "undefined") return () => {
  };
  injectionCount++;
  let style = document.head.querySelector(`style[${STYLE_ATTRIBUTE}]`);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute(STYLE_ATTRIBUTE, "");
    style.textContent = WEBMCP_INDICATOR_CSS;
    document.head.appendChild(style);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    injectionCount--;
    if (injectionCount <= 0) {
      injectionCount = 0;
      document.head.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
    }
  };
}

// src/react/ToolForm.tsx
import {
  createElement,
  forwardRef,
  useEffect,
  useRef
} from "react";
var DEFAULT_PENDING_TIMEOUT_MS = 12e4;
function snapshotFormControls(form) {
  const out = [];
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLSelectElement) {
      out.push({ kind: "select", el, selected: Array.from(el.options).map((o) => o.selected) });
    } else if (el instanceof HTMLTextAreaElement) {
      out.push({ kind: "value", el, value: el.value, checked: false });
    } else if (el instanceof HTMLInputElement && el.type !== "file") {
      out.push({ kind: "value", el, value: el.value, checked: el.checked });
    }
  }
  return out;
}
function restoreFormControls(snapshot) {
  for (const entry of snapshot) {
    if (entry.kind === "select") {
      entry.selected.forEach((selected, i) => {
        const option = entry.el.options[i];
        if (option) option.selected = selected;
      });
    } else {
      entry.el.value = entry.value;
      if (entry.el instanceof HTMLInputElement) entry.el.checked = entry.checked;
    }
  }
}
var ToolForm = forwardRef(
  function ToolForm2({
    name,
    description,
    autoSubmit = true,
    onAgentSubmit,
    onSubmit,
    indicators,
    pendingTimeoutMs = DEFAULT_PENDING_TIMEOUT_MS,
    resetAfterAgentSubmit,
    onPendingChange,
    reinvokeGuard = true,
    children,
    ...rest
  }, forwardedRef) {
    const formRef = useRef(null);
    const pendingRef = useRef({ pending: false, since: 0, timer: null });
    const latest = useRef({
      name,
      pendingTimeoutMs,
      resetAfterAgentSubmit,
      onPendingChange,
      reinvokeGuard
    });
    latest.current = { name, pendingTimeoutMs, resetAfterAgentSubmit, onPendingChange, reinvokeGuard };
    const setRefs = (node) => {
      formRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };
    const setPendingAttribute = (on) => {
      const form = formRef.current;
      if (!form) return;
      if (on) form.setAttribute("data-webmcp-active", "true");
      else form.removeAttribute("data-webmcp-active");
    };
    const clearPending = () => {
      const state = pendingRef.current;
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      if (!state.pending) return;
      state.pending = false;
      setPendingAttribute(false);
      latest.current.onPendingChange?.(false);
    };
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
            message: `Agent invocation still unanswered after ${timeout}ms \u2014 cancelling it via form.reset() so the page's WebMCP channel stays healthy. The agent receives a 'cancelled' error.`,
            toolName: latest.current.name
          });
          if (form?.isConnected) {
            form.reset();
          } else {
            clearPending();
          }
        }, timeout);
      }
      setTimeout(() => {
        const form = formRef.current;
        if (!form || !pendingRef.current.pending) return;
        try {
          if (!form.matches(":tool-form-active")) clearPending();
        } catch {
        }
      }, 0);
    };
    const concernsThisForm = (event, whenUnknown) => {
      const toolName = event.toolName;
      if (typeof toolName === "string" && toolName.length > 0) {
        return toolName === latest.current.name;
      }
      return whenUnknown();
    };
    useEffect(() => {
      const removeActivated = addWebMCPEventListener("toolactivated", (event) => {
        const matchedByState = () => {
          const form2 = formRef.current;
          if (!form2) return false;
          try {
            return form2.matches(":tool-form-active");
          } catch {
            return true;
          }
        };
        if (!concernsThisForm(event, matchedByState)) return;
        if (pendingRef.current.pending) {
          reportWebMCP({
            level: "error",
            code: "invocation-overlap",
            message: "Tool was re-invoked while a previous invocation was still awaiting the user's submit, and the re-invoke guard did not catch the fill. Chromium keeps one pending invocation per form and DROPS the previous reply callback \u2014 this can close the page's WebMCP channel and silently disable every tool until reload. Keep reinvokeGuard and pendingTimeoutMs enabled, or use autoSubmit (the default) for low-stakes forms.",
            toolName: latest.current.name,
            detail: { pendingSinceMs: Date.now() - pendingRef.current.since }
          });
        } else {
          reportWebMCP({
            level: "info",
            code: "invocation-pending",
            message: "Agent filled the form; awaiting the user's review submit (:tool-form-active is set).",
            toolName: latest.current.name
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
            toolName: latest.current.name
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
            message: "Form was reset while an invocation was pending \u2014 the browser cancels the invocation and notifies the agent.",
            toolName: latest.current.name
          });
        }
        clearPending();
      };
      form?.addEventListener("reset", onReset);
      let guardRestoring = false;
      const onGuardInput = (event) => {
        if (!latest.current.reinvokeGuard || guardRestoring) return;
        if (!pendingRef.current.pending) return;
        const guardedForm = formRef.current;
        const target = event.target;
        if (!guardedForm || !(target instanceof Element)) return;
        if (typeof InputEvent !== "undefined" && event instanceof InputEvent && event.inputType) {
          return;
        }
        if (target === guardedForm.ownerDocument.activeElement) return;
        const snapshot = snapshotFormControls(guardedForm);
        reportWebMCP({
          level: "warn",
          code: "invocation-reinvoked",
          message: "Tool re-invoked while a previous invocation was awaiting the user's submit \u2014 auto-cancelled the previous invocation via form.reset() during the new fill, before the browser could drop its reply (which would have killed the page's WebMCP channel). The new invocation proceeds normally. Disable with reinvokeGuard={false}.",
          toolName: latest.current.name,
          detail: { pendingSinceMs: Date.now() - pendingRef.current.since }
        });
        guardRestoring = true;
        try {
          guardedForm.reset();
          restoreFormControls(snapshot);
        } finally {
          guardRestoring = false;
        }
      };
      form?.addEventListener("input", onGuardInput, true);
      return () => {
        removeActivated();
        removeCanceled();
        form?.removeEventListener("reset", onReset);
        form?.removeEventListener("input", onGuardInput, true);
        const state = pendingRef.current;
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.pending = false;
      };
    }, [name]);
    useEffect(() => {
      if (!indicators) return;
      return injectWebMCPIndicatorStyles();
    }, [indicators]);
    const finishAnswered = () => {
      clearPending();
      if (!latest.current.resetAfterAgentSubmit) return;
      setTimeout(() => {
        const form = formRef.current;
        if (form?.isConnected && !pendingRef.current.pending) form.reset();
      }, 0);
    };
    const handleSubmit = (event) => {
      const form = event.currentTarget;
      const native = event.nativeEvent;
      const respondWith = typeof native.respondWith === "function" ? native.respondWith.bind(native) : void 0;
      const isAgentSubmit = Boolean(native.agentInvoked) && respondWith !== void 0;
      if (!isAgentSubmit) {
        if (native.agentInvoked) {
          reportWebMCP({
            level: "error",
            code: "respondwith-missing",
            message: "Agent-invoked submit, but SubmitEvent.respondWith() is unavailable in this browser \u2014 the invocation cannot be answered in-page.",
            toolName: name
          });
          onSubmit?.(event);
          return;
        }
        if (typeof form.checkValidity === "function" && !form.checkValidity()) {
          event.preventDefault();
          form.reportValidity?.();
          return;
        }
        onSubmit?.(event);
        return;
      }
      onSubmit?.(event);
      if (!onAgentSubmit) {
        reportWebMCP({
          level: "warn",
          code: "agent-submit-navigation",
          message: "Agent-invoked submit without an onAgentSubmit handler: the form will perform its default submission and the tool response is taken from the target page's ld+json. Pass onAgentSubmit to answer in-page without navigating.",
          toolName: name
        });
        return;
      }
      if (!respondWith) return;
      event.preventDefault();
      const data = new FormData(form);
      const startedAt = Date.now();
      reportWebMCP({
        level: "info",
        code: "agent-submit",
        message: "Answering agent-invoked submission via respondWith().",
        toolName: name,
        detail: { fields: Array.from(new Set(data.keys())) }
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
              detail: clipDiagnosticText(JSON.stringify(result) ?? "")
            });
            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reportWebMCP({
              level: "error",
              code: "agent-response-error",
              message: `onAgentSubmit failed (answered to the agent as isError): ${message}`,
              toolName: name,
              detail: error
            });
            return textResult(`Tool "${name}" failed: ${message}`, true);
          } finally {
            finishAnswered();
          }
        })()
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
        ...autoSubmit ? { toolautosubmit: "" } : {},
        ...indicators ? { "data-webmcp-indicators": "" } : {}
      },
      children
    );
  }
);

// src/react/useFormTool.ts
import { useCallback, useEffect as useEffect2, useRef as useRef2, useState } from "react";
function useFormTool(options) {
  const {
    formRef,
    name,
    description,
    autoSubmit = false,
    onToolCall,
    annotations,
    enabled = true
  } = options;
  const optionsRef = useRef2(options);
  optionsRef.current = options;
  const [isRegistered, setIsRegistered] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((n) => n + 1), []);
  const definitionKey = JSON.stringify({ name, description, autoSubmit, annotations });
  useEffect2(() => {
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
      async execute(args) {
        const currentForm = optionsRef.current.formRef.current;
        if (!currentForm) {
          return textResult(`Tool "${name}" is no longer available on this page.`, true);
        }
        const unapplied = applyArgsToForm(currentForm, args);
        if (unapplied.length > 0) {
          return textResult(
            `Unknown form field(s): ${unapplied.join(", ")}. Re-check the tool's input schema.`,
            true
          );
        }
        if (optionsRef.current.onToolCall) {
          return optionsRef.current.onToolCall(args, currentForm);
        }
        if (optionsRef.current.autoSubmit) {
          currentForm.requestSubmit();
          return textResult("Form filled out and submitted.");
        }
        const submitter = currentForm.querySelector(
          'button[type="submit"], input[type="submit"]'
        );
        submitter?.focus();
        return textResult(
          "Form filled out. The user must review and submit it manually."
        );
      }
    });
    setIsRegistered(true);
    return () => {
      setIsRegistered(false);
      unregister();
    };
  }, [definitionKey, enabled, refreshCount, formRef]);
  return { isRegistered, refresh };
}

// src/react/useWebMCPTools.ts
import { useEffect as useEffect3, useRef as useRef3, useState as useState2 } from "react";
function useWebMCPTools(tools, options = {}) {
  const { enabled = true } = options;
  const toolsRef = useRef3(tools);
  toolsRef.current = tools;
  const [isRegistered, setIsRegistered] = useState2(false);
  const definitionKey = JSON.stringify(
    tools.map(({ execute: _execute, ...definition }) => definition)
  );
  useEffect3(() => {
    if (!enabled) {
      setIsRegistered(false);
      return;
    }
    const definitions = JSON.parse(definitionKey);
    const unregisters = definitions.map(
      (definition, index) => registerTool({
        ...definition,
        execute: (args) => {
          const current = toolsRef.current[index];
          if (!current) {
            throw new Error(`Tool "${definition.name}" is no longer available.`);
          }
          return current.execute(args);
        }
      })
    );
    setIsRegistered(true);
    return () => {
      setIsRegistered(false);
      for (const unregister of unregisters) unregister();
    };
  }, [definitionKey, enabled]);
  return { isRegistered };
}

// src/react/useWebMCP.ts
import { useSyncExternalStore } from "react";
var noopSubscribe = () => () => {
};
function useWebMCP() {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    isWebMCPSupported,
    () => false
  );
  return { isSupported, modelContext: isSupported ? getModelContext() : null };
}

// src/react/useWebMCPEvent.ts
import { useEffect as useEffect4, useRef as useRef4 } from "react";
function useWebMCPEvent(event, handler) {
  const handlerRef = useRef4(handler);
  handlerRef.current = handler;
  useEffect4(() => {
    return addWebMCPEventListener(event, (e) => handlerRef.current(e));
  }, [event]);
}

// src/react/useWebMCPTool.ts
import { useEffect as useEffect5, useMemo, useRef as useRef5, useState as useState3 } from "react";
function useWebMCPTool(options) {
  const {
    name,
    description,
    inputSchema,
    outputSchema,
    annotations,
    exposedTo,
    enabled = true,
    validateInput,
    execute
  } = options;
  const executeRef = useRef5(execute);
  executeRef.current = execute;
  const [isRegistered, setIsRegistered] = useState3(false);
  const definitionKey = useMemo(
    () => JSON.stringify({
      name,
      description,
      inputSchema,
      outputSchema,
      annotations,
      exposedTo,
      validateInput
    }),
    [name, description, inputSchema, outputSchema, annotations, exposedTo, validateInput]
  );
  useEffect5(() => {
    if (!enabled) {
      setIsRegistered(false);
      return;
    }
    const { exposedTo: parsedExposedTo, ...definition } = JSON.parse(
      definitionKey
    );
    const unregister = registerTool(
      { ...definition, execute: (args) => executeRef.current(args) },
      parsedExposedTo ? { exposedTo: parsedExposedTo } : {}
    );
    setIsRegistered(true);
    return () => {
      setIsRegistered(false);
      unregister();
    };
  }, [definitionKey, enabled]);
  return { isRegistered };
}
export {
  DEFAULT_MAX_RESULT_LENGTH,
  DEFAULT_PENDING_TIMEOUT_MS,
  ToolForm,
  WEBMCP_INDICATOR_CSS,
  addWebMCPEventListener,
  applyArgsToForm,
  extractFormSchema,
  getModelContext,
  injectWebMCPIndicatorStyles,
  isWebMCPSupported,
  isWebMCPTestingSupported,
  isWebMCPVerbose,
  jsonResult,
  normalizeResult,
  onWebMCPDiagnostic,
  provideContext,
  registerTool,
  setWebMCPVerbose,
  textResult,
  toolFormAttrs,
  toolParamAttrs,
  useFormTool,
  useWebMCP,
  useWebMCPEvent,
  useWebMCPTool,
  useWebMCPTools,
  validateToolInput
};
//# sourceMappingURL=index.js.map