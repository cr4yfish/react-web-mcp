const COLUMNS = [
  {
    heading: "react-web-mcp",
    links: [
      { label: "GitHub", href: "https://github.com/cr4yfish/react-web-mcp" },
      { label: "npm", href: "https://www.npmjs.com/package/@cr4yfish/react-web-mcp" },
    ],
  },
  {
    heading: "web-mcp-skill",
    links: [
      { label: "Skill page", href: "/skill" },
      { label: "GitHub", href: "https://github.com/cr4yfish/web-mcp-skill" },
      { label: "skills.sh", href: "https://www.skills.sh" },
    ],
  },
  {
    heading: "WebMCP",
    links: [
      { label: "Spec", href: "https://github.com/webmachinelearning/webmcp" },
      { label: "Chrome docs", href: "https://developer.chrome.com/docs/ai/webmcp" },
      { label: "Official demos", href: "https://github.com/GoogleChromeLabs/webmcp-tools" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="font-mono text-xs font-semibold text-foreground">{column.heading}</p>
            <nav className="mt-3 flex flex-col gap-2">
              {column.links.map((link) => (
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
        ))}
      </div>
      <div className="mx-auto max-w-6xl border-t border-border/60 px-6 py-5">
        <p className="font-mono text-xs text-muted-foreground">
          WebMCP for the web · MIT · by cr4yfish
        </p>
      </div>
    </footer>
  );
}
