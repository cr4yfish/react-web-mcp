"use client";

import { motion } from "motion/react";
import changelog from "../../../CHANGELOG.json";
import { Badge } from "@/components/ui/badge";

type Entry = {
  version: string;
  date: string;
  released: boolean;
  changes: Array<{ type: string; text: string }>;
};

const TYPE_STYLE: Record<string, string> = {
  added: "text-primary",
  changed: "text-foreground/70",
  fixed: "text-foreground/70",
  removed: "text-foreground/50",
  security: "text-foreground",
};

// CHANGELOG.json at the repo root is the single source of truth — every
// change in the package repo lands with an entry (enforced via CLAUDE.md),
// so this section tracks releases automatically.
export function Changelog() {
  const entries = changelog as Entry[];

  return (
    <section id="changelog" className="mx-auto max-w-6xl px-6 py-20">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Changelog
      </motion.h2>

      <div className="mt-8 space-y-10 border-l border-border pl-6">
        {entries.map((entry) => (
          <motion.article
            key={entry.version}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            <span className="absolute -left-[31px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-mono text-lg font-semibold">v{entry.version}</h3>
              <Badge variant={entry.released ? "success" : "outline"}>
                {entry.released ? entry.date : "unreleased"}
              </Badge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {entry.changes.map((change) => (
                <li key={change.text} className="flex gap-3 text-sm">
                  <span
                    className={`w-16 shrink-0 font-mono text-xs leading-6 ${TYPE_STYLE[change.type] ?? ""}`}
                  >
                    {change.type}
                  </span>
                  <span className="text-muted-foreground">{change.text}</span>
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
