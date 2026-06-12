"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// Looping simulation of an agent session against a WebMCP page. Purely
// visual: each step appears on a timer, then the loop restarts.
const STEPS = [
  { kind: "user", text: "add oat milk to my shopping list" },
  { kind: "agent", text: "tools/list → add-item · list-items · clear-list" },
  { kind: "call", text: 'add-item({ "text": "oat milk" })' },
  { kind: "app", text: "setItems(prev => [...prev, item])  // your code runs" },
  { kind: "result", text: '✓ Added "oat milk" — UI updated, user watching' },
] as const;

const STYLE: Record<(typeof STEPS)[number]["kind"], { label: string; cls: string }> = {
  user: { label: "user", cls: "text-foreground" },
  agent: { label: "agent", cls: "text-muted-foreground" },
  call: { label: "tool", cls: "text-primary" },
  app: { label: "app", cls: "text-muted-foreground" },
  result: { label: "done", cls: "text-primary" },
};

const STEP_MS = 1300;
const HOLD_MS = 2600;

export function AgentTerminal() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const delay = visible >= STEPS.length ? HOLD_MS : STEP_MS;
    const id = setTimeout(() => {
      setVisible((n) => (n >= STEPS.length ? 1 : n + 1));
    }, delay);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          gemini-in-chrome → your-app.example
        </span>
      </div>
      <div className="min-h-[210px] space-y-2.5 p-4 font-mono text-[13px]">
        <AnimatePresence>
          {STEPS.slice(0, visible).map((step, index) => (
            <motion.div
              key={`${visible <= index ? "x" : ""}${step.kind}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="flex gap-3"
            >
              <span className="w-12 shrink-0 select-none text-right text-muted-foreground/60">
                {STYLE[step.kind].label}
              </span>
              <span className={STYLE[step.kind].cls}>{step.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.span
          className="inline-block h-4 w-2 bg-primary"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
        />
      </div>
    </div>
  );
}
