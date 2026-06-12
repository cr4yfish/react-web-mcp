"use client";

import {
  ArrowRight,
  Code2,
  FileText,
  FlaskConical,
  GitCompare,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const COVERS = [
  {
    icon: Code2,
    title: "Imperative API",
    text: "document.modelContext / navigator.modelContext, registerTool, provideContext, events, AbortSignal teardown, Permissions Policy.",
  },
  {
    icon: FileText,
    title: "Declarative API",
    text: "toolname / tooldescription form attributes, schema synthesis from controls, SubmitEvent.respondWith, the :tool-form-active CSS hooks.",
  },
  {
    icon: ShieldCheck,
    title: "Security model",
    text: "Prompt injection both ways, exposure scope, untrustedContentHint, and human-in-the-loop design as a first-class default.",
  },
  {
    icon: Wrench,
    title: "Best practices",
    text: "Tool granularity, action-oriented naming, tight schemas, compact outputs, actionable isError responses, lifecycle.",
  },
  {
    icon: FlaskConical,
    title: "Testing & evals",
    text: "The DevTools WebMCP panel, the official evals CLI, ModelContext mocking patterns for unit tests.",
  },
  {
    icon: GitCompare,
    title: "WebMCP vs. backend MCP",
    text: "When to reach for an in-page tool versus a server one — and how the two compose in one product.",
  },
];

export function SkillContent() {
  return (
    <>
      {/* What's inside */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            One file. The whole standard.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            <code className="font-mono text-foreground/80">SKILL.md</code> is a complete WebMCP
            reference your agent loads on demand — no guessing, no stale training data.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COVERS.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (index % 3) * 0.08 }}
            >
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <item.icon className="mb-1 size-5 text-primary" />
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Framework-agnostic emphasis */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="grid items-center gap-8 rounded-2xl border border-border bg-card p-8 sm:p-12 lg:grid-cols-2"
        >
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Works on everything.
            </h2>
            <p className="mt-3 text-balance text-foreground/85">
              The skill covers the standard itself, not a library. That makes it
              framework-agnostic by construction — vanilla JS, React, Vue, Svelte, Angular, or
              whatever you reach for next. The same guidance applies because it&apos;s the same
              browser API underneath.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Vanilla JS", "React", "Vue", "Svelte", "Angular", "Anything else"].map(
              (framework) => (
                <div
                  key={framework}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-4 py-3 font-mono text-sm"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                  {framework}
                </div>
              ),
            )}
          </div>
        </motion.div>
      </section>

      {/* React cross-link */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:flex-row sm:items-center"
        >
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Building in React?</h2>
            <p className="mt-2 max-w-lg text-sm text-foreground/85">
              Pair the skill with{" "}
              <span className="font-mono text-primary">@cr4yfish/react-web-mcp</span> — zero-dep
              hooks and components that already handle every integration gotcha the skill warns
              about.
            </p>
          </div>
          <Button size="lg" asChild>
            <a href="/">
              See react-web-mcp <ArrowRight />
            </a>
          </Button>
        </motion.div>
      </section>
    </>
  );
}
