# react-web-mcp site

Marketing/docs site for `@cr4yfish/react-web-mcp`. Next.js (App Router) + Tailwind v4 + shadcn-style components + motion. The page dogfoods the package: it registers `add-item`, `clear-list`, and `set-accent-color` as live WebMCP tools and renders the repo's `CHANGELOG.json` automatically.

## Develop

```bash
cd site
pnpm install
pnpm dev
```

The package is consumed via `file:..` — the site always runs against the repo's current `dist/` (run `pnpm build` at the repo root after changing `src/`).

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `site`.
3. Keep **"Include source files outside of the Root Directory"** enabled (default) — required for the `file:..` dependency and the `CHANGELOG.json` import.
4. Framework preset: Next.js. No env vars needed.

To enable WebMCP for visitors on Chrome 149+ without the flag, register the production domain for the [WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) and add the token as a `<meta httpEquiv="origin-trial">` tag in `app/layout.tsx`.
