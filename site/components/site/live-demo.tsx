"use client";

import { useWebMCP, useWebMCPTool } from "@cr4yfish/react-web-mcp";
import { motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_ITEMS = 20;
const MAX_TEXT = 80;
const MAX_LOG = 30;

const ACCENTS: Record<string, string> = {
  green: "oklch(0.78 0.16 155)",
  cyan: "oklch(0.78 0.13 210)",
  violet: "oklch(0.72 0.18 300)",
  amber: "oklch(0.8 0.15 75)",
};

let logId = 0;
let itemId = 0;

// This section IS the demo: the tools below are registered on this very
// page. Open DevTools → Application → WebMCP (flag enabled) and call them,
// or let a browser agent do it.
export function LiveDemo() {
  const { isSupported } = useWebMCP();
  const [items, setItems] = useState<Array<{ id: number; text: string }>>([]);
  const [log, setLog] = useState<Array<{ id: number; text: string }>>([]);

  const appendLog = (text: string) =>
    setLog((prev) => [{ id: logId++, text: text.slice(0, 120) }, ...prev].slice(0, MAX_LOG));

  const addItem = (raw: string): string => {
    const text = raw.trim().slice(0, MAX_TEXT);
    if (!text) throw new Error("`text` must be a non-empty string.");
    if (items.length >= MAX_ITEMS) {
      throw new Error(`List is full (${MAX_ITEMS}); call clear-list first.`);
    }
    setItems((prev) => [...prev, { id: itemId++, text }]);
    return text;
  };

  useWebMCPTool<{ text: string }>({
    name: "add-item",
    description: "Adds an item to the demo list on this page.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: `Item text (1-${MAX_TEXT} chars)` },
      },
      required: ["text"],
    },
    execute: ({ text }) => {
      const added = addItem(text);
      appendLog(`add-item("${added}")`);
      return `Added "${added}".`;
    },
  });

  useWebMCPTool({
    name: "clear-list",
    description: "Removes all items from the demo list on this page.",
    annotations: { destructiveHint: true, idempotentHint: true },
    execute: () => {
      appendLog("clear-list()");
      setItems([]);
      return "Cleared.";
    },
  });

  useWebMCPTool<{ color: string }>({
    name: "set-accent-color",
    description: "Changes this website's accent color.",
    inputSchema: {
      type: "object",
      properties: {
        color: {
          type: "string",
          enum: Object.keys(ACCENTS),
          description: "The accent color to switch to",
        },
      },
      required: ["color"],
    },
    execute: ({ color }) => {
      const value = ACCENTS[color];
      if (!value) throw new Error(`Unknown color. Use: ${Object.keys(ACCENTS).join(", ")}`);
      document.documentElement.style.setProperty("--site-accent", value);
      appendLog(`set-accent-color("${color}")`);
      return `Accent is now ${color}.`;
    },
  });

  return (
    <section id="demo" className="mx-auto max-w-6xl px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          This page is the demo.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Three tools are registered right now —{" "}
          <code className="font-mono text-foreground/80">add-item</code>,{" "}
          <code className="font-mono text-foreground/80">clear-list</code>,{" "}
          <code className="font-mono text-foreground/80">set-accent-color</code>. Call
          them from the DevTools WebMCP panel or a browser agent.{" "}
          {!isSupported && "No flag enabled? The buttons hit the same code paths."}
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-mono text-sm">demo list</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => {
                try {
                  appendLog(`button: add-item("${addItem("Try WebMCP")}")`);
                } catch (error) {
                  appendLog(String(error instanceof Error ? error.message : error));
                }
              }}>
                add-item
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setItems([]); appendLog("button: clear-list()"); }}>
                clear-list
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">empty — ask an agent to add something</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="truncate border-l-2 border-primary pl-3 font-mono text-sm"
                  >
                    {item.text}
                  </motion.li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              {Object.keys(ACCENTS).map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Set accent to ${color}`}
                  className="size-6 rounded-full border border-border transition-transform hover:scale-110"
                  style={{ background: ACCENTS[color] }}
                  onClick={() => {
                    document.documentElement.style.setProperty("--site-accent", ACCENTS[color] ?? "");
                    appendLog(`button: set-accent-color("${color}")`);
                  }}
                />
              ))}
              <span className="self-center font-mono text-xs text-muted-foreground">set-accent-color</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-mono text-sm">invocation log</CardTitle>
            <Badge variant={isSupported ? "success" : "outline"}>
              {isSupported ? "modelContext: live" : "modelContext: unavailable"}
            </Badge>
          </CardHeader>
          <CardContent>
            {log.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">no calls yet</p>
            ) : (
              <ol className="space-y-1 font-mono text-xs text-muted-foreground">
                {log.map((entry) => (
                  <li key={entry.id} className="truncate">
                    <span className="text-primary">→</span> {entry.text}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
