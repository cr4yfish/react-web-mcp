"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// Click-to-copy shell command pill. Shared by the React hero and the skill
// page so both install snippets behave identically.
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — leave the text selectable
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex h-11 items-center gap-3 rounded-md border border-border bg-card px-4 font-mono text-sm hover:border-primary/50"
    >
      <span className="text-primary">$</span>
      {command}
      {copied ? (
        <Check className="size-4 text-primary" />
      ) : (
        <Copy className="size-4 text-muted-foreground group-hover:text-foreground" />
      )}
    </button>
  );
}
