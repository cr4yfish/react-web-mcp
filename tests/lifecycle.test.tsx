/**
 * Tests for the declarative-form invocation lifecycle safeguards, the
 * verbose/diagnostics facility, the event plumbing, and the opt-in visual
 * indicators — modeled on Chromium's actual behavior:
 *
 * - `toolactivated` / `toolcancel` (Chromium's name for `toolcanceled`) are
 *   `WebMCPEvent`s with a `toolName` property, dispatched at the WINDOW.
 * - One pending invocation per form; a re-invoke drops the previous reply
 *   callback and can kill the page's whole WebMCP channel.
 * - `form.reset()` is the page-side way to cancel a pending invocation.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWebMCPVerbose,
  onWebMCPDiagnostic,
  reportWebMCP,
  setWebMCPVerbose,
  type WebMCPDiagnostic,
} from "../src/debug";
import { addWebMCPEventListener } from "../src/events";
import { injectWebMCPIndicatorStyles } from "../src/indicators";
import { ToolForm, type ToolFormProps } from "../src/react/ToolForm";
import { useWebMCPEvent } from "../src/react/useWebMCPEvent";
import type { ToolResponse } from "../src/types";
import {
  installMockModelContext,
  uninstallMockModelContext,
} from "./mock-model-context";

function dispatchToolEvent(type: string, toolName: string): void {
  const event = new Event(type);
  Object.assign(event, { toolName });
  window.dispatchEvent(event);
}

function agentSubmit(form: HTMLFormElement): { respondWith: ReturnType<typeof vi.fn>; event: Event } {
  const respondWith = vi.fn();
  const event = new Event("submit", { bubbles: true, cancelable: true });
  Object.assign(event, { agentInvoked: true, respondWith });
  act(() => {
    form.dispatchEvent(event);
  });
  return { respondWith, event };
}

let diagnostics: WebMCPDiagnostic[] = [];
let unsubscribe: () => void = () => {};

beforeEach(() => {
  diagnostics = [];
  unsubscribe = onWebMCPDiagnostic((d) => diagnostics.push(d));
});

afterEach(() => {
  unsubscribe();
  setWebMCPVerbose(false);
  uninstallMockModelContext();
  document.body.innerHTML = "";
  document.head.querySelectorAll("style[data-webmcp-indicator-styles]").forEach((s) => s.remove());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("diagnostics / verbose mode", () => {
  it("delivers diagnostics to subscribers regardless of verbose mode", () => {
    reportWebMCP({ level: "info", code: "register", message: "hi", toolName: "t" });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("register");
  });

  it("logs info to the console only in verbose mode, errors always", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    reportWebMCP({ level: "info", code: "register", message: "quiet" });
    expect(info).not.toHaveBeenCalled();

    setWebMCPVerbose(true);
    expect(isWebMCPVerbose()).toBe(true);
    reportWebMCP({ level: "info", code: "register", message: "loud" });
    expect(info).toHaveBeenCalledTimes(1);

    reportWebMCP({ level: "error", code: "register-failed", message: "boom" });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("never lets a throwing subscriber break reporting", () => {
    const off = onWebMCPDiagnostic(() => {
      throw new Error("bad listener");
    });
    expect(() =>
      reportWebMCP({ level: "warn", code: "result-truncated", message: "x" }),
    ).not.toThrow();
    off();
  });
});

describe("addWebMCPEventListener", () => {
  it("receives window-dispatched events (Chromium's actual target)", () => {
    installMockModelContext();
    const handler = vi.fn();
    const off = addWebMCPEventListener("toolactivated", handler);
    dispatchToolEvent("toolactivated", "my-tool");
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as { toolName?: string }).toolName).toBe("my-tool");
    off();
    dispatchToolEvent("toolactivated", "my-tool");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps "toolcanceled" to Chromium\'s "toolcancel" name without double-firing', () => {
    installMockModelContext();
    const handler = vi.fn();
    const off = addWebMCPEventListener("toolcanceled", handler);
    dispatchToolEvent("toolcancel", "my-tool");
    dispatchToolEvent("toolcanceled", "my-tool");
    expect(handler).toHaveBeenCalledTimes(2);
    off();
  });

  it("dedupes an event that reaches both the context and the window", () => {
    const mock = installMockModelContext();
    const handler = vi.fn();
    const off = addWebMCPEventListener("toolchange", handler);
    // Same event object dispatched on both targets must invoke once.
    const event = new Event("toolchange");
    mock.dispatchEvent(event);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("useWebMCPEvent receives window-target events", () => {
    installMockModelContext();
    const handler = vi.fn();
    const { unmount } = render(<Probe onEvent={handler} />);
    dispatchToolEvent("toolcancel", "x");
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });
});

function Probe({ onEvent }: { onEvent: (e: Event) => void }) {
  useWebMCPEvent("toolcanceled", onEvent);
  return null;
}

describe("visual indicators", () => {
  it("injects the stylesheet once and removes it when released", () => {
    const release1 = injectWebMCPIndicatorStyles();
    const release2 = injectWebMCPIndicatorStyles();
    expect(document.head.querySelectorAll("style[data-webmcp-indicator-styles]")).toHaveLength(1);
    release1();
    expect(document.head.querySelectorAll("style[data-webmcp-indicator-styles]")).toHaveLength(1);
    release2();
    expect(document.head.querySelectorAll("style[data-webmcp-indicator-styles]")).toHaveLength(0);
  });

  it("ToolForm with indicators renders the opt-in attribute and styles, and marks pending state", () => {
    installMockModelContext();
    const { getByTestId, unmount } = render(
      <ToolForm name="t" description="d" indicators data-testid="form" pendingTimeoutMs={0}>
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    expect(form.hasAttribute("data-webmcp-indicators")).toBe(true);
    expect(document.head.querySelector("style[data-webmcp-indicator-styles]")).not.toBeNull();

    act(() => {
      dispatchToolEvent("toolactivated", "t");
    });
    expect(form.getAttribute("data-webmcp-active")).toBe("true");

    act(() => {
      form.reset();
    });
    expect(form.hasAttribute("data-webmcp-active")).toBe(false);

    unmount();
    expect(document.head.querySelector("style[data-webmcp-indicator-styles]")).toBeNull();
  });
});

describe("ToolForm autoSubmit default", () => {
  // Review mode (no toolautosubmit) is hazardous in current Chromium: one
  // pending invocation per form, and a re-invoke drops the previous reply
  // and kills the page's WebMCP channel. The safe default is therefore
  // auto-submission; review mode is an explicit opt-in.
  it("renders toolautosubmit by default", () => {
    installMockModelContext();
    const { getByTestId } = render(
      <ToolForm name="t" description="d" data-testid="form">
        <button type="submit">go</button>
      </ToolForm>,
    );
    expect((getByTestId("form") as HTMLFormElement).hasAttribute("toolautosubmit")).toBe(true);
  });

  it("omits toolautosubmit when autoSubmit is explicitly false", () => {
    installMockModelContext();
    const { getByTestId } = render(
      <ToolForm name="t" description="d" autoSubmit={false} data-testid="form">
        <button type="submit">go</button>
      </ToolForm>,
    );
    expect((getByTestId("form") as HTMLFormElement).hasAttribute("toolautosubmit")).toBe(false);
  });
});

describe("ToolForm invocation lifecycle", () => {
  it("tracks pending state through onPendingChange and clears it when answered", async () => {
    installMockModelContext();
    const pendingChanges: boolean[] = [];
    const { getByTestId } = render(
      <ToolForm
        name="send-feedback"
        description="d"
        onAgentSubmit={() => "ok"}
        onPendingChange={(p) => pendingChanges.push(p)}
        data-testid="form"
      >
        <input name="message" />
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;

    act(() => {
      dispatchToolEvent("toolactivated", "send-feedback");
    });
    expect(pendingChanges).toEqual([true]);
    expect(form.getAttribute("data-webmcp-active")).toBe("true");

    const { respondWith } = agentSubmit(form);
    await act(async () => {
      await respondWith.mock.calls[0]?.[0];
    });
    expect(pendingChanges).toEqual([true, false]);
    expect(form.hasAttribute("data-webmcp-active")).toBe(false);
  });

  it("ignores activations for other tools", () => {
    installMockModelContext();
    const pendingChanges: boolean[] = [];
    const { getByTestId } = render(
      <ToolForm
        name="mine"
        description="d"
        onPendingChange={(p) => pendingChanges.push(p)}
        data-testid="form"
      >
        <button type="submit">go</button>
      </ToolForm>,
    );
    act(() => {
      dispatchToolEvent("toolactivated", "other-tool");
    });
    expect(pendingChanges).toEqual([]);
    expect((getByTestId("form") as HTMLFormElement).hasAttribute("data-webmcp-active")).toBe(false);
  });

  // Immediate review mode (the default for autoSubmit={false}): every
  // invocation is answered right away with a staged acknowledgement, so no
  // browser-side pending state can ever be clobbered by a re-invoke.
  describe("immediate review mode (default)", () => {
    function renderImmediate(onAgentSubmit?: () => string) {
      installMockModelContext();
      const pendingChanges: boolean[] = [];
      const utils = render(
        <ToolForm
          name="send-feedback"
          description="d"
          autoSubmit={false}
          onAgentSubmit={onAgentSubmit}
          onPendingChange={(p) => pendingChanges.push(p)}
          data-testid="form"
        >
          <input name="message" />
          <button type="submit">go</button>
        </ToolForm>,
      );
      const form = utils.getByTestId("form") as HTMLFormElement;
      const requestSubmit = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});
      return { ...utils, form, requestSubmit, pendingChanges };
    }

    it("requests the staged answer submit on toolactivated and keeps the review state", () => {
      const { form, requestSubmit, pendingChanges } = renderImmediate();
      act(() => {
        dispatchToolEvent("toolactivated", "send-feedback");
      });
      expect(requestSubmit).toHaveBeenCalledTimes(1);
      expect(form.getAttribute("data-webmcp-active")).toBe("true");
      expect(pendingChanges).toEqual([true]);
    });

    it("answers the agent submit with the staged message, not onAgentSubmit", async () => {
      const onAgentSubmit = vi.fn(() => "real result");
      const { form } = renderImmediate(onAgentSubmit);
      act(() => {
        dispatchToolEvent("toolactivated", "send-feedback");
      });
      const { respondWith, event } = agentSubmit(form);
      expect(event.defaultPrevented).toBe(true);
      const response = (await respondWith.mock.calls[0]?.[0]) as ToolResponse;
      expect(response.content[0]?.text).toContain("review and submit it manually");
      expect(onAgentSubmit).not.toHaveBeenCalled();
      // The staged answer does NOT end the review — the user still has to act.
      expect(form.getAttribute("data-webmcp-active")).toBe("true");
    });

    it("does not report an overlap on a repeat invocation (nothing pending browser-side)", () => {
      const { requestSubmit } = renderImmediate();
      act(() => {
        dispatchToolEvent("toolactivated", "send-feedback");
        dispatchToolEvent("toolactivated", "send-feedback");
      });
      expect(requestSubmit).toHaveBeenCalledTimes(2); // both invocations answered
      expect(diagnostics.some((d) => d.code === "invocation-overlap")).toBe(false);
    });

    it("clears the review state on the user's real submit", () => {
      const { form, pendingChanges } = renderImmediate();
      act(() => {
        dispatchToolEvent("toolactivated", "send-feedback");
      });
      const event = new Event("submit", { bubbles: true, cancelable: true });
      act(() => {
        form.dispatchEvent(event); // plain human submit: no agentInvoked
      });
      expect(form.hasAttribute("data-webmcp-active")).toBe(false);
      expect(pendingChanges).toEqual([true, false]);
    });
  });

  // The re-invoke guard simulates Chromium's behavior: a re-invocation's
  // form fill dispatches plain (non-InputEvent) input events on unfocused
  // controls BEFORE the old reply slot is overwritten — form.reset() in that
  // window releases the old invocation properly and saves the channel.
  describe("re-invoke guard", () => {
    function renderGuarded(extra: Partial<ToolFormProps> = {}) {
      installMockModelContext();
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const utils = render(
        <ToolForm
          name="send-feedback"
          description="d"
          autoSubmit={false}
          reviewResponse="on-submit"
          {...extra}
          data-testid="form"
        >
          <input name="message" defaultValue="" />
          <select name="rating" defaultValue="5">
            {["1", "5"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button type="submit">go</button>
        </ToolForm>,
      );
      const form = utils.getByTestId("form") as HTMLFormElement;
      const message = form.elements.namedItem("message") as HTMLInputElement;
      act(() => {
        dispatchToolEvent("toolactivated", "send-feedback"); // invocation 1 pending
      });
      return { ...utils, form, message };
    }

    function simulateAgentFill(message: HTMLInputElement, value: string) {
      message.value = value; // programmatic fill...
      message.dispatchEvent(new Event("input", { bubbles: true })); // ...plain Event, unfocused target
    }

    it("releases the pending invocation via reset and preserves the new fill", () => {
      const { form, message } = renderGuarded();
      const reset = vi.spyOn(form, "reset");
      act(() => {
        simulateAgentFill(message, "second invocation text");
      });
      expect(reset).toHaveBeenCalledTimes(1);
      // Values survive the reset (whole-form snapshot/restore):
      expect(message.value).toBe("second invocation text");
      // The old invocation's pending state is gone:
      expect(form.hasAttribute("data-webmcp-active")).toBe(false);
      expect(diagnostics.some((d) => d.code === "invocation-reinvoked" && d.level === "warn")).toBe(
        true,
      );
    });

    it("treats even an InputEvent on an unfocused control as a fill", () => {
      // Real typing always targets the focused control; an InputEvent on an
      // unfocused control can only be programmatic, so the guard must act —
      // whatever event class the browser's fill uses.
      const { form, message } = renderGuarded();
      const reset = vi.spyOn(form, "reset");
      act(() => {
        message.value = "programmatic";
        message.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }),
        );
      });
      expect(reset).toHaveBeenCalledTimes(1);
      expect(message.value).toBe("programmatic");
    });

    it("ignores changes on the focused control", () => {
      const { form, message } = renderGuarded();
      const reset = vi.spyOn(form, "reset");
      act(() => {
        message.focus();
        message.value = "focused edit";
        message.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(reset).not.toHaveBeenCalled();
    });

    it("does nothing while no invocation is pending", () => {
      installMockModelContext();
      const { getByTestId } = render(
        <ToolForm
          name="t"
          description="d"
          autoSubmit={false}
          reviewResponse="on-submit"
          data-testid="form"
        >
          <input name="message" />
          <button type="submit">go</button>
        </ToolForm>,
      );
      const form = getByTestId("form") as HTMLFormElement;
      const reset = vi.spyOn(form, "reset");
      const message = form.elements.namedItem("message") as HTMLInputElement;
      act(() => {
        simulateAgentFill(message, "x");
      });
      expect(reset).not.toHaveBeenCalled();
    });

    it("can be disabled with reinvokeGuard={false}", () => {
      const { form, message } = renderGuarded({ reinvokeGuard: false });
      const reset = vi.spyOn(form, "reset");
      act(() => {
        simulateAgentFill(message, "x");
      });
      expect(reset).not.toHaveBeenCalled();
    });
  });

  it("reports an overlapping invocation as an error diagnostic (on-submit review)", () => {
    installMockModelContext();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ToolForm
        name="send-feedback"
        description="d"
        autoSubmit={false}
        reviewResponse="on-submit"
        data-testid="form"
      >
        <button type="submit">go</button>
      </ToolForm>,
    );
    act(() => {
      dispatchToolEvent("toolactivated", "send-feedback");
      dispatchToolEvent("toolactivated", "send-feedback");
    });
    const overlap = diagnostics.find((d) => d.code === "invocation-overlap");
    expect(overlap?.level).toBe("error");
    expect(overlap?.toolName).toBe("send-feedback");
    expect(error).toHaveBeenCalled();
  });

  it("auto-cancels a stale pending invocation via form.reset() after pendingTimeoutMs", () => {
    vi.useFakeTimers();
    installMockModelContext();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByTestId } = render(
      <ToolForm name="send-feedback" description="d" pendingTimeoutMs={5000} data-testid="form">
        <input name="message" />
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    const reset = vi.spyOn(form, "reset");

    act(() => {
      dispatchToolEvent("toolactivated", "send-feedback");
    });
    expect(form.getAttribute("data-webmcp-active")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(form.hasAttribute("data-webmcp-active")).toBe(false);
    expect(diagnostics.some((d) => d.code === "invocation-timeout")).toBe(true);
  });

  it("does not fire the watchdog once the invocation was answered", async () => {
    vi.useFakeTimers();
    installMockModelContext();
    const { getByTestId } = render(
      <ToolForm
        name="send-feedback"
        description="d"
        pendingTimeoutMs={5000}
        onAgentSubmit={() => "ok"}
        data-testid="form"
      >
        <input name="message" />
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    const reset = vi.spyOn(form, "reset");

    act(() => {
      dispatchToolEvent("toolactivated", "send-feedback");
    });
    const { respondWith } = agentSubmit(form);
    await act(async () => {
      await respondWith.mock.calls[0]?.[0];
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(reset).not.toHaveBeenCalled();
  });

  it("resetAfterAgentSubmit resets the form one tick after answering", async () => {
    vi.useFakeTimers();
    installMockModelContext();
    const { getByTestId } = render(
      <ToolForm
        name="send-feedback"
        description="d"
        resetAfterAgentSubmit
        onAgentSubmit={() => "ok"}
        data-testid="form"
      >
        <input name="message" defaultValue="" />
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    const reset = vi.spyOn(form, "reset");

    const { respondWith } = agentSubmit(form);
    await act(async () => {
      await respondWith.mock.calls[0]?.[0];
    });
    // Deferred: must NOT reset synchronously (that would cancel the
    // response delivery in Chromium), only on the next macrotask.
    expect(reset).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports a loud error when respondWith is unavailable on an agent submit", () => {
    installMockModelContext();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getByTestId } = render(
      <ToolForm name="t" description="d" onAgentSubmit={() => "ok"} data-testid="form">
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    Object.assign(event, { agentInvoked: true }); // no respondWith
    act(() => {
      form.dispatchEvent(event);
    });
    expect(diagnostics.some((d) => d.code === "respondwith-missing" && d.level === "error")).toBe(
      true,
    );
  });

  it("warns when an agent submit has no onAgentSubmit handler (navigation fallback)", () => {
    installMockModelContext();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByTestId } = render(
      <ToolForm name="t" description="d" data-testid="form">
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    agentSubmit(form);
    expect(diagnostics.some((d) => d.code === "agent-submit-navigation" && d.level === "warn")).toBe(
      true,
    );
  });

  it("emits agent-submit and agent-response diagnostics with field names only", async () => {
    installMockModelContext();
    const { getByTestId } = render(
      <ToolForm name="t" description="d" onAgentSubmit={() => "done"} data-testid="form">
        <input name="message" defaultValue="secret value" />
        <button type="submit">go</button>
      </ToolForm>,
    );
    const form = getByTestId("form") as HTMLFormElement;
    const { respondWith } = agentSubmit(form);
    const response = (await respondWith.mock.calls[0]?.[0]) as ToolResponse;
    expect(response.content[0]?.text).toBe("done");

    const submitDiag = diagnostics.find((d) => d.code === "agent-submit");
    expect(submitDiag?.detail).toEqual({ fields: ["message"] });
    // Field values must never leak into diagnostics at the submit stage.
    expect(JSON.stringify(submitDiag)).not.toContain("secret value");
    expect(diagnostics.some((d) => d.code === "agent-response")).toBe(true);
  });
});
