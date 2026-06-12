import { afterEach, describe, expect, it } from "vitest";
import {
  getModelContext,
  isWebMCPSupported,
  jsonResult,
  normalizeResult,
  provideContext,
  registerTool,
  textResult,
  toolFormAttrs,
  toolParamAttrs,
} from "../src/core";
import type { ToolResponse } from "../src/types";
import {
  installMockModelContext,
  uninstallMockModelContext,
} from "./mock-model-context";

afterEach(() => uninstallMockModelContext());

describe("getModelContext / isWebMCPSupported", () => {
  it("returns null and false without browser support", () => {
    expect(getModelContext()).toBeNull();
    expect(isWebMCPSupported()).toBe(false);
  });

  it("prefers document.modelContext", () => {
    const mock = installMockModelContext();
    expect(getModelContext()).toBe(mock);
    expect(isWebMCPSupported()).toBe(true);
  });
});

describe("result helpers", () => {
  it("wraps text", () => {
    expect(textResult("hi")).toEqual({ content: [{ type: "text", text: "hi" }] });
    expect(textResult("bad", true).isError).toBe(true);
  });

  it("serializes and truncates json", () => {
    const result = jsonResult({ a: 1 });
    expect(result.content[0]?.text).toBe('{"a":1}');
    const truncated = jsonResult({ a: "x".repeat(100) }, 10);
    expect(truncated.content[0]?.text).toContain("[truncated");
  });

  it("normalizes strings, values, objects, and passthrough responses", () => {
    expect(normalizeResult("ok").content[0]?.text).toBe("ok");
    expect(normalizeResult(undefined).content[0]?.text).toBe("OK");
    expect(normalizeResult(42).content[0]?.text).toBe("42");
    expect(normalizeResult({ a: 1 }).content[0]?.text).toBe('{"a":1}');
    const passthrough: ToolResponse = { content: [{ type: "text", text: "raw" }] };
    expect(normalizeResult(passthrough)).toBe(passthrough);
  });
});

describe("registerTool", () => {
  it("is a no-op without browser support", () => {
    const unregister = registerTool({
      name: "t",
      description: "d",
      execute: () => "x",
    });
    expect(unregister).toBeTypeOf("function");
    unregister();
  });

  it("registers, normalizes results, and unregisters via abort signal", async () => {
    const mock = installMockModelContext();
    const unregister = registerTool<{ text: string }>({
      name: "add-todo",
      description: "Adds a todo",
      execute: ({ text }) => `Added: ${text}`,
    });
    expect(mock.tools.has("add-todo")).toBe(true);

    const result = (await mock.call("add-todo", { text: "milk" })) as ToolResponse;
    expect(result.content[0]?.text).toBe("Added: milk");

    unregister();
    expect(mock.tools.has("add-todo")).toBe(false);
  });

  it("converts thrown errors into isError responses", async () => {
    const mock = installMockModelContext();
    registerTool({
      name: "boom",
      description: "Always fails",
      execute: () => {
        throw new Error("kaput");
      },
    });
    const result = (await mock.call("boom", {})) as ToolResponse;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("kaput");
  });

  it("respects an outer abort signal", () => {
    const mock = installMockModelContext();
    const controller = new AbortController();
    registerTool(
      { name: "t", description: "d", execute: () => "x" },
      { signal: controller.signal },
    );
    expect(mock.tools.has("t")).toBe(true);
    controller.abort();
    expect(mock.tools.has("t")).toBe(false);
  });
});

describe("provideContext", () => {
  it("replaces the toolset and clears on unregister", () => {
    const mock = installMockModelContext();
    const unregister = provideContext([
      { name: "a", description: "a", execute: () => "a" },
      { name: "b", description: "b", execute: () => "b" },
    ]);
    expect([...mock.tools.keys()]).toEqual(["a", "b"]);
    unregister();
    expect(mock.tools.size).toBe(0);
  });
});

describe("declarative attribute helpers", () => {
  it("builds form attributes", () => {
    expect(toolFormAttrs({ name: "search", description: "Searches" })).toEqual({
      toolname: "search",
      tooldescription: "Searches",
    });
    expect(
      toolFormAttrs({ name: "s", description: "d", autoSubmit: true }).toolautosubmit,
    ).toBe("");
  });

  it("builds param attributes", () => {
    expect(toolParamAttrs("The city")).toEqual({ toolparamdescription: "The city" });
  });
});
