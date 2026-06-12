"use client";

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
  const { validateInput = true, ...descriptor } = tool;
  return {
    ...descriptor,
    async execute(args) {
      if (validateInput) {
        const problems = validateToolInput(args, tool.inputSchema);
        if (problems.length > 0) {
          return textResult(
            `Invalid arguments for tool "${tool.name}": ${problems.join("; ")}`,
            true
          );
        }
      }
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

// src/react/ToolForm.tsx
import {
  createElement,
  forwardRef
} from "react";
var ToolForm = forwardRef(
  function ToolForm2({ name, description, autoSubmit, onAgentSubmit, onSubmit, children, ...rest }, ref) {
    const handleSubmit = (event) => {
      onSubmit?.(event);
      if (!onAgentSubmit || event.defaultPrevented) return;
      const native = event.nativeEvent;
      if (!native.agentInvoked || typeof native.respondWith !== "function") return;
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      native.respondWith(
        Promise.resolve(onAgentSubmit(data, event)).then(normalizeResult)
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
        ...autoSubmit ? { toolautosubmit: "" } : {}
      },
      children
    );
  }
);

// src/react/useFormTool.ts
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
function useWebMCPTools(tools, options = {}) {
  const { enabled = true } = options;
  const toolsRef = useRef2(tools);
  toolsRef.current = tools;
  const [isRegistered, setIsRegistered] = useState2(false);
  const definitionKey = JSON.stringify(
    tools.map(({ execute: _execute, ...definition }) => definition)
  );
  useEffect2(() => {
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
import { useEffect as useEffect3, useRef as useRef3 } from "react";
function useWebMCPEvent(event, handler) {
  const handlerRef = useRef3(handler);
  handlerRef.current = handler;
  useEffect3(() => {
    const context = getModelContext();
    if (!context || typeof context.addEventListener !== "function") return;
    const listener = (e) => handlerRef.current(e);
    context.addEventListener(event, listener);
    return () => context.removeEventListener(event, listener);
  }, [event]);
}

// src/react/useWebMCPTool.ts
import { useEffect as useEffect4, useMemo, useRef as useRef4, useState as useState3 } from "react";
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
  const executeRef = useRef4(execute);
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
  useEffect4(() => {
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
  ToolForm,
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
  toolParamAttrs,
  useFormTool,
  useWebMCP,
  useWebMCPEvent,
  useWebMCPTool,
  useWebMCPTools,
  validateToolInput
};
//# sourceMappingURL=index.js.map