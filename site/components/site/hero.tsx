"use client";

import { useWebMCP } from "@cr4yfish/react-web-mcp";
import { Check, Copy, Github } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentTerminal } from "./agent-terminal";

const INSTALL = "pnpm add @cr4yfish/react-web-mcp";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  const { isSupported } = useWebMCP();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — leave the text selectable
    }
  };

  return (
    <section className="bg-grid relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-24 lg:grid-cols-2 lg:items-center lg:pt-32">
        <div>
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <Badge variant={isSupported ? "success" : "outline"}>
              <span
                className={`size-1.5 rounded-full ${isSupported ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
              />
              {isSupported
                ? "WebMCP detected — this page is agent-ready"
                : "WebMCP: Chrome 146+ · chrome://flags/#enable-webmcp-testing"}
            </Badge>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            Your React app,
            <br />
            <span className="text-primary">callable.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-5 max-w-md text-balance text-muted-foreground"
          >
            React hooks for{" "}
            <a
              href="https://developer.chrome.com/docs/ai/webmcp"
              className="underline decoration-border underline-offset-4 hover:text-foreground"
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
            <button
              type="button"
              onClick={copy}
              className="group inline-flex h-11 items-center gap-3 rounded-md border border-border bg-card px-4 font-mono text-sm hover:border-primary/50"
            >
              <span className="text-primary">$</span>
              {INSTALL}
              {copied ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>
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
