"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vanilla.ts
var vanilla_exports = {};
__export(vanilla_exports, {
  DEFAULT_MAX_RESULT_LENGTH: () => DEFAULT_MAX_RESULT_LENGTH,
  WEBMCP_INDICATOR_CSS: () => WEBMCP_INDICATOR_CSS,
  addWebMCPEventListener: () => addWebMCPEventListener,
  applyArgsToForm: () => applyArgsToForm,
  extractFormSchema: () => extractFormSchema,
  getModelContext: () => getModelContext,
  injectWebMCPIndicatorStyles: () => injectWebMCPIndicatorStyles,
  isWebMCPSupported: () => isWebMCPSupported,
  isWebMCPTestingSupported: () => isWebMCPTestingSupported,
  isWebMCPVerbose: () => isWebMCPVerbose,
  jsonResult: () => jsonResult,
  normalizeResult: () => normalizeResult,
  onWebMCPDiagnostic: () => onWebMCPDiagnostic,
  provideContext: () => provideContext,
  registerTool: () => registerTool,
  setWebMCPVerbose: () => setWebMCPVerbose,
  textResult: () => textResult,
  toolFormAttrs: () => toolFormAttrs,
  toolParamAttrs: () => toolParamAttrs,
  validateToolInput: () => validateToolInput
});
module.exports = __toCommonJS(vanilla_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_MAX_RESULT_LENGTH,
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
  validateToolInput
});
//# sourceMappingURL=vanilla.cjs.map