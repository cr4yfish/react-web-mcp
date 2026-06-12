import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolForm } from "../src/react/ToolForm";
import { useWebMCP } from "../src/react/useWebMCP";
import { useWebMCPEvent } from "../src/react/useWebMCPEvent";
import { useWebMCPTool } from "../src/react/useWebMCPTool";
import type { ToolResponse } from "../src/types";
import {
  type MockModelContext,
  installMockModelContext,
  uninstallMockModelContext,
} from "./mock-model-context";

afterEach(() => uninstallMockModelContext());

describe("useWebMCP", () => {
  it("reports lack of support", () => {
    const { result } = renderHook(() => useWebMCP());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.modelContext).toBeNull();
  });

  it("reports support and exposes the context", () => {
    const mock = installMockModelContext();
    const { result } = renderHook(() => useWebMCP());
    expect(result.current.isSupported).toBe(true);
    expect(result.current.modelContext).toBe(mock);
  });
});

describe("useWebMCPTool", () => {
  it("registers on mount and unregisters on unmount", () => {
    const mock = installMockModelContext();
    const { result, unmount } = renderHook(() =>
      useWebMCPTool({
        name: "greet",
        description: "Greets",
        execute: () => "hello",
      }),
    );
    expect(mock.tools.has("greet")).toBe(true);
    expect(result.current.isRegistered).toBe(true);
    unmount();
    expect(mock.tools.has("greet")).toBe(false);
  });

  it("does not re-register on re-render, but execute sees fresh closures", async () => {
    const mock = installMockModelContext();
    const registerSpy = vi.spyOn(mock, "registerTool");
    const { rerender } = renderHook(
      ({ count }: { count: number }) =>
        useWebMCPTool({
          name: "count",
          description: "Returns the count",
          // Fresh schema object literal each render must not re-register.
          inputSchema: { type: "object", properties: {} },
          execute: () => `count is ${count}`,
        }),
      { initialProps: { count: 1 } },
    );
    rerender({ count: 2 });
    expect(registerSpy).toHaveBeenCalledTimes(1);
    const result = (await mock.call("count", {})) as ToolResponse;
    expect(result.content[0]?.text).toBe("count is 2");
  });

  it("re-registers when the definition changes and honors enabled", () => {
    const mock = installMockModelContext();
    const { rerender } = renderHook(
      ({ name, enabled }: { name: string; enabled: boolean }) =>
        useWebMCPTool({ name, description: "d", enabled, execute: () => "x" }),
      { initialProps: { name: "one", enabled: true } },
    );
    expect(mock.tools.has("one")).toBe(true);
    rerender({ name: "two", enabled: true });
    expect(mock.tools.has("one")).toBe(false);
    expect(mock.tools.has("two")).toBe(true);
    rerender({ name: "two", enabled: false });
    expect(mock.tools.size).toBe(0);
  });
});

describe("useWebMCPEvent", () => {
  it("subscribes to ModelContext events", () => {
    const mock = installMockModelContext();
    const handler = vi.fn();
    renderHook(() => useWebMCPEvent("toolchange", handler));
    act(() => {
      mock.dispatchEvent(new Event("toolchange"));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("ToolForm", () => {
  function renderForm(
    mock?: MockModelContext,
    onAgentSubmit?: () => string,
  ) {
    return render(
      <ToolForm
        name="search-flights"
        description="Searches flights"
        autoSubmit
        onAgentSubmit={onAgentSubmit}
        data-testid="form"
      >
        <input type="text" name="from" required />
      </ToolForm>,
    );
  }

  it("renders the declarative attributes", () => {
    const { getByTestId } = renderForm();
    const form = getByTestId("form");
    expect(form.getAttribute("toolname")).toBe("search-flights");
    expect(form.getAttribute("tooldescription")).toBe("Searches flights");
    expect(form.hasAttribute("toolautosubmit")).toBe(true);
  });

  it("responds to agent-invoked submissions via respondWith", async () => {
    const onAgentSubmit = vi.fn(() => "found 3 flights");
    const { getByTestId } = renderForm(undefined, onAgentSubmit);
    const form = getByTestId("form") as HTMLFormElement;

    const respondWith = vi.fn();
    const event = new Event("submit", { bubbles: true, cancelable: true });
    Object.assign(event, { agentInvoked: true, respondWith });
    act(() => {
      form.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onAgentSubmit).toHaveBeenCalledTimes(1);
    expect(respondWith).toHaveBeenCalledTimes(1);
    const response = (await respondWith.mock.calls[0]?.[0]) as ToolResponse;
    expect(response.content[0]?.text).toBe("found 3 flights");
  });

  it("leaves user-driven submissions alone", () => {
    const onAgentSubmit = vi.fn();
    const { getByTestId } = renderForm(undefined, onAgentSubmit);
    const form = getByTestId("form") as HTMLFormElement;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });
    expect(onAgentSubmit).not.toHaveBeenCalled();
  });
});
