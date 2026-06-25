# M3 — "Why We Exist" Scrollytelling Section (Design Spec)

**Date:** 2026-06-25
**Status:** Approved design, pre-plan
**Milestone:** M3, iteration #2 (the "ambitious motion" pass; iteration #3 = N-source viz, separate)

---

## Goal

Add a modern, scroll-driven narrative section to the homepage that **explains why Dave's Sweater exists**
— the data-democracy thesis: free, open data plus cheap modern design have made legacy paid forecasts
obsolete — and **proves it with the tracked accuracy data**. The motion frames the data; it never
performs over it. The fact that the section is beautiful *and* built for the price of a domain is itself
part of the argument.

## Scope

**In:**
- One new homepage section ("Why this exists"), placed directly **below the hero**, that **replaces the
  current standalone "It's not a fluke" trend block** (the trend chart moves into this section's climax —
  no duplicate chart). Head-to-head and live-conditions sections remain unchanged below it.
- Built on the **Aceternity `Timeline`** pattern (free; vendored into `src/`), carrying **five narrative
  beats**; a scroll-driven beam fills and nodes light as each beat is reached.
- Restrained motion vocabulary: `framer-motion` `whileInView` reveals (BlurFade/AnimatedSection style,
  ease `[0.16,1,0.3,1]`, ~0.7s, `viewport once`), spring **`NumberTicker`** (ported from `my-site`).
- A subtle **grid/dot background** (Aceternity, free) behind the section; **one** glow-ring accent on the
  winning free stat (plain CSS box-shadow); **one** **`Pointer Highlight`** (Aceternity, free) on the
  closing line.
- The climax beat = the **existing `TrendChartInteractive`** (M3 v1 visx chart) with an added
  **draw-in-on-view** animation. Reuse, don't rebuild.
- **All stats build-time-derived** from `scores.json` via `homeStats` (no hardcoded numbers; evergreen copy).
- `prefers-reduced-motion`, mobile-first (~360–390px), and no-CLS guarantees.

**Out:**
- The janky "old way" legacy foil — **explicitly cut** (confusing; risks overshadowing the message).
- Flashy Aceternity effects (meteors, sparkles, vortex, 3D/tilt cards, globes, typewriter/text-generate,
  lamp, beams) — ruled out as overshadowing on a credibility site.
- Full-homepage restructure (Approach A) and dedicated `/why` route (Approach B). This is the embedded
  section (Approach C).
- **Aurora background — deferred/optional.** A future whisper behind the hero; not core. Revisit after.
- Any pipeline/`data/`/`scripts/` changes — **`src/`-only**.
- N-source viz (iteration #3) and any new-forecaster surfacing.

## Design direction

Restraint is the argument; data-first. Voice stays **dry, wry, sharp — not sour**. Each beat lands on a
tracked number, not an assertion. Visual identity inherits M2 verbatim (dark-teal feature band, Space
Grotesk display + Inter body, green = free/winning, orange = Ray's/paid).

## The narrative arc (five beats)

Copy is final-draft; data bindings in `{braces}` come from `homeStats`/`scores.json` (never hardcoded).

1. **"One forecast. One bill."** — the gatekept past. *(text only)*
2. **"So somebody started checking."** — the tracker premise. → "…every prediction scored against what
   actually happened — `{trackingDays}` days and counting." *(NumberTicker on trackingDays)*
3. **"The gap isn't close."** — **climax.** The trend chart draws in; three NumberTickers:
   Free `{trackingBestFree.avg}` (green, glow ring) · Ray's `{trackingRays.avg}` (orange) ·
   Gap `{trackingPointGap}` pts.
4. **"It was never better weather."** — the thesis: open data, not better weather. → "He won't even commit
   to a rain total: `0` of `{coverage.raysweather.precip_amount.days}` days." *(the legitimate
   `precip_amount = 0/N` coverage gap, shown loudly)*
5. **"The old way is out."** — closer + CTA to `/right-wrong-ray`. `Pointer Highlight` on the headline.

## Information architecture / placement

Homepage order becomes: **Hero → "Why this exists" (this section) → Yesterday's head-to-head → live
conditions + outlook.** The new section is a dark `SectionBand`. The current `page.tsx` "It's not a fluke"
block (heading + `TrendChartInteractive` + the two explainer paragraphs) is **absorbed** here: its copy
folds into beats 2–4, its chart becomes the climax node.

## Architecture / components

- **`WhyTimeline`** (`'use client'`) — the section. The Server Component (`page.tsx`) computes beat stats
  via `homeStats(scores)` and passes them as plain props; the client island renders the timeline + motion.
  Mirror the `LiveConditions` server-seeds-client pattern. **No `fs` reads in client code.**
- **Vendored (free) into `src/components/`:** Aceternity `Timeline` (DS-tokenized), Aceternity grid/dot
  background, Aceternity `PointerHighlight`; Magic UI `NumberTicker` (copy from `my-site`). Keep each as an
  isolated leaf component.
- **Chart:** reuse `TrendChartInteractive`; add a draw-in-on-view (framer-motion `whileInView` →
  animate the LinePath `pathLength`, or a stroke-dashoffset reveal). Preserve PR #62's rays-scoped window.
- **New dependency:** `framer-motion` (validated by `my-site`/`pigasus-group`; second runtime dep after
  visx). Flagged for sign-off.
- **Scroll mechanism:** the Timeline beam fills via `useScroll` on the section ref (`offset` start/end);
  beats reveal via `whileInView` one-shot (`once:true`). **Prefer one-shot in-view triggers over
  continuous scroll-scrubbing for the chart and tickers** — calmer, more reliable on mobile, no jank.
- **Reduced-motion:** render the final static state (beam full, nodes lit, numbers final, chart drawn, all
  beats visible) — no motion.

## Design system

Reuse M2 tokens from `globals.css` (`--teal-900` section bg, `--green` free, `--orange` Ray's,
`--font-display` Space Grotesk weights 500/700 only, `--font-sans` Inter). framer-motion color props are JS
strings → pass `var(--green)`/`var(--orange)` or hex. Grid/dot via a CSS radial-gradient at low opacity.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| framer-motion bundle / mobile perf | Import only what's used; the chart/tickers animate `transform`/`opacity`/`pathLength` only; measure `next build` output. |
| Scroll jank on phones | One-shot `whileInView` (not continuous scrubbing) for chart + tickers; beam fill is the only scroll-linked value. |
| Layout shift (CLS) | Fixed heights on the chart wrapper and beat blocks; beats present in DOM and revealed via opacity/transform (never inserted). |
| Motion overshadowing data | Restraint rules baked in: no flashy components; motion only on reveal / numbers / chart-draw; exactly one glow + one highlight accent. |
| Hardcoded/stale stats | Every number bound to `homeStats`-derived props; verify by mutating `scores.json` and seeing copy change. |
| Long mobile scroll | Keep to five tight beats; hero's 3-second payoff stays above the fold. |
| Vendoring Aceternity | Copy source into `src/` (free, MIT-style); re-tokenize to DS; no Pro/blocks needed. |

## Acceptance criteria

1. "Why this exists" Timeline renders below the hero and replaces the standalone "It's not a fluke" block;
   head-to-head + live conditions remain below, unchanged.
2. Five beats with the agreed copy; every data point bound to `scores.json`-derived values (no hardcoded
   numbers) — proven by changing the data and seeing the copy update.
3. On scroll / in-view: beam fills, nodes light, beats reveal calmly, NumberTickers count up, the trend
   chart draws in at the climax, glow ring on the free stat, Pointer Highlight on the closing line.
4. `prefers-reduced-motion`: all final states shown statically; no motion.
5. Mobile ~360–390px: no horizontal scroll, ≥44px targets, no CLS, chart legible, timeline/beam reads.
6. `npm test` (any new pure lib helpers) + `npm run lint` + `next build` all green.
7. `framer-motion` added; Aceternity `Timeline` / grid-dot / `PointerHighlight` + Magic UI `NumberTicker`
   vendored into `src/`, DS-tokenized; the existing `TrendChartInteractive` reused (not duplicated).
8. Voice stays dry/sharp; no flashy/overshadowing motion present.

## Spec location

`planning/specs/2026-06-25-m3-scrollytelling-design.md` (this file). Implementation plan to follow at
`planning/plans/2026-06-25-m3-scrollytelling.md`.
