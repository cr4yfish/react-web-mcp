import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tiny dependency-free TS/TSX highlighter: comments, strings, keywords.
// Good enough for short marketing snippets; not a general-purpose parser.
const TOKEN =
  /(\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|let|function|return|async|await|new|type|interface|true|false|null|default)\b/g;

function highlight(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(code.slice(last, index));
    const [text, stringOrComment, keyword] = match;
    if (stringOrComment !== undefined) {
      nodes.push(
        <span
          key={key++}
          className={
            stringOrComment.startsWith("//") ? "text-muted-foreground" : "text-primary"
          }
        >
          {text}
        </span>,
      );
    } else if (keyword !== undefined) {
      nodes.push(
        <span key={key++} className="text-foreground/60">
          {text}
        </span>,
      );
    }
    last = index + text.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-[13px] leading-relaxed text-foreground/90",
        className,
      )}
    >
      <code>{highlight(code)}</code>
    </pre>
  );
}
