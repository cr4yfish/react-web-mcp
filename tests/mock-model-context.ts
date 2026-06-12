import type { ModelContext, RegisterToolOptions, WebMCPTool } from "../src/types";

/** A minimal in-memory ModelContext mimicking Chrome's behavior. */
export class MockModelContext extends EventTarget implements ModelContext {
  tools = new Map<string, WebMCPTool>();

  registerTool(tool: WebMCPTool, options?: RegisterToolOptions): Promise<void> {
    this.tools.set(tool.name, tool);
    options?.signal?.addEventListener("abort", () => {
      this.tools.delete(tool.name);
      this.dispatchEvent(new Event("toolchange"));
    });
    this.dispatchEvent(new Event("toolchange"));
    return Promise.resolve();
  }

  provideContext(context: { tools: WebMCPTool[] }): void {
    this.tools.clear();
    for (const tool of context.tools) this.tools.set(tool.name, tool);
    this.dispatchEvent(new Event("toolchange"));
  }

  async call(name: string, args: Record<string, unknown>) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`No such tool: ${name}`);
    return tool.execute(args);
  }
}

export function installMockModelContext(): MockModelContext {
  const mock = new MockModelContext();
  Object.defineProperty(document, "modelContext", {
    value: mock,
    configurable: true,
    writable: true,
  });
  return mock;
}

export function uninstallMockModelContext(): void {
  // biome-ignore lint: test cleanup
  delete (document as { modelContext?: unknown }).modelContext;
}
