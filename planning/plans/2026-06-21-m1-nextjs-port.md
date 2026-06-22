# M1 — Next.js Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Dave's Sweater's Python HTML generator with a Next.js app at content parity, plus real subfolder pages, a natively integrated blog, and an embedded swag shop — leaving the Python data pipeline and scoring untouched.

**Architecture:** Statically-generated Next.js 16 (App Router) app that reads the repo's existing `data/*.json` at build time and renders the five sections as routes. One client island (`LiveConditions`) fetches Open-Meteo current conditions in the browser to recompute the "right now" sweater verdict (porting today's inline JS). Deployment cuts over from `python build_site.py` → `next build` in a final, preview-verified step; the daily GitHub Action then commits only `data/`.

**Tech Stack:** Next.js 16.2.2, React 19.2.4, TypeScript 5, Tailwind CSS 4, shadcn/ui (`base-nova`), Vitest. Mirrors `~/Projects/my-site`.

---

## Standing rules for the executor

1. **Work on branch `m1-nextjs-migration`** (already created). Do NOT commit to `main`.
2. **Next.js 16 has breaking changes vs. training data.** Before writing Next code, read the relevant guide in `node_modules/next/dist/docs/` and consult the `vercel-plugin:nextjs` skill. When in doubt, copy the pattern from the working `~/Projects/my-site` (same Next 16.2.2) — paths are given per task.
3. **Do not modify** any Python script, `data/` contents, or `.github/workflows/` until Task 14 (cutover). The live site keeps shipping from `build_site.py` the whole time.
4. **Commit after every task.** Run `npm run lint` and `npm test` before each commit from Task 2 onward.
5. Images from external hosts (YouTube, Fourthwall, Substack content) use plain `<img>` (no `next/image` remotePatterns config in M1).
6. Parity bar: each ported section should match the corresponding `scripts/build_site.py` function in content, labels, and copy. Those functions are the source of truth for exact wording.
7. **Never use `dangerouslySetInnerHTML`.** External/feed HTML (Substack post bodies) is sanitized at build with `sanitize-html` and rendered via `html-react-parser` (Task 10).

## File structure (created in this milestone)

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs,
eslint.config.mjs, components.json, vitest.config.ts, next-env.d.ts   # config
AGENTS.md                                  # Next-16 agent rules (mirrors my-site)
scripts/prepare_public.mjs                 # prebuild: copy latest data/ screenshots → public/screenshots
public/assets/{logo.svg,ray_face.svg,sweateremoji.webp}, public/{favicon.ico,apple-touch-icon.png}
src/lib/utils.ts                           # cn()
src/lib/types.ts                           # data shapes
src/lib/data.ts                            # build-time readers over data/*.json
src/lib/feeds.ts                           # YouTube + Fourthwall feed fetch/parse
src/lib/sweater.ts                         # sweater verdict logic (ported from inline JS)
src/lib/scoreboard.ts                      # season totals → rows
src/lib/html.ts                            # build-time HTML sanitizer for blog content
src/lib/__tests__/*.test.ts                # vitest unit tests
src/app/layout.tsx, globals.css, sitemap.ts, robots.ts
src/app/page.tsx                           # / (Weather)
src/app/right-wrong-ray/page.tsx
src/app/videos/page.tsx
src/app/blog/page.tsx, src/app/blog/[slug]/page.tsx
src/app/shop/page.tsx
src/components/SiteHeader.tsx, SiteFooter.tsx, UpdateBar.tsx
src/components/SweaterCard.tsx, ForecastCard.tsx, RayFaces.tsx
src/components/LiveConditions.tsx          # client island
src/components/ShopGrid.tsx                # client (modal iframe)
src/components/ui/*                         # shadcn (dialog)
```

Cutover (Task 14) modifies: `vercel.json`, `.github/workflows/daily_compare.yml`, `.gitignore`; removes `docs/` output + `scripts/build_site.py`.

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `src/lib/utils.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (temporary), `AGENTS.md`, `scripts/prepare_public.mjs`
- Modify: `.gitignore`
- Copy assets into `public/`

- [ ] **Step 1: Create `package.json`** (versions mirror `~/Projects/my-site`)

```json
{
  "name": "davessweater",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "prebuild": "node scripts/prepare_public.mjs",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "html-react-parser": "^5",
    "lucide-react": "^1.7.0",
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "sanitize-html": "^2",
    "shadcn": "^4.2.0",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/sanitize-html": "^2",
    "eslint": "^9",
    "eslint-config-next": "16.2.2",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Copy these config files verbatim from `~/Projects/my-site`** (same Next 16 project): `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`.

Run: `for f in tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs components.json; do cp ~/Projects/my-site/$f ./$f; done && ls tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs components.json`
Expected: all five listed.

- [ ] **Step 3: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Create `src/app/globals.css`** (DS light-only palette mapped to Tailwind tokens)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

:root {
  --teal: #3c5468;
  --orange: #f97316;
  --bg: #ffffff;
  --card: #f8f9fc;
  --text: #1a1a1a;
  --muted: #6b7280;
  --radius: 0.75rem;

  --background: var(--bg);
  --foreground: var(--text);
  --border: #e5e7eb;
  --ring: var(--orange);
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--text);
  --color-teal: var(--teal);
  --color-orange: var(--orange);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans: var(--font-inter);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-sm: calc(var(--radius) * 0.6);
}

@layer base {
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-inter), system-ui, sans-serif;
    line-height: 1.6;
  }
}
```

- [ ] **Step 5: Create `AGENTS.md`** (so the Next-16 rule applies in this repo)

```md
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
```

- [ ] **Step 6: Create a temporary `src/app/layout.tsx` and `src/app/page.tsx`** to make the build runnable (replaced in later tasks):

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = { title: "Dave's Sweater" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function Page() {
  return <main>Dave&apos;s Sweater — scaffold OK</main>;
}
```

- [ ] **Step 7: Create `scripts/prepare_public.mjs`** (prebuild — copies latest prediction screenshots to `public/screenshots/`; safe no-op if none)

```js
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PRED = join(process.cwd(), "data", "predictions");
const DEST = join(process.cwd(), "public", "screenshots");

function latestDir() {
  if (!existsSync(PRED)) return null;
  const dirs = readdirSync(PRED).filter((d) => statSync(join(PRED, d)).isDirectory()).sort();
  return dirs.length ? join(PRED, dirs[dirs.length - 1]) : null;
}

const src = latestDir();
if (!src) { console.log("[prepare_public] no predictions dir; skipping"); process.exit(0); }
mkdirSync(DEST, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (f.toLowerCase().endsWith(".png")) { copyFileSync(join(src, f), join(DEST, f)); n++; }
}
console.log(`[prepare_public] copied ${n} screenshot(s) from ${src}`);
```

- [ ] **Step 8: Copy brand assets into `public/`**

Run:
```bash
mkdir -p public/assets
cp assets/logo.svg assets/ray_face.svg assets/sweateremoji.webp public/assets/
cp docs/favicon.ico docs/apple-touch-icon.png public/
ls public public/assets
```
Expected: `public/` has `favicon.ico apple-touch-icon.png assets`; `public/assets` has the three brand files.

- [ ] **Step 9: Append Node/Next ignores to `.gitignore`** (keep existing Python + private-file lines)

Add these lines to the end of `.gitignore`:
```
# Next.js / Node
/node_modules
/.next/
/out/
next-env.d.ts
*.tsbuildinfo
# Build-time generated screenshots (copied from data/ by prebuild)
/public/screenshots/
```

- [ ] **Step 10: Install and build**

Run: `npm install && npm run build`
Expected: install succeeds; `next build` completes with the scaffold page. If Next 16 flags a config/API difference, fix by matching `~/Projects/my-site` and re-run.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js app (configs, globals, assets, prebuild)"
```

---

## Task 2: Vitest setup

**Files:**
- Create: `vitest.config.ts`, `src/lib/__tests__/smoke.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`** (alias `@` → `src`, node env)

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
```

- [ ] **Step 2: Write a smoke test** at `src/lib/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
```

- [ ] **Step 3: Run tests** — `npm test` → Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add vitest config and smoke test"
```

---

## Task 3: Data types + readers

**Files:**
- Create: `src/lib/types.ts`, `src/lib/data.ts`, `src/lib/__tests__/data.test.ts`

- [ ] **Step 1: Create `src/lib/types.ts`** (shapes derived from `data/comparisons/*.json`, `scores.json`, `substack_feed.json`)

```ts
export interface Actuals {
  date?: string; location?: string;
  high_f?: number; low_f?: number;
  precip_in?: number; snow_in?: number;
  wind_mph?: number; gust_mph?: number;
  weather_code?: number; conditions?: string; category?: string;
}

export interface SweaterWeather {
  answer?: string; detail?: string; layers?: string;
  emoji?: string; sweater_count?: number;
}

export interface Prediction {
  high_f?: number; low_f?: number; precip_in?: number; snow_in?: number;
  precip_prob?: number; weather_code?: number; conditions?: string;
  category?: string; wind_mph?: number;
  today_high_f?: number; tonight_low_f?: number; daytime_desc?: string; rainfall_in?: number;
}

export interface ScoreBreakdownField {
  predicted?: number; actual?: number; error_f?: number; error_mph?: number;
  predicted_in?: number; actual_in?: number; binary_correct?: boolean; error_in?: number;
  points: number; max: number;
}
export interface Score {
  score: number;
  grade: { verdict: string; ray_count: number };
  breakdown: Record<string, ScoreBreakdownField>;
}
export interface SourceEntry { prediction: Prediction; score: Score; }

export interface Comparison {
  date: string;
  generated_at?: string;
  actuals: Actuals;
  sweater_weather: SweaterWeather;
  sources: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceEntry>>;
}

export interface SourceTotals { right: number; wrong: number; meh: number; total_score: number; days: number; }
export interface Scores {
  entries: Array<Record<string, unknown>>;
  totals: Partial<Record<"openmeteo" | "raysweather" | "apple_weather", SourceTotals>>;
}

export interface BlogPost { title: string; link: string; date: string; summary?: string; content?: string; }
export interface Video { title: string; link: string; date: string; thumb?: string; }
export interface Product { name: string; link: string; image?: string; price?: string; id?: string; }
```

- [ ] **Step 2: Write the failing test** `src/lib/__tests__/data.test.ts` (runs against the real committed `data/`)

```ts
import { describe, it, expect } from "vitest";
import { getLatestComparison, getScores, getBlogPosts, slugFromLink } from "@/lib/data";

describe("data readers", () => {
  it("reads the latest comparison with actuals", async () => {
    const c = await getLatestComparison();
    expect(c).not.toBeNull();
    expect(typeof c!.date).toBe("string");
    expect(c!.actuals).toBeTruthy();
  });
  it("reads scores totals", async () => {
    const s = await getScores();
    expect(s).not.toBeNull();
    expect(s!.totals.openmeteo?.days).toBeGreaterThan(0);
  });
  it("reads blog posts", async () => {
    const posts = await getBlogPosts();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });
  it("derives slug from a substack /p/ link", () => {
    expect(slugFromLink("https://x.substack.com/p/welcome-to-daves-sweater", "Welcome"))
      .toBe("welcome-to-daves-sweater");
  });
});
```

- [ ] **Step 2b: Run it to verify it fails** — `npm test -- data` → FAIL (module not found).

- [ ] **Step 3: Create `src/lib/data.ts`**

```ts
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Comparison, Scores, BlogPost } from "@/lib/types";

const DATA = join(process.cwd(), "data");

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch { return null; }
}

export async function getLatestComparison(): Promise<Comparison | null> {
  const dir = join(DATA, "comparisons");
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  return readJson<Comparison>(join(dir, files[files.length - 1]));
}

export async function getScores(): Promise<Scores | null> {
  return readJson<Scores>(join(DATA, "scores.json"));
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const posts = (await readJson<BlogPost[]>(join(DATA, "substack_feed.json"))) ?? [];
  return [...posts].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function slugFromLink(link: string, title: string): string {
  const m = link.match(/\/p\/([^/?#]+)/);
  if (m) return m[1];
  return (title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find((p) => slugFromLink(p.link, p.title) === slug) ?? null;
}
```

- [ ] **Step 4: Run tests** — `npm test -- data` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): typed data layer reading data/*.json at build"
```

---

## Task 4: Feed fetchers (YouTube + Fourthwall)

**Files:**
- Create: `src/lib/feeds.ts`, `src/lib/__tests__/feeds.test.ts`

Ports `fetch_rss` (Atom branch) and `fetch_fourthwall_products` (Merchant RSS, grouped by `item_group_id`). Uses global `fetch`; returns `[]` on any failure.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/feeds.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseYouTubeAtom, parseMerchantRss } from "@/lib/feeds";

const ATOM = `<feed xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<entry><title>Vid One</title><link rel="alternate" href="https://youtu.be/abc"/>
<published>2026-06-01T12:00:00+00:00</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/abc/hq.jpg"/></media:group></entry></feed>`;

const RSS = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item><g:id>1</g:id><g:item_group_id>grp</g:item_group_id><g:title>Mug - Black</g:title>
<g:link>https://shop/x/mug</g:link><g:image_link>https://img/1.jpg</g:image_link><g:price>25.10 USD</g:price></item>
<item><g:id>2</g:id><g:item_group_id>grp</g:item_group_id><g:title>Mug - White</g:title>
<g:link>https://shop/x/mug</g:link><g:image_link>https://img/2.jpg</g:image_link><g:price>25.10 USD</g:price></item>
</channel></rss>`;

describe("feed parsers", () => {
  it("parses YouTube atom entries", () => {
    const v = parseYouTubeAtom(ATOM);
    expect(v[0]).toMatchObject({ title: "Vid One", link: "https://youtu.be/abc", date: "2026-06-01" });
    expect(v[0].thumb).toContain("ytimg");
  });
  it("parses + dedupes merchant products by item_group_id", () => {
    const p = parseMerchantRss(RSS);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: "Mug", price: "$25.10", image: "https://img/1.jpg" });
  });
});
```

- [ ] **Step 1b: Run it** — `npm test -- feeds` → FAIL.

- [ ] **Step 2: Create `src/lib/feeds.ts`**

```ts
import type { Video, Product } from "@/lib/types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const YOUTUBE_RSS =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCLQdHEMoKkrNc3PgWs3SksA";
const MERCHANT_FEED =
  "https://daves-sweater-shop.fourthwall.com/.well-known/merchant-center/rss.xml";

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : "";
}

export function parseYouTubeAtom(xml: string, max = 6): Video[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.slice(0, max).map((e) => {
    const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    const thumb = e.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? "";
    return { title: tag(e, "title"), link, date: tag(e, "published").slice(0, 10), thumb };
  });
}

export function parseMerchantRss(xml: string): Product[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const seen = new Map<string, Product>();
  for (const it of items) {
    const group = tag(it, "g:item_group_id");
    const id = tag(it, "g:id");
    const key = group || id;
    if (!key || seen.has(key)) continue;
    let name = tag(it, "g:title") || tag(it, "title");
    if (group && name.includes(" - ")) name = name.slice(0, name.lastIndexOf(" - "));
    const link = tag(it, "g:link") || tag(it, "link");
    const image = tag(it, "g:image_link");
    const priceRaw = tag(it, "g:price"); // "25.10 USD"
    let price = "";
    if (priceRaw) {
      const n = parseFloat(priceRaw.split(/\s+/)[0]);
      price = Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
    }
    seen.set(key, { name, link, image, price, id });
  }
  return [...seen.values()];
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" } });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

export async function getVideos(): Promise<Video[]> {
  const xml = await fetchText(YOUTUBE_RSS);
  return xml ? parseYouTubeAtom(xml) : [];
}

export async function getProducts(): Promise<Product[]> {
  const xml = await fetchText(MERCHANT_FEED);
  return xml ? parseMerchantRss(xml) : [];
}
```

- [ ] **Step 3: Run tests** — `npm test -- feeds` → PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): YouTube + Fourthwall feed parsers with tests"
```

---

## Task 5: Sweater logic

**Files:**
- Create: `src/lib/sweater.ts`, `src/lib/__tests__/sweater.test.ts`

Ports the blended-formula bands from the inline JS and the ray-count helper from `verdict_html`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/sweater.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { sweaterFromEffective, effectiveTemp, rayCount } from "@/lib/sweater";

describe("sweater logic", () => {
  it("maps effective temp to 0-5 score bands", () => {
    expect(sweaterFromEffective(34).score).toBe(5);
    expect(sweaterFromEffective(35).score).toBe(4);
    expect(sweaterFromEffective(54).score).toBe(3);
    expect(sweaterFromEffective(64).score).toBe(2);
    expect(sweaterFromEffective(74).score).toBe(1);
    expect(sweaterFromEffective(75).score).toBe(0);
  });
  it("blends high and current 50/50", () => {
    expect(effectiveTemp(70, 50)).toBe(60);
  });
  it("rayCount = round(score/20) capped at 5", () => {
    expect(rayCount(96.3)).toBe(5);
    expect(rayCount(59.6)).toBe(3);
    expect(rayCount(0)).toBe(0);
  });
});
```

- [ ] **Step 1b: Run it** — `npm test -- sweater` → FAIL.

- [ ] **Step 2: Create `src/lib/sweater.ts`**

```ts
export interface SweaterVerdict { score: number; verdict: string; layers: string; }

export function effectiveTemp(high: number, current: number): number {
  return high * 0.5 + current * 0.5;
}

export function sweaterFromEffective(effective: number): SweaterVerdict {
  if (effective < 35) return { score: 5, verdict: "That's not sweater weather, that's SWEATER EMERGENCY.", layers: "3+ (sweater, fleece, AND a coat)" };
  if (effective < 45) return { score: 4, verdict: "Classic sweater weather. This is what we're here for.", layers: "2 (solid sweater + optional layer)" };
  if (effective < 55) return { score: 3, verdict: "Still sweater territory. Don't let anyone tell you otherwise.", layers: "1-2 (light to medium sweater)" };
  if (effective < 65) return { score: 2, verdict: "You could go either way. Bring it and decide later.", layers: "0-1 (light layer, keep one in the car)" };
  if (effective < 75) return { score: 1, verdict: "No sweater needed unless you're in aggressive AC.", layers: "0 (the sweater rests today)" };
  return { score: 0, verdict: "Wearing a sweater would be a cry for help.", layers: "0 (this is shorts weather, Dave)" };
}

export function rayCount(score: number): number {
  return score ? Math.min(5, Math.round(score / 20)) : 0;
}
```

- [ ] **Step 3: Run tests** — `npm test -- sweater` → PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): port sweater verdict logic with tests"
```

---

## Task 6: Layout — header, footer, update bar, metadata, GA

**Files:**
- Create: `src/components/SiteHeader.tsx`, `src/components/SiteFooter.tsx`, `src/components/UpdateBar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/SiteHeader.tsx`** (client; teal bar, orange bottom border, active link = orange)

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Weather" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/videos", label: "Videos" },
  { href: "/blog", label: "Blog" },
  { href: "/shop", label: "Swag Shop" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 flex min-h-[5.5rem] flex-wrap items-center gap-4 border-b-4 border-orange bg-teal px-6 py-2">
      <Link href="/" className="flex shrink-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.svg" alt="Dave's Sweater" className="h-12 w-auto" />
      </Link>
      <span className="hidden whitespace-nowrap text-[0.95rem] italic text-white/75 md:inline">
        Boone&apos;s most mostly reliable weather tracker and resource
      </span>
      <nav className="ml-auto flex flex-wrap justify-end gap-1">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
                active ? "bg-orange text-white" : "text-white/75 hover:bg-white/15 hover:text-white"
              )}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Create `src/components/UpdateBar.tsx`** (server; build-time Eastern timestamp — mirrors `now_eastern()`)

```tsx
export default function UpdateBar() {
  const updated = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date());
  return <div className="bg-card px-6 py-1.5 text-center text-xs text-muted">Updated: {updated}</div>;
}
```

- [ ] **Step 3: Create `src/components/SiteFooter.tsx`**

```tsx
export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border px-6 py-8 text-center text-sm text-muted">
      <p>
        <a href="https://davessweater.com" className="hover:text-orange">DavesSweater.com</a>
        {" · "}Est. 2026
      </p>
      <p className="mt-2 text-xs">Not affiliated with Ray&apos;s Weather. Ray&apos;s great. Use his site for actual weather.</p>
    </footer>
  );
}
```

- [ ] **Step 4: Replace `src/app/layout.tsx`** (Inter font, full metadata incl. BOTH GSC tags via `other`, GA via `next/script`)

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import UpdateBar from "@/components/UpdateBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://davessweater.com"),
  title: {
    default: "Dave's Sweater — Boone's most mostly reliable weather tracker and resource",
    template: "%s — Dave's Sweater",
  },
  description: "Is it sweater weather in Boone, NC? Did Ray get yesterday right? Find out.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  other: {
    "google-site-verification": [
      "WvhDdIhrlNBhsVYElbFc39q-Ib8J2UZZJKoy8pzn-KQ",
      "Pxd8jrNaWOdwazTvIA9xHgCib5f8yC3n6IfAZQ1s8M0",
    ],
  },
  openGraph: {
    title: "Dave's Sweater",
    description: "Boone's most mostly reliable weather tracker and resource.",
    url: "https://davessweater.com", type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("antialiased", inter.variable)}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <UpdateBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        <SiteFooter />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-7XL0TZ4GSS" strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-7XL0TZ4GSS');
        `}</Script>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify** — `npm run build && npm run lint` → build succeeds; header/footer render; lint clean.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): site shell — header, footer, update bar, metadata, GA"
```

---

## Task 7: Home `/` — Weather (sweater + forecast + live island)

**Files:**
- Create: `src/components/SweaterCard.tsx`, `src/components/LiveConditions.tsx`, `src/components/ForecastCard.tsx`
- Replace: `src/app/page.tsx`

Parity source: `build_sweater_section`, `build_phone_forecast`, and the inline live-temp JS.

- [ ] **Step 1: Create `src/components/LiveConditions.tsx`** (client island)

```tsx
"use client";
import { useEffect, useState } from "react";
import { sweaterFromEffective, effectiveTemp } from "@/lib/sweater";

function icons(score: number) {
  return Array.from({ length: 5 }, (_, i) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={i} src="/assets/sweateremoji.webp" alt="sweater"
      className={i < score ? "inline h-9 w-9" : "inline h-9 w-9 opacity-25 grayscale"} />
  ));
}

export default function LiveConditions({
  initialScore, initialVerdict, initialLayers, initialTemp,
}: { initialScore: number; initialVerdict: string; initialLayers: string; initialTemp: string; }) {
  const [s, setS] = useState({ score: initialScore, verdict: initialVerdict, layers: initialLayers, temp: initialTemp, high: "" });

  useEffect(() => {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=36.2168&longitude=-81.6746"
      + "&current=temperature_2m,wind_speed_10m,relative_humidity_2m,apparent_temperature"
      + "&daily=temperature_2m_max&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York";
    fetch(url).then((r) => r.json()).then((d) => {
      const cur = d?.current?.temperature_2m;
      if (cur == null) return;
      const high = d?.daily?.temperature_2m_max?.[0] ?? cur;
      const v = sweaterFromEffective(effectiveTemp(high, cur));
      setS({ score: v.score, verdict: v.verdict, layers: v.layers,
        temp: `${Math.round(cur * 10) / 10}°F`, high: `High of ${Math.round(high)}°F today` });
    }).catch(() => {});
  }, []);

  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center gap-1">{icons(s.score)}</div>
      <div className="text-4xl font-extrabold">{s.temp}{s.high ? <span className="ml-2 align-middle text-sm text-muted">now</span> : null}</div>
      {s.high ? <div className="text-sm text-muted">{s.high}</div> : null}
      <p className="mt-3 text-lg font-semibold">{s.verdict}</p>
      {s.layers ? <p className="mt-1 text-sm text-muted"><strong>Recommended layers:</strong> {s.layers}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/SweaterCard.tsx`** (server wrapper; comparison-derived fallback)

```tsx
import type { Comparison } from "@/lib/types";
import LiveConditions from "@/components/LiveConditions";

export default function SweaterCard({ comp }: { comp: Comparison | null }) {
  const sw = comp?.sweater_weather ?? {};
  const temp = comp?.actuals?.high_f != null ? `${comp.actuals.high_f}°F` : "—";
  return (
    <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-center text-2xl font-bold">Sweater weather in Boone?</h2>
      <LiveConditions
        initialScore={sw.sweater_count ?? 0}
        initialVerdict={sw.detail ?? sw.answer ?? ""}
        initialLayers={sw.layers ?? ""}
        initialTemp={temp}
      />
    </section>
  );
}
```

- [ ] **Step 3: Create `src/components/ForecastCard.tsx`** (iPhone screenshot; prebuild copied it to `/screenshots/`)

```tsx
export default function ForecastCard() {
  return (
    <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-1 text-2xl font-bold">Forecast</h2>
      <p className="mb-4 text-sm text-muted">Our meteorological experts predict the following forecast</p>
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/screenshots/iphone_screenshot.png" alt="Apple Weather forecast for Boone, NC"
          loading="lazy" className="max-w-xs rounded-xl" />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`**

```tsx
import { getLatestComparison } from "@/lib/data";
import SweaterCard from "@/components/SweaterCard";
import ForecastCard from "@/components/ForecastCard";

export default async function HomePage() {
  const comp = await getLatestComparison();
  return (
    <>
      <SweaterCard comp={comp} />
      <ForecastCard />
    </>
  );
}
```

- [ ] **Step 5: Build + manual check** — `npm run build && npm run dev`; open `http://localhost:3000`. Expected: sweater card with verdict + icons; after ~1s live Open-Meteo values update temp/verdict; forecast screenshot renders if present.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): home Weather page with live conditions island"
```

---

## Task 8: `/right-wrong-ray` — comparison + scoreboard

**Files:**
- Create: `src/lib/scoreboard.ts`, `src/lib/__tests__/scoreboard.test.ts`, `src/components/RayFaces.tsx`, `src/app/right-wrong-ray/page.tsx`

Parity source: `build_rightwrong_section`, `build_scoreboard_section`.

- [ ] **Step 1: Write failing test** `src/lib/__tests__/scoreboard.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { scoreboardRows } from "@/lib/scoreboard";

describe("scoreboardRows", () => {
  it("maps totals to labeled rows with avg = total_score/days", () => {
    const rows = scoreboardRows({ entries: [], totals: {
      openmeteo: { right: 104, wrong: 0, meh: 2, total_score: 9700.8, days: 106 },
    }});
    expect(rows[0]).toMatchObject({ label: "Open-Meteo", record: "104W - 0L - 2M", days: 106 });
    expect(rows[0].avg).toBeCloseTo(91.5, 1);
  });
});
```

- [ ] **Step 1b: Run it** — `npm test -- scoreboard` → FAIL.

- [ ] **Step 2: Create `src/lib/scoreboard.ts`**

```ts
import type { Scores } from "@/lib/types";

const LABELS: Record<string, string> = {
  raysweather: "Ray's Weather", openmeteo: "Open-Meteo", apple_weather: "Apple Weather",
};

export interface ScoreboardRow { label: string; record: string; avg: number; days: number; }

export function scoreboardRows(scores: Scores | null): ScoreboardRow[] {
  if (!scores?.totals) return [];
  return Object.entries(scores.totals).map(([src, t]) => ({
    label: LABELS[src] ?? src,
    record: `${t!.right}W - ${t!.wrong}L - ${t!.meh}M`,
    avg: t!.days > 0 ? Math.round((t!.total_score / t!.days) * 10) / 10 : 0,
    days: t!.days,
  }));
}
```

- [ ] **Step 3: Run test** — `npm test -- scoreboard` → PASS.

- [ ] **Step 4: Create `src/components/RayFaces.tsx`**

```tsx
import { rayCount } from "@/lib/sweater";
export default function RayFaces({ score }: { score: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: rayCount(score) }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src="/assets/ray_face.svg" alt="Ray" className="inline h-6 w-6 align-middle" />
      ))}
    </span>
  );
}
```

- [ ] **Step 5: Create `src/app/right-wrong-ray/page.tsx`** (Actual row + per-source rows; then scoreboard — match copy from the two builder functions)

```tsx
import { getLatestComparison, getScores } from "@/lib/data";
import { scoreboardRows } from "@/lib/scoreboard";
import RayFaces from "@/components/RayFaces";
import type { SourceEntry } from "@/lib/types";

export const metadata = { title: "Right Ray / Wrong Ray" };

const SOURCES: Array<{ key: "raysweather" | "openmeteo" | "apple_weather"; label: string; icon: string }> = [
  { key: "raysweather", label: "Ray's Weather", icon: "🟠" },
  { key: "openmeteo", label: "Open-Meteo", icon: "🌐" },
  { key: "apple_weather", label: "Apple Weather", icon: "📱" },
];

function predLines(e: SourceEntry): string[] {
  const p = e.prediction;
  const hi = p.today_high_f ?? p.high_f, lo = p.tonight_low_f ?? p.low_f;
  const wind = p.wind_mph, rain = p.precip_in ?? p.rainfall_in;
  return [
    `Hi: ${hi ?? "N/A"}° / Lo: ${lo ?? "N/A"}°`,
    wind != null ? `Wind: ${Math.round(wind * 10) / 10} mph` : "Wind: —",
    rain != null ? `Rain: ${rain}"` : "Rain: —",
  ];
}

export default async function Page() {
  const [comp, scores] = await Promise.all([getLatestComparison(), getScores()]);
  const rows = scoreboardRows(scores);
  const a = comp?.actuals;
  return (
    <>
      <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
        <h2 className="text-2xl font-bold">Right Ray / Wrong Ray</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          When you trust us to tell you how many rays of sunshine, golfballs, or snowmen you can expect,
          we need to be held to account. Here&apos;s the scoreboard comparing each forecast to the actual weather.
        </p>
        {comp ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted">
                <th className="py-2">Source</th><th>Predicted</th><th>Score</th><th>Verdict</th>
              </tr></thead>
              <tbody>
                <tr className="border-t border-border font-semibold">
                  <td className="py-2">Actual{comp.date ? ` (${comp.date})` : ""}</td>
                  <td>Hi: {a?.high_f}° / Lo: {a?.low_f}°{a?.conditions ? <><br />{a.conditions}</> : null}</td>
                  <td colSpan={2}>—</td>
                </tr>
                {SOURCES.map(({ key, label, icon }) => {
                  const e = comp.sources?.[key];
                  if (!e || !e.score) return null;
                  return (
                    <tr key={key} className="border-t border-border">
                      <td className="py-2">{icon} {label}</td>
                      <td>{predLines(e).map((l, i) => <div key={i}>{l}</div>)}</td>
                      <td><strong>{e.score.score.toFixed(1)}/100</strong></td>
                      <td><RayFaces score={e.score.score} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted">No comparison yet.</p>}
        <p className="mt-4 text-xs italic text-muted">
          Each source is scored out of 100 across four fields: high temp (30), low temp (30), wind (20),
          precipitation (20), based on closeness to actual recorded conditions.
        </p>
      </section>

      {rows.length > 0 && (
        <section className="mb-6 rounded-[var(--radius)] bg-card p-6">
          <h2 className="mb-4 text-2xl font-bold">Season Scoreboard</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted">
                <th className="py-2">Source</th><th>Record</th><th>Avg Score</th><th>Days</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-border">
                    <td className="py-2 font-semibold">{r.label}</td>
                    <td>{r.record}</td><td>{r.avg.toFixed(1)}/100</td><td>{r.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">W = best forecast that day · L = worst · M = somewhere in the middle</p>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 6: Build + check** — `npm run build`; open `/right-wrong-ray`. Expected: actual row + source rows with scores/ray faces; season scoreboard with three sources.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): right-wrong-ray page (comparison + scoreboard)"
```

---

## Task 9: `/videos`

**Files:**
- Create: `src/app/videos/page.tsx`

Parity source: `build_videos_section`. Build-time fetch via `getVideos()`.

- [ ] **Step 1: Create `src/app/videos/page.tsx`**

```tsx
import { getVideos } from "@/lib/feeds";

export const metadata = { title: "Videos" };

export default async function Page() {
  const videos = await getVideos();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-2xl font-bold">Videos</h2>
      {videos.length === 0 ? (
        <p className="text-muted">No videos yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {videos.map((v) => (
            <a key={v.link} href={v.link} target="_blank" rel="noopener"
              className="overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md">
              {v.thumb && /* eslint-disable-next-line @next/next/no-img-element */ (
                <img src={v.thumb} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="p-3">
                <p className="font-semibold">{v.title}</p>
                <p className="text-xs text-muted">{v.date}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Build + check** — `npm run build`; open `/videos`. Expected: grid of videos (or empty state if feed unreachable at build).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): videos page"
```

---

## Task 10: `/blog` + `/blog/[slug]` — native blog (sanitized HTML)

**Files:**
- Create: `src/lib/html.ts`, `src/lib/__tests__/html.test.ts`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`

Parity source: `build_blog_section` — but fully native: NO "Substack" heading, NO "Read on Substack" link, NO subscribe CTA. Post body is **sanitized** then parsed to React elements (no `dangerouslySetInnerHTML`).

- [ ] **Step 1: Write failing test** `src/lib/__tests__/html.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { sanitizePostHtml } from "@/lib/html";

describe("sanitizePostHtml", () => {
  it("keeps content tags but strips scripts", () => {
    const out = sanitizePostHtml('<p>hi</p><h4>head</h4><script>alert(1)</script><a href="x">l</a>');
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("<h4>head</h4>");
    expect(out.toLowerCase()).not.toContain("<script");
  });
});
```

- [ ] **Step 1b: Run it** — `npm test -- html` → FAIL.

- [ ] **Step 2: Create `src/lib/html.ts`**

```ts
import sanitizeHtml from "sanitize-html";

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "title", "width", "height", "loading"],
      a: ["href", "name", "target", "rel"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
```

- [ ] **Step 3: Run test** — `npm test -- html` → PASS.

- [ ] **Step 4: Create `src/app/blog/page.tsx`** (index of post cards)

```tsx
import Link from "next/link";
import { getBlogPosts, slugFromLink } from "@/lib/data";

export const metadata = { title: "Blog" };

export default async function Page() {
  const posts = await getBlogPosts();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-4 text-2xl font-bold">Blog</h2>
      {posts.length === 0 ? (
        <p className="text-muted">No posts yet — check back soon.</p>
      ) : (
        <ul className="space-y-5">
          {posts.map((p) => {
            const slug = slugFromLink(p.link, p.title);
            return (
              <li key={slug} className="border-b border-border pb-5 last:border-0">
                <Link href={`/blog/${slug}`} className="text-xl font-semibold hover:text-orange">{p.title}</Link>
                {p.date && <p className="text-xs text-muted">{p.date}</p>}
                {p.summary && <p className="mt-1 text-sm text-muted">{p.summary}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Create `src/app/blog/[slug]/page.tsx`** (full post; static params). Note: `params` is async in Next 16 — confirm against `node_modules/next/dist/docs/`.

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import parse from "html-react-parser";
import { getBlogPosts, getBlogPost, slugFromLink } from "@/lib/data";
import { sanitizePostHtml } from "@/lib/html";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: slugFromLink(p.link, p.title) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  return { title: post?.title ?? "Post" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const html = sanitizePostHtml(post.content ?? post.summary ?? "");
  return (
    <article className="rounded-[var(--radius)] bg-card p-6">
      <Link href="/blog" className="text-sm text-muted hover:text-orange">← All posts</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{post.title}</h1>
      {post.date && <p className="mt-1 text-sm text-muted">{post.date}</p>}
      <div className="mt-4 max-w-none [&_a]:text-orange [&_h4]:mt-4 [&_h4]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
        {parse(html)}
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Build + check** — `npm run build`; open `/blog` then the post. Expected: index lists post(s); `/blog/welcome-to-daves-sweater` renders full content natively; no Substack mentions; no `<script>` survives.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): native blog index + sanitized post pages"
```

---

## Task 11: `/shop` — grid + embedded product modal

**Files:**
- Create: `src/components/ui/dialog.tsx` (shadcn), `src/components/ShopGrid.tsx`, `src/app/shop/page.tsx`

Parity source: `build_shop_section`. Grid from `getProducts()`; clicking a product opens its Fourthwall page in an on-site modal iframe. Checkout still redirects to Fourthwall.

- [ ] **Step 1: Add the shadcn Dialog component**

Run: `npx shadcn@latest add dialog`
Expected: creates `src/components/ui/dialog.tsx`. (If prompted, accept defaults from `components.json`.)

- [ ] **Step 2: Create `src/components/ShopGrid.tsx`** (client; modal iframe)

```tsx
"use client";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Product } from "@/lib/types";

export default function ShopGrid({ products }: { products: Product[] }) {
  const [active, setActive] = useState<Product | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {products.map((p) => (
          <button key={p.id ?? p.link} onClick={() => setActive(p)}
            className="overflow-hidden rounded-lg border border-border text-left transition-shadow hover:shadow-md">
            {p.image && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={p.image} alt={p.name} loading="lazy" className="aspect-square w-full object-cover" />
            )}
            <div className="p-2">
              <div className="text-sm font-semibold">{p.name}</div>
              {p.price && <div className="text-sm font-bold text-orange">{p.price}</div>}
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="h-[85vh] max-w-3xl p-0">
          {active && (
            <iframe src={active.link} title={active.name} className="h-full w-full rounded-md border-0" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Create `src/app/shop/page.tsx`**

```tsx
import { getProducts } from "@/lib/feeds";
import ShopGrid from "@/components/ShopGrid";

export const metadata = { title: "Swag Shop" };

export default async function Page() {
  const products = await getProducts();
  return (
    <section className="rounded-[var(--radius)] bg-card p-6">
      <h2 className="mb-2 text-2xl font-bold">Swag Shop</h2>
      <p className="mb-4 text-sm text-muted">
        The official Dave&apos;s Sweater merch, dropshipped so we don&apos;t keep boxes of stuff at our
        meteorological megaplex. Everything is set to the minimum price with a mandatory $3 &ldquo;profit&rdquo;
        baked in, which we donate to charity each month.
      </p>
      {products.length === 0 ? (
        <p className="text-muted">Shop is loading elsewhere — <a className="text-orange" href="https://daves-sweater-shop.fourthwall.com/" target="_blank" rel="noopener">visit the full shop ↗</a>.</p>
      ) : <ShopGrid products={products} />}
    </section>
  );
}
```

- [ ] **Step 4: Build + check** — `npm run build && npm run dev`; open `/shop`. Expected: product grid; clicking opens a modal with the Fourthwall product page iframed; closing returns to grid. If Fourthwall refuses framing on a product page, note it; the page still degrades to the fallback link.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): swag shop with embedded product modal"
```

---

## Task 12: SEO — sitemap, robots

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`

- [ ] **Step 1: Create `src/app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { getBlogPosts, slugFromLink } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://davessweater.com";
  const posts = await getBlogPosts();
  const routes = ["", "/right-wrong-ray", "/videos", "/blog", "/shop"].map((r) => ({
    url: `${base}${r}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: r === "" ? 1 : 0.7,
  }));
  const postRoutes = posts.map((p) => ({
    url: `${base}/blog/${slugFromLink(p.link, p.title)}`, lastModified: new Date(),
    changeFrequency: "monthly" as const, priority: 0.6,
  }));
  return [...routes, ...postRoutes];
}
```

- [ ] **Step 2: Create `src/app/robots.ts`**

```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://davessweater.com/sitemap.xml" };
}
```

- [ ] **Step 3: Build + check** — `npm run build`; open `/sitemap.xml` and `/robots.txt`. Expected: five routes + blog post(s) in sitemap; robots references sitemap.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): sitemap + robots"
```

---

## Task 13: Full build + Vercel preview verification (no cutover yet)

**Files:** none (verification only).

- [ ] **Step 1: Clean build + lint + tests**

Run: `npm test && npm run lint && rm -rf .next && npm run build`
Expected: tests pass, lint clean, build succeeds; build log shows static generation of `/`, `/right-wrong-ray`, `/videos`, `/blog`, `/blog/[slug]`, `/shop`, `/sitemap.xml`, `/robots.txt`.

- [ ] **Step 2: Push branch + preview deploy**

```bash
git push -u origin m1-nextjs-migration
```
Then build a **preview** of the Next app without touching production: `vercel build && vercel deploy --prebuilt` (or set the branch's Framework to Next.js in Vercel for a branch preview). Production `vercel.json` still points at `build_site.py` — do NOT change production settings here.

- [ ] **Step 3: Visual parity pass** against the live site on the preview URL: header/nav/active states, Weather (live update), Right/Wrong Ray tables, Videos, Blog (native, no Substack framing), Shop (modal). Note gaps.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(web): preview parity adjustments"
```

---

## Task 14: Cutover — flip Vercel to Next, trim the daily workflow

**Do this only after Task 13's preview is verified.** This is the production change.

**Files:**
- Modify: `vercel.json`, `.github/workflows/daily_compare.yml`
- Remove: `scripts/build_site.py`, `docs/` (generated output)

- [ ] **Step 1: Replace `vercel.json`** with Next defaults

```json
{
  "framework": "nextjs"
}
```

- [ ] **Step 2: Verify Vercel project dashboard** — Build & Output settings: Framework = Next.js; Build Command + Output Directory = default (not pinned to `docs`). Fix in the dashboard if pinned. Domain davessweater.com stays as configured.

- [ ] **Step 3: Edit `.github/workflows/daily_compare.yml`** — remove the "Build site" step (`python scripts/build_site.py` + its `FOURTHWALL_TOKEN` env) and the "Copy screenshots to docs directory" step. Change the commit staging from `git add data/ docs/` to:
```yaml
          git add data/
```
Leave the Substack/actuals/compare/export-CSV steps and push logic unchanged. (The bot now commits only data; Vercel rebuilds via `next build`, and `prepare_public.mjs` copies the latest screenshots from `data/` into `public/screenshots/` at build.)

- [ ] **Step 4: Remove the retired generator + stale output**

```bash
git rm scripts/build_site.py
git rm -r docs/
```
(`build_site.py` stays in git history. The `FOURTHWALL_TOKEN` CI secret is now unused but harmless.)

- [ ] **Step 5: Update `CHECKLIST.md`** — check off "M1 — Next.js port" and note the cutover is done.

- [ ] **Step 6: Open the PR**

```bash
git add -A
git commit -m "feat(web): cut deployment over to Next.js (next build); trim daily workflow to data-only"
git push
gh pr create --title "M1: migrate Dave's Sweater to Next.js" --body "Parity port + real pages, native blog, embedded shop. Vercel now builds with next build; the daily Action commits only data/. See planning/specs + planning/plans. Verified on preview."
```

- [ ] **Step 7: Verify production after merge** — merge triggers a production `next build` on Vercel. Confirm davessweater.com serves the new site, all routes work, GA + both GSC tags present (view source), and the next daily bot run commits only `data/` and triggers a clean rebuild. **Rollback if broken:** revert the cutover commit (restores `build_site.py` + `vercel.json`) and redeploy.

---

## Self-review notes (author)

- **Spec coverage:** stack/scaffold (T1–T2), data layer (T3–T4), routes/nav (T6–T11), blog native no-Substack + sanitized (T10), shop embed + 403-aware fallback (T11), SEO/analytics carryover (T6, T12), static generation (all page tasks), CI/Vercel cutover + rollback (T13–T14), Python pipeline untouched (standing rule #3). All spec acceptance criteria map to tasks.
- **Live-conditions island** (in the current site's JS, not the prose spec) is preserved in T7 — required for true parity.
- **Security:** blog HTML is sanitized at build (`sanitize-html`) and rendered via `html-react-parser` — no `dangerouslySetInnerHTML` anywhere (standing rule #7).
- **Type consistency:** `getLatestComparison/getScores/getBlogPosts/getBlogPost/slugFromLink` (T3), `getVideos/getProducts/parseYouTubeAtom/parseMerchantRss` (T4), `sweaterFromEffective/effectiveTemp/rayCount` (T5), `scoreboardRows` (T8), `sanitizePostHtml` (T10) are defined before use with matching signatures.
- **Open verification at execution:** Next 16 async `params` / `generateStaticParams` / metadata `other`-array rendering / shadcn `base-nova` dialog install — confirm against `node_modules/next/dist/docs/` and the `vercel-plugin:nextjs` skill (standing rule #2).
