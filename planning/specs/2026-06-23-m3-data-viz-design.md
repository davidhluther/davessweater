# M3 — Dynamic Data-Viz (Design Spec)

**Date:** 2026-06-23
**Status:** Approved design, pre-plan (hardened via 3-way adversarial review)
**Milestone:** M3 (dynamic data-viz)
**Reference handoff:** `planning/handoffs/2026-06-23-m3-data-viz-handoff.md`

## Goal

Turn Dave's Sweater's accuracy data into **interactive data-viz** that makes the thesis visceral: the free forecast keeps pace with — and beats — the paid one, and the paid one withholds detail the free one gives away. The craft is itself part of the argument, so the bar is a clean, fast, "538 / Pudding"-grade treatment that stays defensible and accurate. This is the first, intentionally-scoped increment of an iterative milestone.

## Data keys (use these exact keys — verified against the repo 2026-06-23)

- **Sources** (`scores.json` `entries`/`totals`/`coverage` + code `SrcKey`): `openmeteo`, `raysweather`, `apple_weather`.
- **Coverage fields:** `high_temp`, `low_temp`, `wind`, `precip_type`, `precip_amount`.
- Per-day scores live under the source keys in `scores.json.entries`. Per-day breakdowns live in `data/comparisons/<date>.json` at `sources.<source>.score.breakdown.<field>.{ predicted, actual, error, scored, points, max, unit }` (unscored fields carry `points: null`, `scored: false`).
- **v1 renders `openmeteo` (free) + `raysweather` (paid) only** — see "Apple / source provenance" below.

## Scope

### In
- **Interactive trend chart** (visx) — homepage hero, replacing the static `TrendChart`. **Two lines in v1: Open-Meteo (free) vs Ray's (paid).**
- **Sortable tables with inline sparklines** on `/right-wrong-ray`.
- A **coverage matrix** on `/right-wrong-ray`.
- Restrained, tasteful **motion**.
- **Adds the `@visx/*` packages** as the one new runtime dependency (`responsive scale shape axis grid tooltip group event`), pinned to React-19-compatible versions. ("`src/`-only" means no Python / `data/` / workflow changes — this dependency add is in scope.)
- **Type fixes** in `src/lib/types.ts`: add `coverage` to `Scores`; correct `ScoreBreakdownField` to the real engine shape.
- Architecture is **N-source-ready** (keyed off source data), so future real forecasters add without component changes.

### Out (deferred)
- The Apple line (see below); the 7 newly-captured forecasters; a range toggle/brush; a rain/snow coverage split; scrollytelling / motion library; any pipeline / scoring / `data/` / workflow change; the real-Apple Shortcut automation.

## Apple / source provenance (decision: drop Apple from v1)

All 106 scored `apple_weather` days are the **Open-Meteo fallback** (`iphone_forecast.json`), not real Apple Weather (only 2 real iPhone-Shortcut files exist on disk; neither is in the scored window), and `scores.json` carries no provenance flag. Labeling Open-Meteo data as "Apple" would undercut the entire tracked-data thesis, so **v1 viz omits `apple_weather` entirely** and presents the genuine head-to-head: **Open-Meteo (free) vs Ray's (paid)**. When real iPhone-Shortcut data accrues (the deferred automation task), Apple returns as a real third series — the architecture keys off source keys, so adding it is data-only.

> **Related follow-up (flagged, not M3-blocking):** the existing M2 homepage scoreboard + hero copy also surface `apple_weather` as "Apple Weather" using the same fallback data. The honest fix (drop or relabel) is recommended and tracked in `CHECKLIST.md`; it is out of M3 viz scope unless explicitly folded in.

## Design direction

- **"B + visx"** (locked); a season **heat map was declined**. **Inherits the M2 visual identity verbatim** (dark-teal/orange palette, Space Grotesk + Inter, the `SectionBand` rhythm).
- **Color (2 lines in v1):** Open-Meteo = **solid green** (`--green`), Ray's = **dashed orange** (`--orange`) — distinguishable by **line-style + label, not hue alone**. Faint dashed grade-band reference lines at **75** (Right) and **60** (Wrong).

## Information architecture (split by depth)

- **Homepage (`/`)** stays the mobile-light conversion front door: the interactive trend chart becomes its hero viz (replacing the static one); the scoreboard stat cards remain.
- **`/right-wrong-ray`** becomes the deep-dive: sortable tables w/ sparklines + the coverage matrix + existing methodology.

## Components & data flow

All data is derived at **build time** in async Server Components, then passed as plain serializable props into client-island leaves. **No `fs`/`node` reads in client code** — mirror the `LiveConditions` server-seed → client-island pattern.

### 1. `TrendChartInteractive` — `src/components/TrendChartInteractive.tsx` (`'use client'`)
- Replaces `src/components/TrendChart.tsx`. Two lines (Open-Meteo solid green, Ray's dashed orange) over the rays-scoped window from `trendSeries()` — **unchanged**: its existing `{ date, free=openmeteo, rays=raysweather }` shape fits v1 exactly. Faint grade-band reference lines at 75 and 60.
- **Hover or tap** a day → tooltip with both scores, the day's actual conditions, and Ray's predicted/actual/error for the fields he actually published.
- **Tooltip data is NOT from `trendSeries()`.** It requires a new build-time loader in `src/lib/data.ts` (e.g. `getComparisonWindow()`) that reads each `data/comparisons/<date>.json` in the window, plus a pure shaping helper `src/lib/trendTooltip.ts` producing a per-date map `{ date → { openmeteo score, rays score, actuals lines, rays field-misses } }`. This map is passed as a prop alongside the `trendSeries()` points.
- Tooltip shows a field's predicted/actual/error **only where `breakdown.<field>.scored === true`**. Ray's `precip_amount` (deliberately unscored) renders an explicit **"not published"** — never a fabricated miss.
- **Tech:** `@visx/responsive` `ParentSize` for SSR-safe width inside a wrapper with an **explicit height** (e.g. `h-[260px]`) so the pre-mount 0×0 frame causes no CLS; `@visx/scale`, `@visx/shape` `LinePath`, `@visx/axis`, `@visx/grid`, `@visx/tooltip` (`useTooltip`/`TooltipWithBounds`), `@visx/group`, `@visx/event` `localPoint`. Nearest-day-on-hover via `scale.invert` + a manual nearest search (no listed visx module provides bisection). visx color props are JS strings — pass `var(--…)`/hex, not Tailwind classes.

### 2. `SortableScoreTable` + `Sparkline` — `src/components/SortableScoreTable.tsx`, `src/components/Sparkline.tsx` (`'use client'`)
- Extract the two tables inlined in `src/app/right-wrong-ray/page.tsx` (latest-day comparison; season scoreboard from `scoreboardRows()`) into one client component: header click sorts (real `<button>` headers + `aria-sort` + keyboard), each source row carries an inline `Sparkline`.
- `scoreboardRows()` (`src/lib/scoreboard.ts`) carries **no per-day history** — add a pure selector `src/lib/sparkline.ts` mapping `scores.entries` → per-source score series joined to rows by source key. **All sparklines share the rays-scoped window** so Open-Meteo's longer record isn't visually incomparable to Ray's. Sparkline geometry is a pure, unit-tested helper; `Sparkline` renders a small SVG/visx `LinePath`.
- v1 rows: `openmeteo` + `raysweather` (Apple omitted per provenance). Responsive: table on `md+`, stacked cards below `md`. Each sparkline has an `aria-label`/text summary (and is `aria-hidden` if a numeric summary already conveys the trend), is never the sole signal, and must not compress card tap targets below 44px at ~360px.

### 3. `CoverageMatrix` — `src/components/CoverageMatrix.tsx` (**server component**)
- Source × field grid from `scores.json.coverage`, each cell `provided/days` with a proportional fill. **No interaction in v1 → server component** (the `'use client'` rule applies to the chart + sortable table). The coverage selector `src/lib/coverage.ts` runs server-side.
- **Framing:** Ray's `precip_amount` = 0/N is the **headline** — a categorical omission he never publishes (deliberate, legitimate; not a bug/error state). Ray's other partial coverage (e.g. `wind` ~76/109) is **incidental scrape availability, framed neutrally as data availability, not a knock** — distinguish the two in the UI (e.g. a one-line legend, or distinct treatment for a categorical 0/N omission vs. partial coverage).
- Mobile: compact grid reflowing to per-source rows on narrow screens.

### 4. Motion (restrained, v1)
- Line draw-in on first paint; hover/sort transitions via CSS + visx built-ins. **No motion library.** Under `prefers-reduced-motion`: render final state with no draw-in, transitions disabled. Draw-in must not shift layout (no CLS).

## Data layer

- **`src/lib/types.ts`:**
  - Add `coverage` to `Scores`: `Partial<Record<SrcKey, Record<"high_temp"|"low_temp"|"wind"|"precip_type"|"precip_amount", { provided: number; days: number }>>>`. **`coverage` already exists in `scores.json` at runtime (verified 2026-06-23) — this is a TYPE-ONLY addition; no data/pipeline change.**
  - Fix `ScoreBreakdownField` to the real engine output: `{ predicted?: number|string|null; actual?: number|string|null; error?: number|null; scored?: boolean; unit?: string; points: number|null; max: number }`.
- **New build-time loader** in `src/lib/data.ts` for the comparison window (tooltip breakdowns). `getScores()` is unchanged (returns raw JSON; `coverage` already present).
- **New pure helpers** (each its own file; unit-tested under `src/lib/__tests__/`): `src/lib/coverage.ts` (coverage → matrix rows/cells), `src/lib/sparkline.ts` (entries → per-source series + geometry), `src/lib/trendTooltip.ts` (comparisons → per-date tooltip map), `src/lib/tableSort.ts` (sort comparators). `trendSeries()` is **unchanged** (2-line shape fits v1).

## Accessibility & mobile

- **Mobile-first** (~360–390px): no horizontal scroll; tap targets ≥ 44px; charts responsive/legible; tables reflow to cards below `md`.
- **Chart values reachable without hover** (touch is the likeliest traffic): tap-to-pin tooltip **and** a visually-hidden `<table>` of the series as the accessible equivalent (`aria-describedby`). Color never the sole signal (line-style + labels).
- **Sortable table:** real `<button>` headers, `aria-sort`, full keyboard operation.
- **`prefers-reduced-motion`:** render final state, no draw-in.

## Honesty & brand guardrails (load-bearing)

- **Grade bands ≠ rankings.** `totals.{right,wrong,meh}` count grade-band days (Wrong = scored < 60), not placement. No viz/label may imply "dead last N times."
- **Thresholds & points model:** source from `scripts/scoring.py` (the engine; `_score_grade`: Right ≥ 75, Meh 60–74, Wrong < 60 → reference lines at 75/60). `CLAUDE.md`'s grade-band table happens to match, but its points/tolerance table omits the snow-aware model — treat `scoring.py` as the single source of truth.
- **Source honesty:** v1 shows only `openmeteo` + `raysweather`; any source shown is the source the data is actually from (Apple omitted — its data is Open-Meteo fallback).
- **Not a Ray's clone** (palette + genre only); voice dry/wry/sharp-not-sour; claims framed as tracked data.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| visx regresses perf / CLS | Client island only; `ParentSize` inside an explicit-height wrapper (no 0×0 collapse / shift); import only the needed `@visx/*` modules; verify Lighthouse/CLS on the live preview. |
| SSR / `window` errors | All chart code `'use client'`; no `window`/layout reads during render; measure after mount. |
| Tooltip / type mismatch | Fix `ScoreBreakdownField` to the real JSON; tooltip handles null/unscored fields (Ray's precip → "not published"). |
| Mislabeled source (credibility) | v1 omits Apple-fallback; only real-provenance sources shown; threshold legends from `scoring.py`. |
| Matrix reads "Ray's is broken" | `precip_amount` 0/N framed as a deliberate omission; partial coverage framed as availability; distinct UI treatment. |
| Sparklines visually incomparable | All share the rays-scoped window; pure geometry helper unit-tested. |

## Acceptance criteria

1. The homepage hero trend chart is interactive (hover **and tap** reveal Open-Meteo + Ray's scores, the day's actuals, and Ray's published-field misses), responsive, with no console errors and no CLS regression on the live preview.
2. `/right-wrong-ray` shows both score tables as sortable (keyboard + `aria-sort`), each source row with an inline sparkline over the shared window; tables reflow to cards below `md`.
3. `/right-wrong-ray` shows the coverage matrix from `scores.json.coverage`; Ray's `precip_amount` 0/N is presented as a deliberate omission, partial coverage framed neutrally.
4. New pure lib helpers have passing vitest tests; `npm test`, `npm run lint`, and `next build` are green (with the `@visx/*` deps installed).
5. The interactive viz (chart + sortable table) are `'use client'` islands fed by server-shaped props; `CoverageMatrix` may be a server component; no client `fs` reads; `Scores.coverage` + the corrected `ScoreBreakdownField` land in `types.ts`.
6. No viz labels fallback data as a source it isn't from (Apple omitted in v1); chart values are reachable without hover; grade/threshold labels match `scripts/scoring.py`.
7. Mobile (~375px) and desktop both verified visually; no horizontal scroll.
8. N-source-ready: adding a real source to the data requires no component changes (only the deferred type-widening).

## Spec location

This spec lives at `planning/specs/2026-06-23-m3-data-viz-design.md`. The implementation plan will be written to `planning/plans/2026-06-23-m3-data-viz.md` via the writing-plans skill.
