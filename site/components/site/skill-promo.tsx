"use client";

import { ArrowRight, Boxes, Sparkles, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CopyCommand } from "./copy-command";

const SKILL_INSTALL = "npx skills add cr4yfish/web-mcp-skill";

const FRAMEWORKS = ["Vanilla JS", "React", "Vue", "Svelte", "Angular"];

// Cross-sell the framework-agnostic skill from the React-focused homepage.
// React users get the package; everyone else gets the skill.
export function SkillPromo() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
            <Sparkles className="size-3.5" />
            Not on React?
          </span>

          <h2 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
            WebMCP for every framework — install the skill.
          </h2>
          <p className="mt-3 max-w-xl text-balance text-foreground/85">
            <span className="font-mono text-primary">web-mcp-skill</span> turns your coding
            agent into a WebMCP expert. The whole standard — imperative + declarative APIs,
            schema synthesis, security model, evals — distilled into one agent skill. It works
            anywhere your app does, not just React.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {FRAMEWORKS.map((framework) => (
              <span
                key={framework}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2.5 py-1 font-mono text-xs text-muted-foreground"
              >
                <Boxes className="size-3 text-primary/70" />
                {framework}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CopyCommand command={SKILL_INSTALL} />
            <Button size="lg" asChild>
              <a href="/skill">
                <Terminal /> Explore the skill <ArrowRight />
              </a>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
