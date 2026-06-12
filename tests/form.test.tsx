import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTool } from "../src/core";
import { applyArgsToForm, extractFormSchema } from "../src/form";
import { useFormTool } from "../src/react/useFormTool";
import { useWebMCPTools } from "../src/react/useWebMCPTools";
import type { ToolResponse } from "../src/types";
import {
  installMockModelContext,
  uninstallMockModelContext,
} from "./mock-model-context";

afterEach(() => {
  uninstallMockModelContext();
  document.body.innerHTML = "";
});

function buildForm(html: string): HTMLFormElement {
  const form = document.createElement("form");
  form.innerHTML = html;
  document.body.appendChild(form);
  return form;
}

describe("extractFormSchema", () => {
  it("maps control types, constraints, and descriptions", () => {
    const form = buildForm(`
      <input type="text" name="city" required maxlength="40"
             toolparamdescription="The destination city">
      <input type="email" name="email" aria-label="Contact email">
      <input type="number" name="guests" min="1" max="12">
      <input type="checkbox" name="newsletter">
      <input type="radio" name="seating" value="inside">
      <input type="radio" name="seating" value="terrace" required>
      <select name="meal">
        <option value="">Pick…</option>
        <option value="veggie">Veggie</option>
        <option value="fish">Fish</option>
      </select>
      <input type="password" name="secret">
      <input type="hidden" name="csrf" value="x">
      <button type="submit">Go</button>
    `);

    const schema = extractFormSchema(form);
    expect(schema.properties?.city).toEqual({
      type: "string",
      maxLength: 40,
      description: "The destination city",
    });
    expect(schema.properties?.email).toEqual({
      type: "string",
      format: "email",
      description: "Contact email",
    });
    expect(schema.properties?.guests).toEqual({ type: "number", minimum: 1, maximum: 12 });
    expect(schema.properties?.newsletter).toEqual({ type: "boolean" });
    expect(schema.properties?.seating).toEqual({
      type: "string",
      enum: ["inside", "terrace"],
    });
    expect(schema.properties?.meal).toEqual({ type: "string", enum: ["veggie", "fish"] });
    // Passwords and hidden inputs must never be exposed to an agent.
    expect(schema.properties?.secret).toBeUndefined();
    expect(schema.properties?.csrf).toBeUndefined();
    expect(schema.required).toEqual(["city", "seating"]);
  });
});

describe("applyArgsToForm", () => {
  it("fills text, radio, checkbox, and select controls with events", () => {
    const form = buildForm(`
      <input type="text" name="city">
      <input type="radio" name="seating" value="inside">
      <input type="radio" name="seating" value="terrace">
      <input type="checkbox" name="newsletter">
      <select name="meal"><option value="veggie">V</option><option value="fish">F</option></select>
    `);
    const changes: string[] = [];
    form.addEventListener("change", (e) =>
      changes.push((e.target as HTMLInputElement).name),
    );

    const unapplied = applyArgsToForm(form, {
      city: "Berlin",
      seating: "terrace",
      newsletter: true,
      meal: "fish",
      bogus: "nope",
    });

    expect((form.elements.namedItem("city") as HTMLInputElement).value).toBe("Berlin");
    expect(
      (form.querySelector('input[value="terrace"]') as HTMLInputElement).checked,
    ).toBe(true);
    expect((form.elements.namedItem("newsletter") as HTMLInputElement).checked).toBe(true);
    expect((form.elements.namedItem("meal") as HTMLSelectElement).value).toBe("fish");
    expect(unapplied).toEqual(["bogus"]);
    expect(changes).toContain("city");
  });
});

describe("useFormTool", () => {
  function setupFormHook(autoSubmit = false) {
    const mock = installMockModelContext();
    const form = buildForm(`
      <input type="text" name="city" required>
      <button type="submit">Go</button>
    `);
    const hook = renderHook(() =>
      useFormTool({
        formRef: useRef(form),
        name: "search-hotels",
        description: "Searches hotels in a city",
        autoSubmit,
      }),
    );
    return { mock, form, hook };
  }

  it("registers with a DOM-derived schema and fills the form on execute", async () => {
    const { mock, form, hook } = setupFormHook();
    expect(hook.result.current.isRegistered).toBe(true);
    const tool = mock.tools.get("search-hotels");
    expect(tool?.inputSchema?.required).toEqual(["city"]);

    const result = (await mock.call("search-hotels", { city: "Rome" })) as ToolResponse;
    expect((form.elements.namedItem("city") as HTMLInputElement).value).toBe("Rome");
    expect(result.content[0]?.text).toContain("review and submit");

    hook.unmount();
    expect(mock.tools.has("search-hotels")).toBe(false);
  });

  it("submits when autoSubmit is set", async () => {
    const { mock, form } = setupFormHook(true);
    const submitSpy = vi
      .spyOn(form, "requestSubmit")
      .mockImplementation(() => {});
    const result = (await mock.call("search-hotels", { city: "Oslo" })) as ToolResponse;
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(result.content[0]?.text).toContain("submitted");
  });

  it("reports unknown fields as tool errors", async () => {
    const { mock } = setupFormHook();
    const result = (await mock.call("search-hotels", { nope: 1 })) as ToolResponse;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("nope");
  });
});

describe("useWebMCPTools", () => {
  it("registers a batch individually and keeps execute fresh", async () => {
    const mock = installMockModelContext();
    const { rerender, unmount } = renderHook(
      ({ suffix }: { suffix: string }) =>
        useWebMCPTools([
          { name: "a", description: "A", execute: () => `a-${suffix}` },
          { name: "b", description: "B", execute: () => `b-${suffix}` },
        ]),
      { initialProps: { suffix: "1" } },
    );
    expect([...mock.tools.keys()]).toEqual(["a", "b"]);
    rerender({ suffix: "2" });
    const result = (await mock.call("b", {})) as ToolResponse;
    expect(result.content[0]?.text).toBe("b-2");
    unmount();
    expect(mock.tools.size).toBe(0);
  });
});

describe("tool validation", () => {
  it("throws developer-friendly errors for invalid definitions in dev", () => {
    installMockModelContext();
    expect(() =>
      registerTool({ name: "", description: "d", execute: () => "x" }),
    ).toThrow(/non-empty/);
    expect(() =>
      registerTool({ name: "t", description: "", execute: () => "x" }),
    ).toThrow(/description/);
  });
});
