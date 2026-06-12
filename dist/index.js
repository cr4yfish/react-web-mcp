"use client";

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
import { useEffect, useRef } from "react";
function useWebMCPEvent(event, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const context = getModelContext();
    if (!context || typeof context.addEventListener !== "function") return;
    const listener = (e) => handlerRef.current(e);
    context.addEventListener(event, listener);
    return () => context.removeEventListener(event, listener);
  }, [event]);
}

// src/react/useWebMCPTool.ts
import { useEffect as useEffect2, useMemo, useRef as useRef2, useState } from "react";
function useWebMCPTool(options) {
  const {
    name,
    description,
    inputSchema,
    outputSchema,
    annotations,
    exposedTo,
    enabled = true,
    execute
  } = options;
  const executeRef = useRef2(execute);
  executeRef.current = execute;
  const [isRegistered, setIsRegistered] = useState(false);
  const definitionKey = useMemo(
    () => JSON.stringify({
      name,
      description,
      inputSchema,
      outputSchema,
      annotations,
      exposedTo
    }),
    [name, description, inputSchema, outputSchema, annotations, exposedTo]
  );
  useEffect2(() => {
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
  getModelContext,
  isWebMCPSupported,
  jsonResult,
  normalizeResult,
  provideContext,
  registerTool,
  textResult,
  toolFormAttrs,
  toolParamAttrs,
  useWebMCP,
  useWebMCPEvent,
  useWebMCPTool
};
//# sourceMappingURL=index.js.map