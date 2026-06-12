import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The package is consumed via file:.. — transpile so its committed dist
  // and the site always bundle consistently.
  transpilePackages: ["@cr4yfish/react-web-mcp"],
};

export default nextConfig;
