# M2 — Modern Redesign + Accuracy Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Dave's Sweater with an original dark-teal/orange data-journalism identity and a mobile-first, conversion-focused homepage that leads with the accuracy data (free Open-Meteo/Apple beat paid Ray's) and co-anchors the daily iPhone screenshot — applying the design system across every page. Presentation only; no pipeline/scoring changes.

**Architecture:** Next.js 16 App Router, statically generated from committed `data/*.json` at build time. New pure functions in `src/lib` derive every homepage stat (TDD'd with vitest, matching the repo's lib-only test pattern). New/restyled server + client components render the dark hero, scoreboard, screenshot feature, an inline-SVG trend chart, and the head-to-head; the existing `LiveConditions` client island gains a 5-day outlook. Components are verified via `next build` + lint + visual check (no component-test framework is installed — keep it that way).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4 (`@theme inline` tokens in `globals.css`), `next/font/google` (Space Grotesk + Inter), vitest. No new runtime dependencies.

**Reference spec:** `planning/specs/2026-06-21-m2-redesign-accuracy-homepage-design.md`

**Standing rule:** Per `AGENTS.md`/CLAUDE.md, read `node_modules/next/dist/...` docs before using any Next 16 API you're unsure of — do not rely on memorized APIs. Keep the dry/sharp brand voice (don't soften copy).

---

## File structure

**Create:**
- `src/lib/homeStats.ts` — pure derivation: `heroStats`, `trendSeries`, `trendChartGeometry`, `headToHead`.
- `src/lib/screenshot.ts` — `classifyScreenshotSource` (pure) + `latestScreenshotInfo` (build-time fs).
- `src/lib/__tests__/homeStats.test.ts`, `src/lib/__tests__/screenshot.test.ts`.
- `src/components/SectionBand.tsx` — light/dark full-bleed section wrapper.
- `src/components/BrandMark.tsx` — "Boone's #1 weather ~~service~~ tracker" with accessible strikethrough.
- `src/components/Scoreboard.tsx` — 3-up stat band.
- `src/components/IphoneShot.tsx` — screenshot + source label + date.
- `src/components/Hero.tsx` — assembles the dark hero (eyebrow + headline + scoreboard + screenshot + CTA).
- `src/components/TrendChart.tsx` — inline-SVG free-vs-Ray's trend.
- `src/components/HeadToHeadCard.tsx` — yesterday's matchup.
- `src/components/Outlook.tsx` — 5-day mini-outlook (client; rendered inside `LiveConditions`).

**Modify:**
- `src/app/globals.css` — extend tokens (teal scale, neutrals, semantic, display font var).
- `src/app/layout.tsx` — add Space Grotesk via `next/font`; refresh OG copy.
- `src/components/SiteHeader.tsx` — restyle + mobile menu + tagline + brand mark.
- `src/components/SiteFooter.tsx` — restyle + methodology link + disclaimer + tagline.
- `src/components/LiveConditions.tsx` — add the 5-day outlook fetch + render `Outlook`.
- `src/app/page.tsx` — compose the new homepage sections.
- `src/app/right-wrong-ray/page.tsx` — restyle + responsive table→cards.
- `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/videos/page.tsx`, `src/app/shop/page.tsx` — apply tokens/components.

**Supersede (delete after homepage assembled):** `src/components/SweaterCard.tsx`, `src/components/ForecastCard.tsx` (their roles move into `Hero` + the live/outlook section).

---

## Phase 0 — Design tokens + display font

### Task 1: Extend design tokens and load Space Grotesk

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add tokens to `globals.css`**

Replace the `:root` and `@theme inline` blocks with the extended set (keeps existing names, adds the scale):

```css
:root {
  --teal-900: #26323d;
  --teal-800: #2e4150;
  --teal-700: #33485a;
  --teal: #3c5468;
  --teal-50: #eef3f6;
  --orange: #f97316;
  --orange-600: #c2410c;
  --green: #1d9e75;

  --bg: #ffffff;
  --surface: #f5f7f9;
  --card: #f8f9fc;
  --text: #26323d;
  --muted: #5f6b75;
  --border: #e3e8ec;
  --radius: 0.75rem;

  --background: var(--bg);
  --foreground: var(--text);
  --ring: var(--orange);
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--text);
  --color-teal: var(--teal);
  --color-teal-700: var(--teal-700);
  --color-teal-800: var(--teal-800);
  --color-teal-900: var(--teal-900);
  --color-teal-50: var(--teal-50);
  --color-orange: var(--orange);
  --color-orange-600: var(--orange-600);
  --color-green: var(--green);
  --color-card: var(--card);
  --color-surface: var(--surface);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --font-sans: var(--font-inter);
  --font-display: var(--font-space-grotesk);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-sm: calc(var(--radius) * 0.6);
}
```

- [ ] **Step 2: Load Space Grotesk in `layout.tsx`**

Add alongside the existing Inter import:

```tsx
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk" });
```

Update the `<html>` className to include both variables:

```tsx
<html lang="en" className={cn("antialiased", inter.variable, spaceGrotesk.variable)}>
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: build succeeds (tokens + font wired; no usage yet).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(m2): add dark-teal token scale + Space Grotesk display font"
```

---

## Phase 1 — Stat derivation library (TDD)

### Task 2: `heroStats` — derive the scoreboard from `scores.json`

**Files:**
- Create: `src/lib/homeStats.ts`
- Test: `src/lib/__tests__/homeStats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { heroStats } from "@/lib/homeStats";

const scores = {
  entries: [],
  totals: {
    openmeteo: { right: 105, wrong: 0, meh: 2, total_score: 9800.8, days: 107 },
    apple_weather: { right: 102, wrong: 0, meh: 2, total_score: 9545.7, days: 104 },
    raysweather: { right: 46, wrong: 29, meh: 32, total_score: 7556.6, days: 107 },
  },
};

describe("heroStats", () => {
  it("returns labeled per-source stats ordered free-first, then Ray's", () => {
    const h = heroStats(scores);
    expect(h.sources.map((s) => s.key)).toEqual(["openmeteo", "apple_weather", "raysweather"]);
    expect(h.sources[0]).toMatchObject({ label: "Open-Meteo", isFree: true, record: "105–0–2" });
    expect(h.sources[0].avg).toBeCloseTo(91.6, 1);
  });
  it("derives tracked days, dead-last count, and the free-vs-Ray's point gap", () => {
    const h = heroStats(scores);
    expect(h.trackedDays).toBe(107);
    expect(h.deadLastDays).toBe(29);
    expect(h.bestFree?.key).toBe("apple_weather"); // 91.8 > 91.6
    expect(h.pointGap).toBeCloseTo(21.2, 1);       // 91.78 - 70.62
  });
  it("handles null/empty scores without throwing", () => {
    expect(heroStats(null).sources).toEqual([]);
    expect(heroStats(null).pointGap).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: FAIL — `heroStats` not exported / module missing.

- [ ] **Step 3: Implement `heroStats`**

```ts
import type { Scores, SourceTotals, Comparison } from "@/lib/types";

type SrcKey = "openmeteo" | "apple_weather" | "raysweather";
const ORDER: SrcKey[] = ["openmeteo", "apple_weather", "raysweather"];
const LABELS: Record<SrcKey, string> = {
  openmeteo: "Open-Meteo", apple_weather: "Apple Weather", raysweather: "Ray's Weather",
};
const IS_FREE: Record<SrcKey, boolean> = { openmeteo: true, apple_weather: true, raysweather: false };

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface SourceStat {
  key: SrcKey; label: string; isFree: boolean;
  avg: number; right: number; wrong: number; meh: number; days: number; record: string;
}
export interface HeroStats {
  trackedDays: number; sources: SourceStat[];
  rays: SourceStat | null; bestFree: SourceStat | null;
  pointGap: number; deadLastDays: number;
}

function toStat(key: SrcKey, t: SourceTotals): SourceStat {
  return {
    key, label: LABELS[key], isFree: IS_FREE[key],
    avg: t.days > 0 ? round1(t.total_score / t.days) : 0,
    right: t.right, wrong: t.wrong, meh: t.meh, days: t.days,
    record: `${t.right}–${t.wrong}–${t.meh}`,
  };
}

export function heroStats(scores: Scores | null): HeroStats {
  const totals = scores?.totals ?? {};
  const sources = ORDER.filter((k) => totals[k]).map((k) => toStat(k, totals[k] as SourceTotals));
  const rays = sources.find((s) => !s.isFree) ?? null;
  const frees = sources.filter((s) => s.isFree);
  const bestFree = frees.length ? frees.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const trackedDays = Math.max(0, ...sources.map((s) => s.days));
  const pointGap = bestFree && rays ? round1(bestFree.avg - rays.avg) : 0;
  return { trackedDays, sources, rays, bestFree, pointGap, deadLastDays: rays?.wrong ?? 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/homeStats.ts src/lib/__tests__/homeStats.test.ts
git commit -m "feat(m2): heroStats derives scoreboard, gap, dead-last from scores.json"
```

### Task 3: `trendSeries` + `trendChartGeometry`

**Files:**
- Modify: `src/lib/homeStats.ts`
- Modify: `src/lib/__tests__/homeStats.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { trendSeries, trendChartGeometry } from "@/lib/homeStats";

describe("trendSeries", () => {
  it("maps entries to free(openmeteo) vs rays, null for missing", () => {
    const s = { entries: [
      { date: "2026-06-19", openmeteo: 96.3, raysweather: 63.2 },
      { date: "2026-06-18", raysweather: 50 },        // free missing
      { date: "2026-06-17", openmeteo: 83.7 },        // rays missing
    ], totals: {} };
    expect(trendSeries(s)).toEqual([
      { date: "2026-06-17", free: 83.7, rays: null },  // sorted ascending by date
      { date: "2026-06-18", free: null, rays: 50 },
      { date: "2026-06-19", free: 96.3, rays: 63.2 },
    ]);
  });
});

describe("trendChartGeometry", () => {
  it("produces polyline point strings skipping nulls, scaled into the viewbox", () => {
    const g = trendChartGeometry(
      [{ date: "a", free: 100, rays: 40 }, { date: "b", free: 100, rays: 100 }],
      600, 120, 40, 100,
    );
    expect(g.width).toBe(600);
    expect(g.free).toBe("0,0 600,0");      // free=100 → top (y=0) both points
    expect(g.rays).toBe("0,120 600,0");    // rays 40→bottom(120), 100→top(0)
  });
  it("omits null points from a series", () => {
    const g = trendChartGeometry([{ date: "a", free: null, rays: 70 }, { date: "b", free: 70, rays: 70 }], 600, 120, 40, 100);
    expect(g.free).toBe("600,60");         // only the present free point
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement**

```ts
export interface TrendPoint { date: string; free: number | null; rays: number | null; }

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

export function trendSeries(scores: Scores | null): TrendPoint[] {
  const entries = scores?.entries ?? [];
  return entries
    .map((e) => ({ date: String(e.date ?? ""), free: num(e.openmeteo), rays: num(e.raysweather) }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrendGeometry { free: string; rays: string; width: number; height: number; }

export function trendChartGeometry(
  points: TrendPoint[], width = 600, height = 120, min = 40, max = 100,
): TrendGeometry {
  const span = Math.max(1, points.length - 1);
  const x = (i: number) => Math.round((i / span) * width);
  const y = (v: number) => Math.round((1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * height);
  const line = (sel: (p: TrendPoint) => number | null) =>
    points
      .map((p, i) => ({ i, v: sel(p) }))
      .filter((d) => d.v != null)
      .map((d) => `${x(d.i)},${y(d.v as number)}`)
      .join(" ");
  return { free: line((p) => p.free), rays: line((p) => p.rays), width, height };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/homeStats.ts src/lib/__tests__/homeStats.test.ts
git commit -m "feat(m2): trendSeries + trendChartGeometry with gap handling"
```

### Task 4: `headToHead` — yesterday's matchup from the latest comparison

**Files:**
- Modify: `src/lib/homeStats.ts`
- Modify: `src/lib/__tests__/homeStats.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { headToHead } from "@/lib/homeStats";

describe("headToHead", () => {
  it("pulls Dave's (openmeteo) vs Ray's scores and actual lines", () => {
    const comp = {
      date: "2026-06-20",
      actuals: { high_f: 84, low_f: 61, wind_mph: 6.2, precip_in: 0 },
      sweater_weather: {},
      sources: {
        openmeteo: { prediction: {}, score: { score: 100, grade: { verdict: "Right", ray_count: 5 }, breakdown: {} } },
        raysweather: { prediction: {}, score: { score: 51.6, grade: { verdict: "Wrong", ray_count: 2 }, breakdown: {} } },
      },
    };
    const h = headToHead(comp as never);
    expect(h).toMatchObject({ date: "2026-06-20", dave: 100, rays: 51.6 });
    expect(h?.actualLines[0]).toBe("Hi: 84° / Lo: 61°");
  });
  it("returns null for null comparison", () => {
    expect(headToHead(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (the `actualLines` logic mirrors `right-wrong-ray/page.tsx`)

```ts
import type { Actuals } from "@/lib/types";

export interface HeadToHead { date: string; dave: number | null; rays: number | null; actualLines: string[]; }

function actualLines(a: Actuals | undefined): string[] {
  if (!a) return [];
  const lines = [`Hi: ${a.high_f ?? "N/A"}° / Lo: ${a.low_f ?? "N/A"}°`];
  if (a.wind_mph != null) lines.push(`Wind: ${Math.round(a.wind_mph * 10) / 10} mph`);
  if (a.snow_in != null && a.snow_in > 0.01) {
    const rain = a.precip_in != null ? Math.round((a.precip_in - a.snow_in) * 100) / 100 : null;
    lines.push(rain != null ? `Snow: ${a.snow_in}" / Rain: ${rain}"` : `Snow: ${a.snow_in}"`);
  } else if (a.precip_in != null) {
    lines.push(`Rain: ${a.precip_in}"`);
  }
  if (a.conditions) lines.push(a.conditions);
  return lines;
}

export function headToHead(comp: Comparison | null): HeadToHead | null {
  if (!comp) return null;
  return {
    date: comp.date,
    dave: comp.sources?.openmeteo?.score?.score ?? null,
    rays: comp.sources?.raysweather?.score?.score ?? null,
    actualLines: actualLines(comp.actuals),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/homeStats.ts src/lib/__tests__/homeStats.test.ts
git commit -m "feat(m2): headToHead derives Dave's-vs-Ray's matchup from latest comparison"
```

### Task 5: `screenshot.ts` — provenance + date for the hero shot

**Files:**
- Create: `src/lib/screenshot.ts`
- Test: `src/lib/__tests__/screenshot.test.ts`

- [ ] **Step 1: Write the failing test (pure classifier)**

```ts
import { describe, it, expect } from "vitest";
import { classifyScreenshotSource, REAL_APPLE_MIN_BYTES } from "@/lib/screenshot";

describe("classifyScreenshotSource", () => {
  it("treats large files as the real Apple Weather screenshot", () => {
    expect(classifyScreenshotSource(2_500_000)).toBe("apple");
    expect(classifyScreenshotSource(REAL_APPLE_MIN_BYTES)).toBe("apple");
  });
  it("treats small files as the Open-Meteo-rendered fallback", () => {
    expect(classifyScreenshotSource(90_000)).toBe("openmeteo");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/__tests__/screenshot.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type ScreenshotSource = "apple" | "openmeteo";

// Heuristic: the manually-uploaded real Apple Weather screenshots are ~2MB+ photos;
// the auto Open-Meteo fallback renders ~90KB. A robust signal (a source sidecar marker)
// belongs to the separate Shortcut-automation task — until then, size is the distinguisher.
export const REAL_APPLE_MIN_BYTES = 500_000;

export function classifyScreenshotSource(bytes: number): ScreenshotSource {
  return bytes >= REAL_APPLE_MIN_BYTES ? "apple" : "openmeteo";
}

export interface ScreenshotInfo { available: boolean; date: string | null; source: ScreenshotSource; }

// Mirrors scripts/prepare_public.mjs: newest YYYY-MM-DD dir that has iphone_screenshot.png.
export function latestScreenshotInfo(): ScreenshotInfo {
  const pred = join(process.cwd(), "data", "predictions");
  const fallback: ScreenshotInfo = { available: false, date: null, source: "openmeteo" };
  if (!existsSync(pred)) return fallback;
  const dirs = readdirSync(pred)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && statSync(join(pred, d)).isDirectory())
    .sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const png = join(pred, dirs[i], "iphone_screenshot.png");
    if (existsSync(png)) {
      return { available: true, date: dirs[i], source: classifyScreenshotSource(statSync(png).size) };
    }
  }
  return fallback;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/screenshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + commit**

Run: `npm test`
Expected: all existing + new tests PASS.

```bash
git add src/lib/screenshot.ts src/lib/__tests__/screenshot.test.ts
git commit -m "feat(m2): screenshot provenance + date helper for the hero"
```

---

## Phase 2 — Shared shell (design system applied to chrome)

> Components below are verified by `npm run build` + `npm run lint` + a visual check at `npm run dev` (~375px and desktop). No component-test framework is installed; do not add one.

### Task 6: `SectionBand` + `BrandMark` primitives

**Files:**
- Create: `src/components/SectionBand.tsx`
- Create: `src/components/BrandMark.tsx`

- [ ] **Step 1: Implement `SectionBand`**

```tsx
import { cn } from "@/lib/utils";

export default function SectionBand({
  tone = "light", className, children,
}: { tone?: "light" | "dark" | "surface"; className?: string; children: React.ReactNode }) {
  const bg = tone === "dark" ? "bg-teal-700 text-white" : tone === "surface" ? "bg-surface" : "bg-background";
  return (
    <section className={cn("w-full", bg)}>
      <div className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:py-10", className)}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `BrandMark`** (accessible strikethrough — "service" same color, struck; "tracker" accent)

```tsx
export default function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true">
        Boone&apos;s #1 weather <s className="decoration-2">service</s>{" "}
        <span className="font-bold text-orange">tracker</span>
      </span>
      <span className="sr-only">Boone&apos;s number one weather tracker (not service)</span>
    </span>
  );
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success (components compile; unused-until-wired is fine).

- [ ] **Step 4: Commit**

```bash
git add src/components/SectionBand.tsx src/components/BrandMark.tsx
git commit -m "feat(m2): SectionBand + accessible BrandMark primitives"
```

### Task 7: Restyle `SiteHeader` (mobile menu + tagline + brand mark)

**Files:**
- Modify: `src/components/SiteHeader.tsx`

- [ ] **Step 1: Replace the component** (keep the `links` array + active logic; add the tagline beside the logo and a mobile disclosure menu)

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Today" },
  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },
  { href: "/videos", label: "Videos" },
  { href: "/blog", label: "Blog" },
  { href: "/shop", label: "Swag Shop" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b-4 border-orange bg-teal-700">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-white.png" alt="Dave's Sweater" className="h-10 w-auto" />
        </Link>
        <span className="hidden text-[0.8rem] italic text-white/70 md:inline">
          Boone&apos;s most mostly reliable weather tracker and resource
        </span>
        <nav className="ml-auto hidden gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={cn("rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
                isActive(l.href) ? "bg-orange text-white" : "text-white/75 hover:bg-white/15 hover:text-white")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-white md:hidden">
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/15 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={cn("rounded-md px-3 py-3 text-sm font-medium",
                isActive(l.href) ? "bg-orange text-white" : "text-white/80 hover:bg-white/10")}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify build + visual (mobile menu opens, ≥44px target)**

Run: `npm run build` then `npm run dev` — at ~375px the menu button toggles the list; tagline hidden on phone, shown ≥md.
Expected: works; no horizontal overflow.

- [ ] **Step 3: Commit**

```bash
git add src/components/SiteHeader.tsx
git commit -m "feat(m2): restyle header with mobile menu + tagline"
```

### Task 8: Restyle `SiteFooter`

**Files:**
- Modify: `src/components/SiteFooter.tsx`

- [ ] **Step 1: Replace the footer** (dark, methodology link, disclaimer, tagline)

```tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-teal-900 text-white/70">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center">
        <span>Dave&apos;s Sweater · Boone, NC · <span className="italic">Boone&apos;s most mostly reliable weather tracker and resource</span></span>
        <span className="sm:ml-auto">
          <Link href="/right-wrong-ray" className="text-white/85 underline-offset-2 hover:underline">How we score it</Link>
          <span className="mx-2">·</span>Not affiliated with Ray&apos;s Weather
        </span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build`
Expected: success.

```bash
git add src/components/SiteFooter.tsx
git commit -m "feat(m2): restyle footer with methodology link + disclaimer"
```

---

## Phase 3 — Homepage

### Task 9: `Scoreboard` band

**Files:**
- Create: `src/components/Scoreboard.tsx`

- [ ] **Step 1: Implement** (3-up; free in green, Ray's flagged orange; works on dark)

```tsx
import type { SourceStat } from "@/lib/homeStats";
import { cn } from "@/lib/utils";

export default function Scoreboard({ sources }: { sources: SourceStat[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {sources.map((s) => (
        <div key={s.key}
          className={cn("rounded-xl p-3", s.isFree ? "bg-teal-800" : "border border-orange bg-orange/15")}>
          <div className={cn("text-[0.65rem] sm:text-xs", s.isFree ? "text-white/65" : "text-orange-600")}>
            {s.label} · {s.isFree ? "free" : "paid"}
          </div>
          <div className={cn("font-display text-2xl font-bold sm:text-3xl", s.isFree ? "text-white" : "text-orange")}>
            {s.avg.toFixed(1)}
          </div>
          <div className={cn("text-[0.6rem] sm:text-[0.7rem]", s.isFree ? "text-green" : "text-orange")}>
            {s.record}{s.isFree && s.wrong === 0 ? " · never last" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + commit**

Run: `npm run build`

```bash
git add src/components/Scoreboard.tsx
git commit -m "feat(m2): Scoreboard band component"
```

### Task 10: `IphoneShot` (screenshot + source label + date)

**Files:**
- Create: `src/components/IphoneShot.tsx`

- [ ] **Step 1: Implement** (server component; uses `latestScreenshotInfo`; honest label + date; graceful fallback)

```tsx
import { latestScreenshotInfo } from "@/lib/screenshot";

function fmt(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IphoneShot({ className = "" }: { className?: string }) {
  const info = latestScreenshotInfo();
  const label = info.source === "apple" ? "Apple Weather · free" : "Open-Meteo forecast";
  return (
    <figure className={className}>
      <div className="mx-auto w-[150px] rounded-[1.4rem] bg-black p-1.5">
        {info.available ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/screenshots/iphone_screenshot.png" alt={`${label} for Boone, NC`}
            loading="lazy" className="w-full rounded-[1.1rem]" />
        ) : (
          <div className="flex aspect-[9/19] items-center justify-center rounded-[1.1rem] bg-surface px-3 text-center text-xs text-muted">
            Today&apos;s forecast isn&apos;t in yet — check back tomorrow.
          </div>
        )}
      </div>
      {info.available && (
        <figcaption className="mt-2 text-center text-[0.7rem] text-white/65">
          <span className="text-green">●</span> {label}
          {info.date ? ` · updated ${fmt(info.date)}` : ""}
        </figcaption>
      )}
    </figure>
  );
}
```

- [ ] **Step 2: Verify build + commit**

Run: `npm run build`

```bash
git add src/components/IphoneShot.tsx
git commit -m "feat(m2): IphoneShot with honest source label + date"
```

### Task 11: `Hero`

**Files:**
- Create: `src/components/Hero.tsx`

- [ ] **Step 1: Implement** (server component; eyebrow + headline + scoreboard + screenshot co-anchor + CTA; mobile stacks, desktop splits)

```tsx
import Link from "next/link";
import type { HeroStats } from "@/lib/homeStats";
import BrandMark from "@/components/BrandMark";
import Scoreboard from "@/components/Scoreboard";
import IphoneShot from "@/components/IphoneShot";

export default function Hero({ stats }: { stats: HeroStats }) {
  return (
    <section className="w-full bg-teal-700 text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:py-10 md:grid-cols-[1.4fr_auto] md:items-center">
        <div>
          <div className="mb-2 text-xs text-white/75">
            <BrandMark /> · {stats.trackedDays} days on the record
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            The free forecast keeps beating the one <span className="text-orange">you pay for.</span>
          </h1>
          {/* screenshot leads on mobile (between headline and scoreboard); hidden here on md+ where it sits in the right column */}
          <IphoneShot className="my-5 md:hidden" />
          <div className="max-w-md">
            <Scoreboard sources={stats.sources} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link href="/right-wrong-ray"
              className="inline-flex min-h-11 items-center rounded-lg bg-orange px-5 font-bold text-white transition-colors hover:bg-orange-600">
              See the full scoreboard →
            </Link>
            <Link href="/right-wrong-ray" className="text-sm text-white/70 underline-offset-2 hover:underline">
              How we score it →
            </Link>
          </div>
        </div>
        <div className="hidden md:block">
          <IphoneShot />
          <p className="mt-3 max-w-[12rem] text-xs text-white/70">
            The only weather service you need is already in your pocket.
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build + commit**

Run: `npm run build`

```bash
git add src/components/Hero.tsx
git commit -m "feat(m2): dark Hero co-anchoring data + daily screenshot"
```

### Task 12: `TrendChart`

**Files:**
- Create: `src/components/TrendChart.tsx`

- [ ] **Step 1: Implement** (server component; inline responsive SVG from `trendChartGeometry`; no client JS, no deps)

```tsx
import type { TrendPoint } from "@/lib/homeStats";
import { trendChartGeometry } from "@/lib/homeStats";

export default function TrendChart({ points }: { points: TrendPoint[] }) {
  const g = trendChartGeometry(points, 600, 120, 40, 100);
  return (
    <div>
      <svg viewBox={`0 0 ${g.width} ${g.height}`} className="w-full" role="img"
        aria-label="The free forecast scores consistently near 90 across the season while Ray's scores lower and more erratically.">
        {g.rays && <polyline points={g.rays} fill="none" className="stroke-orange" strokeWidth="3" strokeDasharray="2 4" />}
        {g.free && <polyline points={g.free} fill="none" className="stroke-green" strokeWidth="3" />}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-white/70">
        <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-green align-middle" />Free forecasts</span>
        <span><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-orange align-middle" />Ray&apos;s Weather</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + commit**

Run: `npm run build`

```bash
git add src/components/TrendChart.tsx
git commit -m "feat(m2): inline-SVG TrendChart (free vs Ray's, gap-safe)"
```

### Task 13: `HeadToHeadCard`

**Files:**
- Create: `src/components/HeadToHeadCard.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from "next/link";
import type { HeadToHead } from "@/lib/homeStats";

export default function HeadToHeadCard({ h }: { h: HeadToHead }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">Dave&apos;s Sweater (free)</div>
        <div className="font-display text-3xl font-bold text-green">
          {h.dave != null ? h.dave.toFixed(1) : "—"}<span className="text-sm text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">Ray&apos;s Weather</div>
        <div className="font-display text-3xl font-bold text-orange">
          {h.rays != null ? h.rays.toFixed(1) : "—"}<span className="text-sm text-muted">/100</span>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="text-xs text-muted">What actually happened</div>
        <div className="mt-0.5 text-[0.8rem] leading-relaxed text-foreground">
          {h.actualLines.length ? h.actualLines.map((l, i) => <div key={i}>{l}</div>) : "—"}
        </div>
      </div>
      <div className="sm:col-span-3">
        <Link href="/right-wrong-ray" className="text-sm font-medium text-orange-600 underline-offset-2 hover:underline">
          See every day on the scoreboard →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + commit**

Run: `npm run build`

```bash
git add src/components/HeadToHeadCard.tsx
git commit -m "feat(m2): HeadToHeadCard for yesterday's matchup"
```

### Task 14: Extend `LiveConditions` with a 5-day `Outlook`

**Files:**
- Create: `src/components/Outlook.tsx`
- Modify: `src/components/LiveConditions.tsx`

- [ ] **Step 1: Implement `Outlook`** (client; pure presentational row)

```tsx
"use client";
export interface OutlookDay { label: string; hi: number; }

export default function Outlook({ days }: { days: OutlookDay[] }) {
  if (!days.length) return null;
  return (
    <div className="mt-3 grid grid-cols-5 gap-1.5">
      {days.map((d) => (
        <div key={d.label} className="rounded-lg bg-surface py-2 text-center">
          <div className="text-[0.65rem] text-muted">{d.label}</div>
          <div className="font-display text-sm font-bold text-teal">{Math.round(d.hi)}°</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Extend `LiveConditions`** to also fetch 5 days and render `Outlook`. Change the fetch URL to `&daily=temperature_2m_max&forecast_days=5`, build day labels, and render `<Outlook>` under the existing verdict block.

Add to the existing `useEffect` fetch handler (after computing the current verdict), and add outlook state:

```tsx
import Outlook, { type OutlookDay } from "@/components/Outlook";
// add to component state:
const [outlook, setOutlook] = useState<OutlookDay[]>([]);
```

In the fetch `.then`, after `setS(...)`, derive the 5-day outlook from the same response:

```tsx
const maxes: number[] = d?.daily?.temperature_2m_max ?? [];
const times: string[] = d?.daily?.time ?? [];
const labels = times.map((t) => new Date(t + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }));
setOutlook(maxes.slice(0, 5).map((hi, i) => ({ label: labels[i] ?? `D${i + 1}`, hi })));
```

Update the URL to request 5 days:

```tsx
const url = "https://api.open-meteo.com/v1/forecast?latitude=36.2168&longitude=-81.6746"
  + "&current=temperature_2m"
  + "&daily=temperature_2m_max&forecast_days=5&temperature_unit=fahrenheit&timezone=America/New_York";
```

Render `<Outlook days={outlook} />` after the verdict `<p>` block in the returned JSX.

- [ ] **Step 3: Verify build + visual**

Run: `npm run build` then `npm run dev` — live temp loads, 5-day row appears below the sweater verdict.
Expected: works; outlook degrades to nothing if the fetch fails (empty array).

- [ ] **Step 4: Commit**

```bash
git add src/components/Outlook.tsx src/components/LiveConditions.tsx
git commit -m "feat(m2): add 5-day outlook to LiveConditions island"
```

### Task 15: Assemble the homepage

**Files:**
- Modify: `src/app/page.tsx`
- Delete: `src/components/SweaterCard.tsx`, `src/components/ForecastCard.tsx`

- [ ] **Step 1: Rewrite `page.tsx`** to compose the sections from derived stats

```tsx
import { getScores, getLatestComparison } from "@/lib/data";
import { heroStats, trendSeries, headToHead } from "@/lib/homeStats";
import Hero from "@/components/Hero";
import SectionBand from "@/components/SectionBand";
import TrendChart from "@/components/TrendChart";
import HeadToHeadCard from "@/components/HeadToHeadCard";
import LiveConditions from "@/components/LiveConditions";

export default async function HomePage() {
  const [scores, comp] = await Promise.all([getScores(), getLatestComparison()]);
  const stats = heroStats(scores);
  const trend = trendSeries(scores);
  const h2h = headToHead(comp);
  const sw = comp?.sweater_weather ?? {};
  const temp = comp?.actuals?.high_f != null ? `${comp.actuals.high_f}°F` : "—";

  return (
    <>
      <Hero stats={stats} />

      <SectionBand tone="dark">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-orange">It&apos;s not a fluke</div>
        <h2 className="mb-4 font-display text-xl font-bold sm:text-2xl">The gap holds, day after day.</h2>
        <TrendChart points={trend} />
        {stats.rays && stats.bestFree && (
          <p className="mt-4 text-sm text-white/80">
            Over {stats.trackedDays} days the free forecast averaged {stats.bestFree.avg.toFixed(1)} —
            beating Ray&apos;s by {stats.pointGap.toFixed(1)} points, while Ray&apos;s finished dead last {stats.deadLastDays} times.
          </p>
        )}
        <p className="mt-4 border-l-2 border-orange pl-3 text-sm italic text-white/70">
          He makes big promises and hopes nobody ever checks the numbers. Now somebody is.
        </p>
      </SectionBand>

      {h2h && (
        <SectionBand tone="surface">
          <h2 className="mb-3 font-display text-lg font-bold sm:text-xl">Yesterday in Boone · {h2h.date}</h2>
          <HeadToHeadCard h={h2h} />
        </SectionBand>
      )}

      <SectionBand>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Oh — and we do actual weather too</div>
        <LiveConditions
          initialScore={sw.sweater_count ?? 0}
          initialVerdict={sw.detail ?? sw.answer ?? ""}
          initialLayers={sw.layers ?? ""}
          initialTemp={temp}
        />
      </SectionBand>
    </>
  );
}
```

- [ ] **Step 2: Remove `max-w-3xl` double-wrap in `layout.tsx`** — sections are now full-bleed and manage their own width. Change the `<main>` to:

```tsx
<main className="flex-1">{children}</main>
```

- [ ] **Step 3: Delete superseded components**

```bash
git rm src/components/SweaterCard.tsx src/components/ForecastCard.tsx
```

- [ ] **Step 4: Verify build + visual at ~375px and desktop**

Run: `npm run build` then `npm run dev`
Expected: homepage renders hero (screenshot leads on mobile, splits on desktop) → trend → head-to-head → live+outlook → footer; no horizontal scroll; stats match `scores.json`.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat(m2): assemble accuracy-first homepage; retire SweaterCard/ForecastCard"
```

---

## Phase 4 — Apply system to remaining pages + verification

### Task 16: `/right-wrong-ray` restyle + responsive table→cards

**Files:**
- Modify: `src/app/right-wrong-ray/page.tsx`

- [ ] **Step 1: Wrap sections in `SectionBand`** and replace the two `bg-card` `<section>`s with `<SectionBand>` (tone "surface" for the first, default for the scoreboard) keeping the existing tables for `sm:` and up.

- [ ] **Step 2: Add a mobile card view** for the season scoreboard rows. Below `md`, render cards instead of the wide table. Add `className="hidden sm:table"` to the existing `<table>` and add this stacked list directly after it:

```tsx
<ul className="space-y-2 sm:hidden">
  {rows.map((r) => (
    <li key={r.label} className="rounded-xl border border-border bg-background p-3">
      <div className="font-display font-bold text-teal">{r.label}</div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted">
        <span>Record<br /><span className="text-foreground">{r.record}</span></span>
        <span>Avg<br /><span className="text-foreground">{r.avg.toFixed(1)}/100</span></span>
        <span>Days<br /><span className="text-foreground">{r.days}</span></span>
      </div>
    </li>
  ))}
</ul>
```

- [ ] **Step 3: Apply the same `hidden sm:table` + mobile-card pattern** to the per-source "Right Ray / Wrong Ray" comparison table (cards show Source, Predicted lines, Score, Verdict).

- [ ] **Step 4: Verify build + visual** at ~375px (cards, no horizontal scroll) and ≥sm (tables).

Run: `npm run build` then `npm run dev`

- [ ] **Step 5: Commit**

```bash
git add src/app/right-wrong-ray/page.tsx
git commit -m "feat(m2): restyle scoreboard page; tables become cards on mobile"
```

### Task 17: Restyle blog, videos, shop

**Files:**
- Modify: `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/videos/page.tsx`, `src/app/shop/page.tsx`

- [ ] **Step 1: Wrap each page body in `SectionBand`** and swap headings to `font-display`, card surfaces to `bg-background`/`border-border`, and any accent text to `text-orange-600`. Keep all existing data logic and component props unchanged — this is a visual pass only.

- [ ] **Step 2: Confirm blog post body legibility** — the `/blog/[slug]` sanitized HTML must read on the light body (check headings/links inherit token colors; add `prose`-like spacing utilities only if needed, no new deps).

- [ ] **Step 3: Verify build + visual** for all four routes at ~375px and desktop.

Run: `npm run build` then `npm run dev`

- [ ] **Step 4: Commit**

```bash
git add src/app/blog src/app/videos src/app/shop
git commit -m "feat(m2): apply design system to blog, videos, shop"
```

### Task 18: SEO/OG refresh + full verification

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Refresh OpenGraph + description copy** in the `metadata` export to match the new hero (keep title template, **both** GSC verification tags, GA, favicon, apple-touch-icon untouched):

```tsx
description: "The free forecast keeps beating the paid one. We score every Boone forecast against what actually happened — and keep the receipts.",
openGraph: {
  title: "Dave's Sweater — Boone's #1 weather (service) tracker",
  description: "Free forecasts beat Ray's, tracked daily. Boone's most mostly reliable weather resource.",
  url: "https://davessweater.com", type: "website",
},
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 3: Run lint + production build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds; `sitemap.xml` + `robots.txt` still emit (unchanged from M1).

- [ ] **Step 4: Visual QA pass** at ~375px and desktop across every route (`/`, `/right-wrong-ray`, `/videos`, `/blog`, `/blog/[slug]`, `/shop`): dark hero + light body, Space Grotesk headlines, no horizontal scroll, tap targets ≥44px, screenshot label/date correct, stats match `scores.json`.

- [ ] **Step 5: Update CHECKLIST.md** — check off the M2 line and note the build shipped; add any follow-ups discovered (e.g., the real-Apple-screenshot Shortcut automation, sweater-scale recalibration if surfaced).

```bash
git add src/app/layout.tsx CHECKLIST.md
git commit -m "feat(m2): refresh OG/description; final M2 verification"
```

- [ ] **Step 6: Deploy preview** — push the branch; confirm the Vercel **preview** deploy is green and visually correct on mobile + desktop before any merge to `main`.

---

## Notes for the executor

- **No pipeline/scoring changes.** Do not touch `scripts/*.py`, `data/` formats, or the workflows. M2 is presentation-only.
- **Stats are always derived** from `scores.json`/comparisons — never hardcode a number into copy. The one heuristic is the screenshot size threshold (`REAL_APPLE_MIN_BYTES`), documented as interim.
- **Voice:** keep it dry and sharp — pointed at Ray's, framed as tracked data. Don't soften headlines into generic SaaS copy.
- **Next 16:** read the bundled Next docs before using an unfamiliar App Router/`next/font` API; don't rely on memory.
- **React/Next currency:** before writing each TSX component task, apply the `react-best-practices` skill and consult the official React 19 / Next 16 docs (https://react.dev/reference/react). Memorized component/hook APIs are likely stale — verify `next/font`, server-vs-client boundaries, and metadata APIs against current docs.
- **Brand line:** "service" stays the same color as surrounding text, struck through; "tracker" is the orange accent; screen readers get "weather tracker (not service)".
