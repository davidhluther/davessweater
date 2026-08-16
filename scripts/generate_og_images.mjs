// prebuild step: render the per-town / per-post / per-month share cards to
// static PNGs under public/og/.
//
// These used to be `opengraph-image.tsx` + `twitter-image.tsx` routes under
// dynamic segments. Next emits one Serverless Function per dynamic-segment
// route directory even when the route is fully prerendered, and this repo
// deploys on Vercel Hobby with a hard 12-function cap — ten such routes put the
// build 6 over the ceiling and froze production for a week in August 2026.
// Files cost zero functions. See src/lib/ogStatic.ts and CHECKLIST.md.
//
// The card renderer (`src/lib/ogCard.tsx`) and the data loaders are shared with
// the site, so there is no second copy of the design to drift. esbuild bundles
// them here only because plain Node cannot resolve TSX or the `@/` alias.

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as esbuild from "esbuild";

const ROOT = process.cwd();
const BUNDLE = join(ROOT, "node_modules", ".cache", "og-cards.mjs");
const OUT_DIR = join(ROOT, "public", "og");

// next/og ships as an unsuffixed subpath that Node's ESM resolver rejects, so
// keep it external and hand Node the explicit file it will accept.
const externalNextOg = {
  name: "external-next-og",
  setup(build) {
    build.onResolve({ filter: /^next\/og$/ }, () => ({ path: "next/og.js", external: true }));
  },
};

await mkdir(join(ROOT, "node_modules", ".cache"), { recursive: true });
await esbuild.build({
  entryPoints: [join(ROOT, "scripts", "og", "cards.tsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  jsx: "automatic",
  outfile: BUNDLE,
  alias: { "@": join(ROOT, "src") },
  plugins: [externalNextOg],
  logLevel: "error",
});

// Rebuild from scratch so a renamed town or unpublished post cannot leave a
// stale card behind for crawlers to keep serving.
await rm(OUT_DIR, { recursive: true, force: true });

const { main } = await import(`file://${BUNDLE}`);
const count = await main();

console.log(`[generate_og_images] wrote ${count} share cards to public/og`);
