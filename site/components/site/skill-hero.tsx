"use client";

import { ArrowLeft, Github } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CopyCommand } from "./copy-command";

const INSTALL = "npx skills add cr4yfish/web-mcp-skill";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const AGENTS = ["Claude Code", "Codex", "Cursor", "OpenCode", "+ more"];

export function SkillHero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 lg:pt-28">
        <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            agent skill · framework-agnostic
          </span>
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl"
        >
          Make your agent a<br />
          <span className="text-primary">WebMCP expert.</span>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mt-5 max-w-xl text-balance text-lg text-foreground/85"
        >
          <span className="font-mono text-primary">web-mcp-skill</span> is a single agent skill
          that teaches your coding assistant the entire{" "}
          <a
            href="https://developer.chrome.com/docs/ai/webmcp"
            className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            WebMCP
          </a>{" "}
          standard — so it ships correct tools in any web app, on any framework, the first time.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <CopyCommand command={INSTALL} />
          <Button variant="secondary" size="lg" asChild>
            <a href="https://github.com/cr4yfish/web-mcp-skill">
              <Github /> GitHub
            </a>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <a href="/">
              <ArrowLeft /> Using React?
            </a>
          </Button>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="mt-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="font-mono">works with</span>
          {AGENTS.map((agent) => (
            <span
              key={agent}
              className="rounded-md border border-border bg-card px-2.5 py-1 font-mono"
            >
              {agent}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
