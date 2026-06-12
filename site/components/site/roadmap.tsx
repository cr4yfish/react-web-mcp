"use client";

import { motion } from "motion/react";
import roadmap from "../../../ROADMAP.json";
import { Badge } from "@/components/ui/badge";

type Milestone = {
  version: string;
  title: string;
  status: string;
  items: string[];
};

const STATUS_BADGE: Record<string, "success" | "default" | "outline"> = {
  done: "success",
  "in-progress": "default",
  planned: "outline",
};

// ROADMAP.json at the repo root is the single source of truth — milestones
// run in ascending order up to v1.0 and their statuses are updated as
// releases land, so this section tracks the plan automatically.
export function Roadmap() {
  const milestones = roadmap as Milestone[];

  return (
    <section id="roadmap" className="mx-auto max-w-6xl px-6 py-20">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Roadmap
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-3 max-w-2xl text-sm text-muted-foreground"
      >
        Each release automates more of the work, until v1.0 converts an
        existing React app into a full WebMCP tool surface automatically.
      </motion.p>

      <div className="mt-8 space-y-10 border-l border-border pl-6">
        {milestones.map((milestone) => (
          <motion.article
            key={milestone.version}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <span
              className={`absolute -left-[31px] top-1.5 size-2.5 rounded-full border-2 border-background ${
                milestone.status === "planned" ? "bg-border" : "bg-primary"
              }`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-mono text-lg font-semibold">
                v{milestone.version}
              </h3>
              <span className="text-sm text-foreground/80">{milestone.title}</span>
              <Badge variant={STATUS_BADGE[milestone.status] ?? "outline"}>
                {milestone.status}
              </Badge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {milestone.items.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-border" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
