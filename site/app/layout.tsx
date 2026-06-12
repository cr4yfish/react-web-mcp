import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "react-web-mcp — React hooks for WebMCP",
    template: "%s",
  },
  description:
    "Make any web app agent-ready with WebMCP. React hooks (react-web-mcp) plus a framework-agnostic agent skill (web-mcp-skill) for vanilla JS, Vue, Svelte, and Angular. SSR-safe, zero dependencies, spec-current.",
  metadataBase: new URL("https://react-web-mcp.vercel.app"),
  keywords: [
    "WebMCP",
    "Web Model Context Protocol",
    "react-web-mcp",
    "web-mcp-skill",
    "agent skill",
    "in-browser AI agents",
    "MCP",
    "React",
    "vanilla JS",
    "Vue",
    "Svelte",
    "Angular",
  ],
  openGraph: {
    title: "WebMCP for React and every other framework",
    description:
      "react-web-mcp hooks for React, plus web-mcp-skill — one agent skill that teaches the whole WebMCP standard for any framework.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
