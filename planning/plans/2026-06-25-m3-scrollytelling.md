# M3 — "Why We Exist" Scrollytelling Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restrained, scroll-driven "Why this exists" section to the homepage (below the hero, replacing the standalone "It's not a fluke" trend block) that frames the data-democracy thesis and proves it with the tracked accuracy data — motion serving the numbers, never overshadowing them.

**Architecture:** A new `'use client'` `WhyTimeline` island renders a vertical timeline (scroll-driven beam via framer-motion `useScroll`) carrying five narrative beats. The Server Component (`page.tsx`) derives all beat stats at build time via a new pure `whyStats()` helper and passes them as plain props, plus the existing `trendSeries`/tooltip data. The climax beat reuses the existing `TrendChartInteractive` (untouched) inside a clip-path "draw-in" wrapper. Small vendored primitives (`NumberTicker`, `PointerHighlight`) provide the spring count-up and the one text-highlight accent. Everything degrades to a clean static state under `prefers-reduced-motion`.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4 (`@theme inline` tokens), framer-motion (new dep, v12 — validated by the owner's `my-site`/`pigasus-group`), `@visx/*` (already installed, via the reused chart), vitest (pure lib only).

**Reference spec:** `planning/specs/2026-06-25-m3-scrollytelling-design.md`

**Standing rules:**
- `src/`-only — no `scripts/*.py`, `data/`, or `.github/workflows` changes.
- Stats are always derived from `scores.json` via lib helpers — never hardcode a number into copy.
- Components are verified by `npm run build` + `npm run lint` + a visual check (~360–390px and desktop). Pure lib functions are TDD'd with vitest. **No component-test framework is installed — keep it that way.**
- framer-motion v12 / Next 16 / React 19: the code below is taken from the owner's working `my-site`/`pigasus-group` patterns. If you touch an unfamiliar framer-motion API, verify it against the installed version before guessing.
- Voice stays dry/wry/sharp. Free = green, Ray's/paid = orange (M2 tokens).

---

## File structure

**Create:**
- `src/components/ui/number-ticker.tsx` — spring count-up that fires on in-view (ported from `my-site`).
- `src/components/ui/pointer-highlight.tsx` — one-shot text highlight that sweeps in on in-view.
- `src/components/ChartReveal.tsx` — clip-path left-to-right "draw-in" wrapper for the climax chart.
- `src/components/WhyTimeline.tsx` — the `'use client'` scrollytelling section (beam + 5 beats + accents).
- (Test) extend `src/lib/__tests__/homeStats.test.ts`.

**Modify:**
- `package.json` — add `framer-motion`.
- `src/lib/homeStats.ts` — add `WhyStats` interface + `whyStats()` pure helper.
- `src/lib/types.ts` — add `coverage` to `Scores` if not already typed (see Task 3 step 3).
- `src/app/page.tsx` — replace the "It's not a fluke" `SectionBand` block with `<WhyTimeline …/>`.

**Reuse untouched:** `src/components/TrendChartInteractive.tsx`, `src/components/SectionBand.tsx`, `src/lib/data.ts`, `src/lib/trendTooltip.ts`.

---

## Phase 0 — Dependency

### Task 1: Add framer-motion

**Files:**
- Modify: `package.json` (+ `package-lock.json` via npm)

- [ ] **Step 1: Install**

Run: `npm install framer-motion@^12.38.0`
Expected: `package.json` `dependencies` gains `"framer-motion": "^12.38.0"`.

- [ ] **Step 2: Verify build still compiles**

Run: `npm run build`
Expected: build succeeds (dep installed, not yet used).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(m3): add framer-motion for the scrollytelling section"
```

---

## Phase 1 — Vendored motion primitives

> Verified by `npm run build` + `npm run lint` (unused-until-wired is fine). No component tests.

### Task 2: `NumberTicker`

**Files:**
- Create: `src/components/ui/number-ticker.tsx`

- [ ] **Step 1: Create the component** (ported verbatim from `my-site`, our validated source)

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

export function NumberTicker({
  value,
  delay = 0,
  className,
  decimalPlaces = 0,
}: {
  value: number;
  className?: string;
  delay?: number; // seconds
  decimalPlaces?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;
    const t = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(t);
  }, [motionValue, isInView, delay, value]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  // Render the final value as SSR/no-JS/reduced-motion fallback; the spring overwrites it on view.
  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(value)}
    </span>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/number-ticker.tsx
git commit -m "feat(m3): vendor NumberTicker (spring count-up on in-view)"
```

### Task 3: `whyStats` pure helper (TDD)

**Files:**
- Modify: `src/lib/homeStats.ts`
- Modify: `src/lib/types.ts` (only if `coverage` is missing — see Step 3)
- Test: `src/lib/__tests__/homeStats.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing test file)

```ts
import { whyStats } from "@/lib/homeStats";

describe("whyStats", () => {
  const scores = {
    entries: [
      { date: "2026-06-23", openmeteo: 90, raysweather: 60 },
      { date: "2026-06-24", openmeteo: 92, raysweather: 70 },
    ],
    totals: {},
    coverage: { raysweather: { precip_amount: { provided: 0, days: 2 } } },
  };

  it("bundles the five beat stats from the tracking window + coverage", () => {
    const w = whyStats(scores as never);
    expect(w).toEqual({
      trackedDays: 2,
      freeLabel: "Open-Meteo",
      freeAvg: 91,
      raysAvg: 65,
      gap: 26,
      raysPrecipDays: 2,
    });
  });

  it("never throws on null/empty scores", () => {
    expect(whyStats(null)).toMatchObject({ trackedDays: 0, freeAvg: 0, raysAvg: 0, gap: 0, raysPrecipDays: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: FAIL — `whyStats` not exported.

- [ ] **Step 3: Ensure `coverage` is on the `Scores` type**

Open `src/lib/types.ts`. If `Scores` already has a `coverage` field (added with the M3 v1 coverage matrix), skip this step. Otherwise add it:

```ts
// inside the Scores interface
coverage?: Record<string, Record<string, { provided: number; days: number }>>;
```

- [ ] **Step 4: Implement `whyStats`** (append to `src/lib/homeStats.ts`, after `heroStats`)

```ts
export interface WhyStats {
  trackedDays: number;
  freeLabel: string;
  freeAvg: number;
  raysAvg: number;
  gap: number;
  raysPrecipDays: number;
}

export function whyStats(scores: Scores | null): WhyStats {
  const h = heroStats(scores);
  const raysPrecipDays =
    scores?.coverage?.raysweather?.precip_amount?.days ?? h.trackingRays?.days ?? 0;
  return {
    trackedDays: h.trackingDays,
    freeLabel: h.trackingBestFree?.label ?? "Open-Meteo",
    freeAvg: h.trackingBestFree?.avg ?? 0,
    raysAvg: h.trackingRays?.avg ?? 0,
    gap: h.trackingPointGap,
    raysPrecipDays,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/__tests__/homeStats.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/homeStats.ts src/lib/types.ts src/lib/__tests__/homeStats.test.ts
git commit -m "feat(m3): whyStats derives the five-beat stats from scores.json"
```

### Task 4: `PointerHighlight`

**Files:**
- Create: `src/components/ui/pointer-highlight.tsx`

- [ ] **Step 1: Create the component** (one-shot highlight that sweeps in left→right; static under reduced-motion)

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function PointerHighlight({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block">
      <motion.span
        aria-hidden
        className="absolute inset-x-[-0.12em] bottom-[0.04em] -z-10 h-[0.55em] origin-left rounded-sm border-b-2 border-orange bg-orange/25"
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/pointer-highlight.tsx
git commit -m "feat(m3): vendor PointerHighlight (one-shot text highlight)"
```

### Task 5: `ChartReveal`

**Files:**
- Create: `src/components/ChartReveal.tsx`

- [ ] **Step 1: Create the wrapper** (left→right clip-path "draw-in"; the child keeps full layout, so no CLS and `@visx` `ParentSize` still measures the real width)

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function ChartReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      whileInView={{ clipPath: "inset(0 0% 0 0)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChartReveal.tsx
git commit -m "feat(m3): ChartReveal clip-path draw-in wrapper"
```

---

## Phase 2 — The section

### Task 6: `WhyTimeline`

**Files:**
- Create: `src/components/WhyTimeline.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { TrendPoint, WhyStats } from "@/lib/homeStats";
import TrendChartInteractive from "@/components/TrendChartInteractive";
import ChartReveal from "@/components/ChartReveal";
import { NumberTicker } from "@/components/ui/number-ticker";
import { PointerHighlight } from "@/components/ui/pointer-highlight";

const EASE = [0.16, 1, 0.3, 1] as const;
const REVEAL = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

type Tooltip = React.ComponentProps<typeof TrendChartInteractive>["tooltip"];

function Beat({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  return (
    <motion.div
      className="relative pl-12"
      initial={reduce ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE }}
      variants={REVEAL}
    >
      <span
        aria-hidden
        className="absolute left-[13px] top-1.5 size-3 rounded-full bg-orange ring-2 ring-orange/40"
      />
      {children}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  dec = 1,
  tone,
  suffix = "",
}: {
  label: string;
  value: number;
  dec?: number;
  tone: "free" | "rays" | "gap";
  suffix?: string;
}) {
  const box =
    tone === "gap"
      ? "border border-orange/50 bg-orange/15"
      : "bg-teal-700";
  const glow = tone === "free" ? "shadow-[0_0_0_1px_rgba(29,158,117,0.5),0_0_22px_rgba(29,158,117,0.25)]" : "";
  const numColor = tone === "free" ? "text-emerald-300" : tone === "rays" ? "text-orange" : "text-white";
  return (
    <div className={`rounded-xl p-3 ${box} ${glow}`}>
      <div className="text-[0.65rem] text-white/65">{label}</div>
      <div className={`font-display text-xl font-bold sm:text-2xl ${numColor}`}>
        <NumberTicker value={value} decimalPlaces={dec} />
        {suffix && <span className="text-sm text-white/60">{suffix}</span>}
      </div>
    </div>
  );
}

export default function WhyTimeline({
  stats,
  points,
  tooltip,
}: {
  stats: WhyStats;
  points: TrendPoint[];
  tooltip: Tooltip;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.6"] });
  const beamHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="w-full bg-teal-900 text-white [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]">
      <div ref={ref} className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-orange">Why this exists</div>
        <p className="mb-8 text-sm text-white/60">Boone&apos;s outlook, fact-checked daily.</p>

        {/* beam track + scroll-driven fill (left edge of the beat gutter) */}
        <div aria-hidden className="absolute left-[18px] top-[5.5rem] bottom-10 w-0.5 bg-white/15" />
        <motion.div
          aria-hidden
          className="absolute left-[18px] top-[5.5rem] w-0.5 bg-gradient-to-b from-emerald-300 to-orange"
          style={{ height: reduce ? "100%" : beamHeight }}
        />

        <div className="relative space-y-8">
          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">One forecast. One bill.</h3>
            <p className="mt-1 text-sm text-white/70">You paid for the only outlook in town.</p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">So somebody started checking.</h3>
            <p className="mt-1 text-sm text-white/70">
              Every prediction, scored against what actually happened —{" "}
              <NumberTicker value={stats.trackedDays} className="font-display font-bold text-white" /> days
              and counting.
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="mb-3 font-display text-lg font-bold sm:text-xl">The gap isn&apos;t close.</h3>
            <ChartReveal>
              <TrendChartInteractive points={points} tooltip={tooltip} />
            </ChartReveal>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label={`${stats.freeLabel} · free`} value={stats.freeAvg} tone="free" />
              <Stat label="Ray's · paid" value={stats.raysAvg} tone="rays" />
              <Stat label="The gap" value={stats.gap} tone="gap" suffix=" pts" />
            </div>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">It was never better weather.</h3>
            <p className="mt-1 text-sm text-white/70">
              It&apos;s open data anyone can pull. The bill bought the habit — he won&apos;t even commit to a
              rain total: <strong className="text-white">0</strong> of{" "}
              <NumberTicker value={stats.raysPrecipDays} className="font-display font-bold text-white" /> days.
            </p>
          </Beat>

          <Beat reduce={reduce}>
            <h3 className="font-display text-lg font-bold sm:text-xl">
              <PointerHighlight>The old way is out.</PointerHighlight>
            </h3>
            <p className="mt-1 text-sm text-white/70">Better data is free. Good design is cheap. This site is the proof.</p>
            <Link
              href="/right-wrong-ray"
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-orange px-5 font-bold text-white transition-colors hover:bg-orange-600"
            >
              See every day on the scoreboard →
            </Link>
          </Beat>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success. (If `React.ComponentProps<typeof TrendChartInteractive>["tooltip"]` errors because the chart's prop isn't named `tooltip`, open `src/components/TrendChartInteractive.tsx`, read its prop types, and set `Tooltip` to the actual tooltip prop type.)

- [ ] **Step 3: Commit**

```bash
git add src/components/WhyTimeline.tsx
git commit -m "feat(m3): WhyTimeline scrollytelling section (beam, beats, climax chart)"
```

---

## Phase 3 — Wire-up + verification

### Task 7: Mount in the homepage (replace the "It's not a fluke" block)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the trend `SectionBand` with `WhyTimeline`**

In `src/app/page.tsx`: add the import and `whyStats` to the existing import lines, then replace the entire `<SectionBand tone="dark"> … </SectionBand>` block (the "It's not a fluke" / `TrendChartInteractive` / explainer paragraphs, currently right after `<Hero …/>`) with `<WhyTimeline …/>`. The hero, head-to-head, and live-conditions sections stay exactly as they are.

Imports (top of file):

```tsx
import { heroStats, trendSeries, headToHead, whyStats } from "@/lib/homeStats";
import WhyTimeline from "@/components/WhyTimeline";
```

Then, where `const stats = heroStats(scores);` is, add:

```tsx
const why = whyStats(scores);
```

Replace the dark trend `SectionBand` block with:

```tsx
<WhyTimeline stats={why} points={trend} tooltip={tooltip} />
```

(Leave `Hero`, the `h2h` `SectionBand`, and the live-conditions `SectionBand` untouched. `TrendChartInteractive` and `SectionBand` imports stay — the chart is now used inside `WhyTimeline`; `SectionBand` is still used by the other sections.)

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: success; no unused-import warnings (remove `TrendChartInteractive` from `page.tsx` imports if it's no longer referenced there).

- [ ] **Step 3: Visual check — desktop**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: below the hero, the dark "Why this exists" section shows the beam, five beats, the chart at the climax, and the scores. As you scroll the section into view: beats fade/rise in, the beam fills top→bottom, the numbers count up, the chart wipes in left→right, the closing phrase highlights. Head-to-head + live conditions render below, unchanged.

- [ ] **Step 4: Visual check — mobile (~375px) + reduced-motion**

In dev tools, set width ~375px: no horizontal scroll, beam/dots/chart legible, tap target on the CTA ≥44px, no layout shift as things animate. Then enable "Reduce motion" (OS or dev-tools emulation) and reload: everything renders in its final state (beam full, numbers final, chart fully shown, highlight present) with no animation.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(m3): mount WhyTimeline, retire the standalone trend block"
```

### Task 8: Full verification + checklist

**Files:**
- Modify: `CHECKLIST.md`

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all PASS (existing + the new `whyStats` tests).

- [ ] **Step 2: Lint + production build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds; no CLS warnings; bundle builds (sanity-check the route's JS size didn't balloon — framer-motion is the only add).

- [ ] **Step 3: Data-binding proof** (no hardcoded numbers)

Temporarily edit a value in `data/scores.json` (e.g. bump a `raysweather` entry), run `npm run dev`, confirm the beat copy (tracked days / averages / gap) reflects the change, then `git checkout data/scores.json` to revert.

- [ ] **Step 4: Update `CHECKLIST.md`**

Under the M3 section, check off this iteration with a one-line note (built, verified mobile + desktop + reduced-motion; framer-motion added; Aceternity Timeline/grid-dot/PointerHighlight + NumberTicker vendored; the standalone "It's not a fluke" block was absorbed into `WhyTimeline`). Note iteration #3 (N-source viz) remains gated on the new forecasters accruing days.

```bash
git add CHECKLIST.md
git commit -m "docs(m3): check off the scrollytelling section; note iteration #3 still gated"
```

- [ ] **Step 5: Deploy preview**

Push the branch; confirm the Vercel **preview** deploy is green and the section reads correctly on a real phone + desktop before any merge to `main`.

---

## Notes for the executor

- **Reduced-motion is a first-class path, not an afterthought.** Every animated element has a static final state. `useReducedMotion()` gates the beam fill, `ChartReveal` early-returns the bare chart, `NumberTicker` renders the final value as its SSR/fallback text, `PointerHighlight`/`Beat` set `initial={false}`.
- **No new hardcoded numbers.** All five beats bind to `whyStats`. The literal `0` in beat 4 is the rhetorical point (Ray's publishes a precip amount on zero days); the denominator is data-bound.
- **Don't touch `TrendChartInteractive`.** It's reused as-is inside `ChartReveal`. Preserve PR #62's rays-scoped `trendSeries` window — `page.tsx` already passes the scoped `trend`.
- **Beam/dot alignment** (`left-[18px]` beam vs `left-[13px]` dot) may need a 1–2px nudge in the visual check — tune in Task 7 Step 3, it's cosmetic.
- **framer-motion import path:** use `"framer-motion"` (matches the owner's `my-site`/`pigasus`). Do not switch to `"motion/react"`.
- **Mobile-first** is the likeliest traffic — verify ~375px first; the chart must stay legible and the section must not introduce horizontal scroll or CLS.
- **Aurora is out of scope** (deferred). **N-source viz is iteration #3**, separate and still gated on data.
