"use client";

import { Github } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { AgentTerminal } from "./agent-terminal";
import { CopyCommand } from "./copy-command";

const INSTALL = "pnpm add @cr4yfish/react-web-mcp";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Backdrop on its own layer: the radial mask on .bg-grid would
          otherwise fade the hero text along with the grid. */}
      <div aria-hidden className="bg-grid absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-24 lg:grid-cols-2 lg:items-center lg:pt-32">
        <div>
          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            Your React app,
            <br />
            <span className="text-primary">callable.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-5 max-w-md text-balance text-lg text-foreground/85"
          >
            React hooks for{" "}
            <a
              href="https://developer.chrome.com/docs/ai/webmcp"
              className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              WebMCP
            </a>
            . Expose app functionality as tools for in-browser AI agents — one hook,
            zero dependencies, SSR-safe.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <CopyCommand command={INSTALL} />
            <Button variant="secondary" size="lg" asChild>
              <a href="https://github.com/cr4yfish/react-web-mcp">
                <Github /> GitHub
              </a>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AgentTerminal />
        </motion.div>
      </div>
    </section>
  );
}
