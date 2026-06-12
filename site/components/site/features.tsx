"use client";

import { Boxes, FileCode2, RefreshCw, Server, ShieldCheck, Zap } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Zap,
    title: "One hook",
    text: "useWebMCPTool registers on mount, unregisters on unmount. execute always sees fresh state — no memoization, no stale closures.",
  },
  {
    icon: Server,
    title: "SSR-safe, zero deps",
    text: "No-ops on the server and in unsupported browsers. Nothing in your bundle but the package itself; react is a peer dep.",
  },
  {
    icon: FileCode2,
    title: "Spec-current",
    text: "document.modelContext (Chrome 150+) with navigator fallback, AbortSignal unregistration, exposedTo, annotations, outputSchema.",
  },
  {
    icon: Boxes,
    title: "Any UI library",
    text: "useFormTool derives the schema from the rendered DOM form — MUI, AntD, shadcn/ui, portals. No per-library adapters.",
  },
  {
    icon: ShieldCheck,
    title: "Safe by default",
    text: "Errors become readable isError responses. Outputs are length-capped. Passwords never enter a schema. Human-in-the-loop forms.",
  },
  {
    icon: RefreshCw,
    title: "Declarative too",
    text: "ToolForm renders toolname/tooldescription attributes and answers agent submissions via respondWith — no navigation.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: (index % 3) * 0.08 }}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <feature.icon className="mb-1 size-5 text-primary" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.text}</CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
