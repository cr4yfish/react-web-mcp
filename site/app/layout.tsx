import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "react-web-mcp — React hooks for WebMCP",
  description:
    "Expose your React app's functionality as tools for in-browser AI agents. Zero dependencies, SSR-safe, spec-current WebMCP bindings for React and Next.js.",
  metadataBase: new URL("https://react-web-mcp.vercel.app"),
  openGraph: {
    title: "react-web-mcp — your React app, callable",
    description:
      "React hooks and components for the WebMCP standard. Make your app agent-ready in one hook.",
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
