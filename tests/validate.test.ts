import { afterEach, describe, expect, it } from "vitest";
import { registerTool } from "../src/core";
import type { ToolResponse } from "../src/types";
import { validateToolInput } from "../src/validate";
import {
  installMockModelContext,
  uninstallMockModelContext,
} from "./mock-model-context";

afterEach(() => uninstallMockModelContext());

import type { JSONSchema } from "../src/types";

const promptSchema: JSONSchema = {
  type: "object",
  properties: {
    prompt: { type: "string", minLength: 1, maxLength: 10 },
  },
  required: ["prompt"],
};

describe("validateToolInput", () => {
  it("accepts valid arguments and tolerates missing schemas", () => {
    expect(validateToolInput({ prompt: "hi" }, promptSchema)).toEqual([]);
    expect(validateToolInput({ anything: true }, undefined)).toEqual([]);
    expect(validateToolInput("not-an-object", undefined)).toEqual([]);
  });

  it("reports missing required and wrong types", () => {
    expect(validateToolInput({}, promptSchema)).toEqual([
      'missing required argument "prompt"',
    ]);
    expect(validateToolInput({ prompt: 7 }, promptSchema)[0]).toContain(
      "must be of type string",
    );
    // Missing args object is treated as {} for object schemas.
    expect(validateToolInput(undefined, promptSchema)).toEqual([
      'missing required argument "prompt"',
    ]);
  });

  it("checks string, number, enum, and array constraints", () => {
    expect(validateToolInput({ prompt: "" }, promptSchema)[0]).toContain(
      "at least 1 characters",
    );
    expect(validateToolInput({ prompt: "x".repeat(11) }, promptSchema)[0]).toContain(
      "at most 10 characters",
    );
    const schema = {
      type: "object",
      properties: {
        rating: { type: "integer", minimum: 1, maximum: 5 },
        mode: { type: "string", enum: ["a", "b"] },
        tags: { type: "array", maxItems: 2, items: { type: "string" } },
      },
    };
    expect(validateToolInput({ rating: 6 }, schema)[0]).toContain("must be <= 5");
    expect(validateToolInput({ rating: 1.5 }, schema)[0]).toContain("type integer");
    expect(validateToolInput({ mode: "c" }, schema)[0]).toContain('"a", "b"');
    expect(validateToolInput({ tags: ["x", "y", "z"] }, schema)[0]).toContain(
      "at most 2 items",
    );
    expect(validateToolInput({ tags: ["x", 1] }, schema)[0]).toContain(
      '"tags[1]" must be of type string',
    );
    expect(
      validateToolInput({ rating: 3, mode: "a", tags: ["x"] }, schema),
    ).toEqual([]);
  });

  it("rejects unexpected keys only with additionalProperties: false", () => {
    expect(validateToolInput({ prompt: "hi", extra: 1 }, promptSchema)).toEqual([]);
    expect(
      validateToolInput(
        { prompt: "hi", extra: 1 },
        { ...promptSchema, additionalProperties: false },
      )[0],
    ).toContain('unexpected argument "extra"');
  });

  it("skips nodes it cannot validate (composition keywords, unknown types)", () => {
    expect(
      validateToolInput({ value: 1 }, { anyOf: [{ type: "string" }] }),
    ).toEqual([]);
    expect(
      validateToolInput({ value: 1 }, { type: "object", properties: { value: { $ref: "#/x" } } }),
    ).toEqual([]);
  });
});

describe("registerTool input validation", () => {
  it("answers schema-violating calls with isError instead of calling execute", async () => {
    const mock = installMockModelContext();
    let called = false;
    registerTool<{ prompt: string }>({
      name: "send-prompt",
      description: "d",
      inputSchema: { ...promptSchema },
      execute: () => {
        called = true;
        return "sent";
      },
    });
    const result = (await mock.call("send-prompt", {})) as ToolResponse;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Invalid arguments for tool "send-prompt"');
    expect(called).toBe(false);

    const ok = (await mock.call("send-prompt", { prompt: "hi" })) as ToolResponse;
    expect(ok.isError).toBeUndefined();
    expect(ok.content[0]?.text).toBe("sent");
  });

  it("can be disabled with validateInput: false and never reaches the browser descriptor", async () => {
    const mock = installMockModelContext();
    registerTool<{ prompt: string }>({
      name: "raw",
      description: "d",
      inputSchema: { ...promptSchema },
      validateInput: false,
      execute: (args) => `got ${JSON.stringify(args)}`,
    });
    expect(
      (mock.tools.get("raw") as { validateInput?: boolean }).validateInput,
    ).toBeUndefined();
    const result = (await mock.call("raw", { prompt: 5 } as never)) as ToolResponse;
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe('got {"prompt":5}');
  });
});
