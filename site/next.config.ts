import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The package is consumed via file:.. — transpile so its committed dist
  // and the site always bundle consistently.
  transpilePackages: ["@cr4yfish/react-web-mcp"],
  // Pin the workspace root to the repo root (one level up). Both site/ and
  // the repo root carry a pnpm-workspace.yaml, so Turbopack otherwise warns
  // about ambiguous roots — and the root must stay above site/ so the
  // package (file:..) and CHANGELOG.json imports resolve.
  turbopack: {
    root: path.join(import.meta.dirname, ".."),
  },
};

export default nextConfig;
