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
  applyArgsToForm: () => applyArgsToForm,
  extractFormSchema: () => extractFormSchema,
  getModelContext: () => getModelContext,
  isWebMCPSupported: () => isWebMCPSupported,
  isWebMCPTestingSupported: () => isWebMCPTestingSupported,
  jsonResult: () => jsonResult,
  normalizeResult: () => normalizeResult,
  provideContext: () => provideContext,
  registerTool: () => registerTool,
  textResult: () => textResult,
  toolFormAttrs: () => toolFormAttrs,
  toolParamAttrs: () => toolParamAttrs
});
module.exports = __toCommonJS(vanilla_exports);

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
  reportError(`WebMCP: ${problem}`, void 0);
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
  return {
    ...tool,
    async execute(args) {
      try {
        const result = await tool.execute(args);
        return tool.outputSchema ? result : normalizeResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return textResult(`Tool "${tool.name}" failed: ${message}`, true);
      }
    }
  };
}
function registerTool(tool, options = {}) {
  if (!validateTool(tool)) return () => {
  };
  const context = getModelContext();
  if (!context) return () => {
  };
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
        reportError(`WebMCP: failed to register tool "${tool.name}"`, error);
      });
    }
  } catch (error) {
    reportError(`WebMCP: failed to register tool "${tool.name}"`, error);
    return () => {
    };
  }
  return () => {
    if (!registered) return;
    registered = false;
    controller.abort();
    try {
      context.unregisterTool?.(tool.name);
    } catch {
    }
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
      reportError("WebMCP: provideContext failed", error);
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
function reportError(prefix, error) {
  if (typeof console !== "undefined") {
    console.error(prefix, error);
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
  const result = { type: "object", properties };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_MAX_RESULT_LENGTH,
  applyArgsToForm,
  extractFormSchema,
  getModelContext,
  isWebMCPSupported,
  isWebMCPTestingSupported,
  jsonResult,
  normalizeResult,
  provideContext,
  registerTool,
  textResult,
  toolFormAttrs,
  toolParamAttrs
});
//# sourceMappingURL=vanilla.cjs.map