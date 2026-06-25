# M3 #2 Scrollytelling + RWR Transparency — Handoff (2026-06-25)

> Self-contained brief for a fresh session. Zero prior context assumed.

## What shipped (PR #70 → `main`, live)

**M3 iteration #2 — "Why we exist" homepage scrollytelling** + homepage polish + `/right-wrong-ray`
transparency. Spec/plan: `planning/specs/2026-06-25-m3-scrollytelling-design.md`,
`planning/plans/2026-06-25-m3-scrollytelling.md`.

- **`WhyTimeline`** (`'use client'`) — restrained framer-motion narrative below the hero: scroll-driven
  timeline beam (`useScroll`/`useTransform`), five data-bound beats (`whileInView` reveals), spring
  `NumberTicker`s, one `PointerHighlight`, the existing visx `TrendChartInteractive` at the climax.
  `prefers-reduced-motion`/mobile/no-CLS handled. Frames the data-democracy thesis, proves it with the data.
- **Homepage polish:** sweater-weather widget moved **between the hero and the section**, condensed, with a
  **"Sweater Weather Index"** header; single **centered** hero CTA, all redundant `/right-wrong-ray` links +
  all CTA arrows removed; the empty chart gap fixed (removed `ChartReveal` clip wrapper); **hero scoreboard
  cards aligned** (equal-height flex, reserved 2-line label, bottom-anchored record).
- **`/right-wrong-ray`:**
  - **Per-source score breakdown** (`ScoreBreakdown.tsx`, always-visible) — per field: predicted → actual,
    how far off (±error / "spot on"), points/max. Withheld fields (e.g. Ray's precip **amount**) now show as
    a **"not published" / —** row (the thesis: paid service won't commit to a rain total). Note the
    distinction: precip **type** (rain y/n, 10 pts) is scored; precip **amount** (inches, 10 pts) is
    forfeited by Ray's.
  - **"What they're predicting now"** (`UpcomingForecasts.tsx`) — each source's newest *unscored* forecast
    (high/low/wind/precip) so readers can verify them once the actuals land.
- **Pipeline:** `compare.py build_latest_forecasts()` (+ `--forecasts-only`, and an automatic call in the
  daily compare) → `data/latest_forecasts.json`, **reusing the scorer's per-source parsing** (no
  duplication), excluding already-scored days. **No GitHub Actions change.**
- **New:** `framer-motion` dep; components `WhyTimeline`, `ScoreBreakdown`, `UpcomingForecasts`,
  `ui/number-ticker`, `ui/pointer-highlight`; lib `whyStats()` (vitest-tested), `getLatestForecasts()`,
  `LatestForecasts`/`ForecastDisplay` types.
- A **final code review** ran; 4 fixes applied (reduced-motion ticker; data-derived "0 of N" numerator via
  `coverage.provided`; UTC forecast date; exclude scored days from "upcoming"). `npm test`/lint/`build` green.

## Separate, NOT yet merged — `feat/apple-real-data`

The Apple real-data correction lives on its **own local branch** (commit `20ee555`, 142 files): backfilled
**26 real Apple days** from the daily screenshots; `compare.py` **retains the Open-Meteo fallback scored as
"Apple" on no-data days** (owner decision — "a little dodgy", **no site caveat**); `apple_weather` = **109d @
88.52** (26 real + 83 fallback). Open-Meteo (91.65) + Ray's (65.18) provably unchanged. See memory
[[davessweater-apple-real-data]] + `planning/apple-weather-shortcut-setup.md`.

- **It is LOCAL only (never pushed).** To ship: `git push -u origin feat/apple-real-data` → `gh pr create`
  → merge. Branched off the same `main`, so expect a small reconciliation with M3 on `compare.py`
  (M3 appended `build_latest_forecasts` at the end; Apple edited the apple-scoring branch — different
  regions, should merge clean), `CHECKLIST.md`, and `CLAUDE.md`.
- **When it merges, the homepage's "free" hero stat flips** from Apple 91.9 (fallback) to Open-Meteo 91.7
  (`bestFree` recomputes). The M3 features are data-driven and unaffected.

## Outstanding work (prioritized)

1. **Ship the Apple branch** (above) — the corrected public numbers.
2. **OWM/Met.no daily-low capture bug** (Source Expansion pipeline, `scripts/capture_sources.py`): captured
   ~12:20 PM, OWM (low 70.7°) + Met.no (low 66°) report the **min of the remaining forecast hours** (evening
   low), not the **calendar-day low** (~52°, the overnight min that already passed). Open-Meteo/NWS give the
   full-day low. Unfairly tanks OWM/Met.no on low-temp scoring. **The 7 new sources started 2026-06-23 (1–2
   days)** — their scoring/viz is gated until this + general capture reliability are solid. Fix the daily-low
   aggregation (or accept some APIs can't yield the overnight low at midday → re-time the capture, or take
   the day's min across the full local day).
3. **Owner: fix the iPhone Shortcut** to write structured Apple data daily — `planning/apple-weather-shortcut-setup.md`.
4. **M3 #3 — N-source viz**: surface the 7 new forecasters in the scoreboard/coverage/trend once they have
   enough scored days. Widen `SrcKey`/`ORDER`/`LABELS`/`IS_FREE` + the `types.ts` unions.
5. **Optional: `/right-wrong-ray` presentation overhaul** — owner asked whether it'll be reworked; nothing
   planned. Offer stands to scope a more visual/collapsible redesign (reuse the homepage motion language).
6. Carryover (see `CHECKLIST.md`): methodology transparency on `/right-wrong-ray` (interval wind / snow
   model) + refresh the stale `CLAUDE.md` scoring table; promotion-readiness audit (Dims 1–4); recalibrate
   the 5-sweater scale; rewrite `README.md`.

## Context / gotchas

- **Two layers:** Python **stdlib-only** pipeline (`scripts/`, daily Actions → commit `data/` to `main`) +
  **Next.js 16** site (`src/`, reads committed JSON at build; Vercel rebuilds on push). CI Python **3.12**.
- **Stale Vercel dashboard config** (`.vercel/project.json`: `buildCommand=…build_site.py`, `output=docs`)
  is **INERT** — `vercel.json` (`framework: nextjs`) overrides it; `main` and the M3 preview both deployed
  fine via `next build`. Clean up the dashboard override when convenient.
- `framer-motion` imports from `"framer-motion"` (NOT `"motion/react"`), matching the owner's
  `my-site`/`pigasus-group`. The motion vocabulary was sourced from there + Aceternity/Magic UI (Timeline,
  grid/dot, PointerHighlight, NumberTicker).
- **All stats build-time-derived** — never hardcode a forecast number into copy.
- Process that worked: brainstorming → writing-plans → subagent-driven-development → final review; visual
  verification through the Claude preview (heads-up: the embedded preview occasionally drifts to
  `/right-wrong-ray` mid-capture — navigate explicitly).
- Memories: `davessweater-apple-real-data`, `davessweater-promotion-readiness`,
  `davessweater-thesis-direction`, `rays-capture-deflation`.

## Pointers

- `CHECKLIST.md` — authoritative outstanding work.
- `planning/specs|plans|handoffs/`.
- PR: [#70](https://github.com/davidhluther/davessweater/pull/70) (M3, merged).
