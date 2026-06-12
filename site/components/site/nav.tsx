"use client";

import { Github } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "React", href: "/" },
  { label: "Skill", href: "/skill" },
  { label: "Demo", href: "/#demo" },
];

// Shared header so the site reads as dual-product: the react-web-mcp package
// and the framework-agnostic web-mcp-skill both have a front door.
export function Nav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <a href="/" className="font-mono text-sm font-semibold tracking-tight">
          <span className="text-primary">web</span>mcp
        </a>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Button variant="ghost" size="icon" asChild className="ml-1">
            <a href="https://github.com/cr4yfish/react-web-mcp" aria-label="GitHub">
              <Github />
            </a>
          </Button>
        </nav>
      </div>
    </motion.header>
  );
}
