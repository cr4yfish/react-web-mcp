const LINKS = [
  { label: "GitHub", href: "https://github.com/cr4yfish/react-web-mcp" },
  { label: "npm", href: "https://www.npmjs.com/package/@cr4yfish/react-web-mcp" },
  { label: "WebMCP spec", href: "https://github.com/webmachinelearning/webmcp" },
  { label: "Chrome docs", href: "https://developer.chrome.com/docs/ai/webmcp" },
  { label: "Official demos", href: "https://github.com/GoogleChromeLabs/webmcp-tools" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <p className="font-mono text-xs text-muted-foreground">
          @cr4yfish/react-web-mcp · MIT
        </p>
        <nav className="flex flex-wrap gap-5">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
