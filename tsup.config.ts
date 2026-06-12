import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react"],
    // The main entry contains hooks/components; the directive lets RSC apps
    // import them directly without their own client boundary file.
    banner: { js: '"use client";' },
  },
  {
    entry: { vanilla: "src/vanilla.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react"],
  },
]);
