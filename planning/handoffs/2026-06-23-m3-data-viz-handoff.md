# Milestone 3 (Dynamic Data-Viz) — Handoff

> Self-contained brief for a fresh session. You have zero prior context; everything you need to start M3 confidently is here. Real file paths are absolute. Verify against code, not docs, where flagged.

---

## 1. Context & status

**Project one-liner.** Dave's Sweater is a satirical-but-real local weather site for Boone / Deep Gap, NC — a phonetic play on "Ray's Weather" — whose signature feature is a **"Right Ray / Wrong Ray" accuracy tracker** that scores forecasts (free Open-Meteo/Apple vs. paid Ray's) against actuals on a 100-point scale. It's a Next.js 16 App Router site (React 19, Tailwind v4) that reads committed JSON at build time; a separate stdlib-only Python pipeline produces that JSON on a daily CI commit. **M3 is `src/`-only — the Python pipeline is untouched.**

**Where things stand:**

| Track | Status |
|---|---|
| **M1 — Next.js port** | ✅ Done, live. |
| **M2 — redesign + accuracy homepage** | ✅ Built & verified; merged to main and live. New visual identity (dark-teal/orange data-journalism), mobile-first, the accuracy homepage + `/right-wrong-ray`. |
| **Source Expansion** (sibling pipeline milestone) | ✅ Spec + plan exist and the milestone is considered landed for planning purposes — BUT see the **critical data caveat** below: its expanded roster has NOT yet reached the branch you'll most likely build on. |
| **Open-Meteo backfill** | ⚠️ **PR #62 — currently OPEN, NOT merged.** Branch `feat/openmeteo-backfill` → base `main`. The owner is deciding **merge now vs. bundle it into M3's deploy.** |

**PR #62 is the foundation M3 builds on.** Do not redo its work. It contains three commits:
- **Open-Meteo backfill** (`scripts/backfill_openmeteo.py`): Open-Meteo now has a **474-day record (avg 91.6, 465–1–8, graded "Wrong" exactly once)** from the Historical Forecast API. Full clean chronological re-score; pytest green.
- **Tracking-period hero**: because the backfill makes Open-Meteo's *total* span pre-tracking dates, the hero derives a **tracking-period view** (dates where Ray's actually competes, ~109 days) for the head-to-head, and presents Open-Meteo's full 474-day record in a separate explainer line. "Never once graded Wrong" is now data-driven (`trackingFreeNeverWrong`), not hardcoded.
- **Scoped trend chart**: `trendSeries` now scopes to the rays-present window so the chart is a true free-vs-Ray's comparison instead of stranding Ray's line in the recent third.

**First action for the new session:** decide with the owner whether to branch M3 off `main` (then have PR #62 either merged-first or rebased under you) or to branch M3 directly off `feat/openmeteo-backfill`. Because M3 consumes the tracking-period hero, the 474-day record, and the rays-scoped trend window that live **only in PR #62**, branching off `feat/openmeteo-backfill` (or merging #62 to main first) is the path of least resistance. Confirm the owner's merge-vs-bundle decision before you branch.

```bash
gh pr view 62 --json state,headRefName,baseRefName   # confirm still OPEN before branching
git checkout feat/openmeteo-backfill && git pull
git checkout -b feat/m3-dataviz   # (or off main once #62 merges)
```

---

## 2. M3 goal & scope

**Goal:** turn the now-richer accuracy data into **interactive data-viz** — visual excellence that is itself part of the satirical proof (see §3). Ambitious and iterative.

**Locked design decisions (do not relitigate):**
- **Direction "B + visx"** is chosen. **visx** is the charting library.
- A **heat map was explicitly DECLINED.**
- Owner wants the **ambitious / iterative treatment** (memory note: "M3 iterative data-viz (#2 now → #3 later), heatmap declined").
- M3 **inherits the M2 visual identity verbatim** (palette / fonts / tokens — see §6).

**Concrete deliverables:**

1. **Interactive trend chart (visx).** Replaces the static inline-SVG dual-polyline in `src/components/TrendChart.tsx`. Needs hover tooltips, axes, gridlines, and (eventually) multi-source lines. Must be a `'use client'` island. **Preserve PR #62's rays-scoped window** — do not naively plot all 476 entries (see §4 gotcha 4).
2. **Sortable tables with inline sparklines.** Upgrade target = the two scoreboard tables currently inlined in `src/app/right-wrong-ray/page.tsx` (the latest-day comparison table + the Season Scoreboard table). Add column sorting + per-source inline sparklines (per-day scores from `scores.json` `entries`). Must stay mobile-safe (table→stacked-card reflow below `md`).
3. **Coverage matrix.** Render the per-source "what they report vs. withhold" index — a source × field grid of ✓/✗ (or provided/days counts). This is where "the paid service won't even commit to a snow total" is shown loudly. Currently **untyped and unrendered** (see §4).
4. **Tasteful motion.** Owner wants the iterative/ambitious treatment. Note: no animation lib is installed; framer-motion is **absent**. If you want animated chart transitions, that's a separate dependency decision (`react-spring` / `@visx/react-spring`) — flag it, don't assume it. Not required for a static-first line chart.

**Test discipline:** pure lib functions are TDD'd with **vitest**; components are verified by **build + lint + visual only**. **No component-test framework is installed and the repo wants it kept that way** — do NOT add jsdom/RTL.

---

## 3. Why craft is load-bearing (the constraint that shapes everything)

**The satire is a business-model thesis, not just a joke.** Free services keep pace with / beat the paid one — **proven with tracked data, not assertion.** Source Expansion deepens this into a critique: *paid services gate or omit low-cost detail* (AccuWeather retired its free tier; **Ray's never publishes a numeric precip amount** — its `precip_amount` coverage is a legitimate `0/109`, by design, not a bug). The coverage matrix makes that omission visible; the scoring model penalizes omission via forfeiture (no number ⇒ 0 for that category, never renormalized away — "a source can't climb the board by telling you less").

**Therefore visual excellence is part of the proof.** The craft must be **defensible and accurate**, not just flashy. Throughline: *"He makes big promises and hopes nobody ever checks the numbers. Now somebody is."* Voice = dry, wry, factual — **sharp, not sour.**

**Honesty traps that are load-bearing for credibility — get these right in every label/tooltip:**
- **Grade bands ≠ rankings.** `totals.{right,wrong,meh}` are absolute grade-band day-counts (a day scored < 60 = "Wrong"), **NOT** a per-day ranking. M2's code review caught and corrected a false *"dead last 29×"* claim; the honest copy is *"the free services were never once graded Wrong; Ray's earned that grade N times."* Never label a viz "dead last N times" off `totals.wrong`.
- **Two grade-threshold tables exist in the repo and disagree.** `CLAUDE.md` documents OLD bands (90/75/60/40). The Source Expansion spec states Right ≥75 / Meh 60–74 / Wrong <60. **Use whatever the current `scripts/scoring.py` actually emits, not `CLAUDE.md`'s stale table.** Verify legends against code.
- **Honest screenshot source label.** The hero iPhone shot must distinguish real Apple Weather from the Open-Meteo-rendered fallback (interim signal = a file-size heuristic, `REAL_APPLE_MIN_BYTES = 500000` in `src/lib/screenshot.ts`). Keep the honest source + date labels.

**Hard constraints:**
- **NOT a Ray's clone** (legal safety). Share ONLY the teal/orange palette + the local-weather genre; original brand otherwise.
- **Mobile-first is the likeliest traffic** (shared/social links). Design ~360–390px first; no horizontal scroll anywhere; tap targets ≥44px; wide tables reflow to stacked cards below `md`. Charts must be responsive and legible on phones.
- **Stats stay build-time-derived, never hardcoded** — copy uses evergreen phrasings bound to computed values so the daily CI commit keeps them correct.
- **`src/`-only.** No changes to `scripts/*.py`, `data/` formats, or `.github/workflows` (also: the workflows dir is hook-blocked for the Write tool).

---

## 4. Data layer map

All stats derive at **build time** from committed JSON via async Server Components → pure lib helpers. The fs reads are **server-only** and cannot move into client code.

**Files:**
- `/Users/davidluther/Projects/DavesSweater/data/scores.json` — season totals + per-day entries + coverage. **Coverage-matrix and sparkline data source.**
- `/Users/davidluther/Projects/DavesSweater/data/comparisons/<date>.json` — latest-day per-source `{prediction, score}`; the newest file backs the latest-day comparison table.
- `/Users/davidluther/Projects/DavesSweater/src/lib/data.ts` — `getScores()`, `getLatestComparison()` (node:fs reads, server-only).
- `/Users/davidluther/Projects/DavesSweater/src/lib/homeStats.ts` — `TrendPoint = {date; free; rays}`, `trendSeries()` (rays-scoped), `trendChartGeometry()` (the hand-rolled SVG projection visx replaces), `SrcKey`/`ORDER`/`LABELS`/`IS_FREE` maps, `SourceStat`, `HeroStats`, tracking-period stats, `headToHead()`, `actualLines()`.
- `/Users/davidluther/Projects/DavesSweater/src/lib/scoreboard.ts` — `ScoreboardRow = {label; record; avg; days}`, `scoreboardRows()` feeding the Season Scoreboard table.
- `/Users/davidluther/Projects/DavesSweater/src/lib/types.ts` — `Scores`, `SourceTotals`, `Comparison` types.

**Viz-relevant data available right now (verified against the `feat/openmeteo-backfill` branch):**
- **Per-day per-source scores** — `scores.json.entries` (476 entries; entry shape `{date, openmeteo, raysweather?, apple_weather?, sweater_weather}`). **109 entries carry `raysweather`** (the tracking window). These per-day numbers are the raw material for inline sparklines and the trend chart.
- **Predicted / actual / error differentials** — each `data/comparisons/<date>.json` has `{date, generated_at, actuals, sweater_weather, sources, rays_current}`; `sources[key] = {prediction, score}`. This backs head-to-head differentials.
- **Coverage index** — `scores.json.coverage[source][field] = {provided, days}`. Currently present for `openmeteo / raysweather / apple_weather` × `high_temp / low_temp / wind / precip_type / precip_amount`. Example: `raysweather.wind = {provided:76, days:109}`, `raysweather.precip_amount = {provided:0, days:109}` (Ray's never publishes numeric precip — show this loudly, don't "fix" it).

**Gotchas (verified, several correct the original survey):**

1. **⚠️ DATA-vs-PLAN MISMATCH — verify before building N-source viz.** On `feat/openmeteo-backfill` (PR #62), `scores.json` `totals` and `coverage` still carry **only the 3 original sources**, and coverage uses a **single `precip_amount` field** — NOT the expanded ~10-source roster (nws, metno, openweathermap, weatherapi, visualcrossing, tomorrowio, googleweather) nor the split `precip_amount_rain` / `precip_amount_snow` fields that the Source Expansion spec describes. **The spec'd N-source + split-precip data has not landed in this branch's `data/`.** Before building the multi-source trend chart or a rain/snow coverage matrix, **confirm which `data/` actually ships** (check `git log --oneline main -- data/scores.json` and re-inspect `scores.json` keys). If Source Expansion's data isn't on your base branch, M3 either (a) ships the 3-source version first and widens later, or (b) coordinates the Source Expansion data merge first. **Do not assume the 10-source/snow data exists.**

2. **Source-key union is hardcoded to 3.** `src/lib/types.ts` line 38 (`Comparison.sources`) and line ~44 (`Scores.totals`) both use `Partial<Record<"openmeteo" | "raysweather" | "apple_weather", …>>`. Same in `src/lib/homeStats.ts`: `SrcKey` (line 3), `ORDER` (line 4), `LABELS` (line 5), `IS_FREE` (line 8). **Any N-source viz must widen this union (+ the maps) before it type-checks.** Tie this to the data check in gotcha 1 — don't widen types ahead of the data.

3. **`coverage` is in `scores.json` but ABSENT from the `Scores` type.** Add it before building the matrix or TS won't see it. Shape: `Record<source, Record<field, {provided:number; days:number}>>`.

4. **Trend window is intentionally scoped.** PR #62's `trendSeries()` (`src/lib/homeStats.ts` ~L112–120) filters to dates where Ray's has a score (~109 days) with an explicit comment explaining that plotting all 474 days would strand Ray's line and read like his data "cuts off." **Preserve this scoping in the visx chart.**

5. **`Scores.entries` is loosely typed** as `Array<Record<string, unknown>>`; entries omit a source key entirely when absent (early entries have only `openmeteo`). Sparkline code must null-check/narrow each `entry[sourceKey]` to number.

6. **Ray's `precip_amount` = `0/109` is legitimate** (documented design choice). The coverage matrix should show it as a real gap, loudly — not a bug.

---

## 5. Component / page map (what exists now → what M3 does to it)

Almost everything M3 touches is **server-rendered**. Only four components are client islands (`'use client'`). Any visx interactivity must be a **new `'use client'` leaf component** that receives already-shaped data as props from the Server Component — mirror the `LiveConditions` pattern. **Do not move the fs reads into client code.**

| What exists now | File | M3 action |
|---|---|---|
| `TrendChart` — SERVER, static `<svg viewBox="0 0 600 120">` dual `<polyline>` (rays dashed orange, free solid green), no axes/ticks/tooltips. Props `{ points: TrendPoint[] }`. | `/Users/davidluther/Projects/DavesSweater/src/components/TrendChart.tsx` | **Replace** with a `'use client'` visx chart (tooltips/axes/grid). Keep the prop boundary: server computes `points`, passes into the client chart. |
| Homepage — SERVER async; `await Promise.all([getScores(), getLatestComparison()])`, then `heroStats()/trendSeries()/headToHead()`. Mounts `<TrendChart points={trend} />` at **~line 24** inside a dark `SectionBand`. | `/Users/davidluther/Projects/DavesSweater/src/app/page.tsx` | Swap in the new client chart; drop new viz blocks into existing `SectionBand`s. |
| `/right-wrong-ray` — SERVER async. **TWO inline scoreboard tables**, each a duplicated desktop-`<table>`/mobile-card pair: (1) latest-day comparison (~L49–101: Source/Predicted/Score/Verdict), (2) Season Scoreboard (~L114–148: Source/Record/Avg/Days from `scoreboardRows()`). | `/Users/davidluther/Projects/DavesSweater/src/app/right-wrong-ray/page.tsx` | **Extract** both tables into a `'use client'` sortable table component; add inline sparklines. Reproduce/unify both responsive variants. |
| `Scoreboard` — SERVER, 3-col grid of hero stat **cards** (not a table). Props `{ sources: SourceStat[] }`. Used in `Hero`. | `/Users/davidluther/Projects/DavesSweater/src/components/Scoreboard.tsx` | Likely left as-is (or lightly refreshed); it's the hero summary tiles, not a table target. |
| `Hero` — SERVER wrapper (BrandMark + IphoneShot + Scoreboard + CTAs). | `/Users/davidluther/Projects/DavesSweater/src/components/Hero.tsx` | Unchanged unless surfacing new stats. |
| `HeadToHeadCard` — SERVER, 3-card Dave/Ray's/actual block on homepage. | `/Users/davidluther/Projects/DavesSweater/src/components/HeadToHeadCard.tsx` | Optional viz upgrade. |
| `LiveConditions` — **CLIENT**, canonical island: server seeds `initial*` props, `useEffect` fetches Open-Meteo, setState hydrates, `.catch(()=>{})` keeps SSR values. | `/Users/davidluther/Projects/DavesSweater/src/components/LiveConditions.tsx` | **Reference pattern** for introducing visx interactivity. |
| `Outlook` — CLIENT, 5-col mini grid; closest thing to an existing viz; uses `font-display`, `text-teal`, `bg-surface` tokens. | `/Users/davidluther/Projects/DavesSweater/src/components/Outlook.tsx` | Token reference. |
| `SectionBand` — SERVER layout primitive (`tone="light"|"dark"|"surface"`, `max-w-3xl`). Every section is wrapped in it. | `/Users/davidluther/Projects/DavesSweater/src/components/SectionBand.tsx` | M3 viz blocks drop into existing `SectionBand`s. |
| `RayFaces` — SERVER, renders N verdict ray icons in the comparison table. | `/Users/davidluther/Projects/DavesSweater/src/components/RayFaces.tsx` | Reuse in the extracted comparison table. |
| `ui/button.tsx`, `ui/dialog.tsx` — existing `'use client'` shadcn-style primitives. | `/Users/davidluther/Projects/DavesSweater/src/components/ui/` | Available for sort buttons / modals. |
| **Coverage matrix** | — | **No display exists today.** Build new; back it with `scores.json.coverage`. |

---

## 6. Stack & setup deltas

**Stack (confirmed installed):** Next.js **16.2.2**, React **19.2.4**, Tailwind **v4.3.1** (CSS-first, **no `tailwind.config.js`** — theme lives in the `@theme inline` block in `globals.css`), vitest ^3, ESLint 9, TypeScript ^5. Existing deps include `clsx`, `tailwind-merge` (→ `cn()` at `src/lib/utils.ts`), `lucide-react`, shadcn primitives.

**visx is NOT installed** (grep-confirmed: no visx / d3 / recharts / victory / nivo / framer-motion / react-spring). This is the first new runtime dependency since the Next.js port — M2's bar was "lightweight chart, no CLS," so verify it stays mobile-light.

**Add exactly these `@visx/*` packages** (visx ships its own d3 sub-deps transitively — no separate d3 install):
```bash
npm install @visx/responsive @visx/scale @visx/shape @visx/axis \
  @visx/grid @visx/tooltip @visx/group @visx/event
# optional: @visx/curve @visx/text @visx/gradient
# motion (only if you commit to animated transitions): @visx/react-spring  (NOT required)
```
- `@visx/responsive` (`ParentSize`/`useParentSize`) — required for SSR-safe responsive width.
- `@visx/scale` (`scaleTime`/`scaleLinear`), `@visx/shape` (`LinePath`, `Bar` for hit areas), `@visx/axis` (`AxisBottom`/`AxisLeft`), `@visx/grid` (`GridRows`/`GridColumns`), `@visx/tooltip` (`useTooltip`, `TooltipWithBounds`), `@visx/group` (`Group` margin transforms), `@visx/event` (`localPoint` for pointer→data).
- Forgetting one of `@visx/responsive`, `@visx/event`, `@visx/group` is the usual cause of a half-working chart — install the full set.

**Compatibility rules (Next 16 / React 19 / Tailwind 4):**
- **Every chart MUST be `'use client'`.** visx uses refs, pointer events, useState, DOM measurement — none work in a Server Component (the default in `app/`). Mirror `LiveConditions`: server passes committed-JSON datapoints as props; client island renders visx (and may optionally refresh from Open-Meteo).
- **SSR-safe sizing is the #1 trap.** Never read `window`/`getBoundingClientRect` during render. Use `ParentSize` (width = 0 on server, real width after mount). Give the wrapping div an **explicit height** (e.g. `h-[320px]`) — `ParentSize` only supplies width reliably; a 0-height SSR collapse otherwise.
- **visx is React-19 compatible** (function components, standard hooks). No app-router-specific config beyond the `'use client'` marker.

**Design tokens / fonts to reuse** (`/Users/davidluther/Projects/DavesSweater/src/app/globals.css` `:root` + `@theme inline`; fonts in `src/app/layout.tsx`):
- Palette: `--teal #3c5468` (anchor), `--teal-700 #33485a`, `--teal-900 #26323d`, `--teal-50 #eef3f6`, `--orange #f97316` (CTA / **Ray's flag**), `--orange-600 #c2410c` (on-light), `--green #1d9e75` (**free / winning**), `--bg #ffffff`, `--surface #f5f7f9`, `--text #26323d`, `--muted #5f6b75`, `--border #e3e8ec`, `--radius 0.75rem`.
- **Semantic convention: free sources = green, Ray's/paid = orange.**
- Fonts: **Space Grotesk** display (`font-display`, **weights 500 & 700 ONLY** — axis labels must not request other weights or they silently fall back) + **Inter** body (`font-sans`).
- **visx color props are JS strings, not classNames.** Tailwind utilities (`stroke-orange`, `fill-teal`) only style SVG elements you author directly (axis `<text>`, gridlines). For visx-computed elements pass `var(--orange)` / `var(--teal)` or the hex. Add new chart tokens as `--color-*` vars in `globals.css` if needed (no JS config exists).

---

## 7. Recommended approach

Use the established superpowers workflow, in order:

1. **`superpowers:brainstorming`** — required before creative work. Explore the M3 viz intent/IA (which charts, what each tooltip says, how the coverage matrix reads on a phone) given the locked "B + visx", heatmap-declined, ambitious/iterative decisions.
2. **`superpowers:writing-plans`** — turn the brainstorm + a design spec into a task-by-task plan.
3. **`superpowers:subagent-driven-development`** (or `superpowers:executing-plans`) — the established execution skill; this is what the existing plans reference in their "For agentic workers" blockquote.

**Write the artifacts to match the existing convention** (verified against `planning/`):
- **Spec:** `planning/specs/YYYY-MM-DD-<slug>-design.md` (e.g. `planning/specs/2026-06-23-m3-data-viz-design.md`). Header: `# <Title> (Design Spec)` then `**Date:**`, `**Status:**` (e.g. "Approved design, pre-plan"), `**Milestone:**`. Sections: Goal, Scope (In/Out), Design direction, Design system, Information architecture, [domain sections], Risks & mitigations (table), Acceptance criteria (numbered), Spec location note.
- **Plan:** `planning/plans/YYYY-MM-DD-<slug>.md` (same `<slug>`, creation date). Header: `# <Title> Implementation Plan`, then a `> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development …` blockquote, then `**Goal:**`, `**Architecture:**`, `**Tech Stack:**`, `**Reference spec:**`, `**Standing rule(s):**`. Body: **File structure** (Create/Modify/Delete) → numbered **Phases** → numbered **Tasks** (each with a `**Files:**` line) → `- [ ]` **Step** checkboxes with explicit verify commands + a per-task git commit (conventional-commit, e.g. `feat(m3): …`). End with **Notes for the executor**.
- **NOT in `docs/`** — that was the old GitHub-Pages output dir and would leak into the deployed site / get caught by the daily `git add`.

**Verify commands the plan should bake in:** `npm test` (vitest, for any new pure lib helpers), `npm run lint`, `next build` (must be green; watch for CLS / SSR sizing). Visual check on mobile (~360–390px) + desktop.

---

## 8. Deferred / parallel items

**Fold into M3 (blocking for N-source viz — but gated on the data landing; see §4 gotcha 1):**
1. **Widen the source-key type** in `src/lib/types.ts` (lines 38, ~44) and the `SrcKey`/`ORDER`/`LABELS`/`IS_FREE` maps in `src/lib/homeStats.ts` from the current 3 to the full roster — **only once the expanded `data/` actually ships.**
2. **Surface all sources on the site.** The current homepage/scoreboard shows only the 3 original sources. M3 surfaces the broader roster + coverage index (scoreboard, trend chart, coverage matrix) — again, gated on the data.
3. **Add `coverage` to the `Scores` type** before building the matrix.

**Keep tracked / coordinate (not M3-blocking):**
4. **OWM/Google snow-depth fix for winter.** Source Expansion notes OWM snow is a mm→in "depth proxy"; the snow-aware path is unproven on winter data (season re-scored on mostly summer data). Relevant if M3 surfaces snow coverage/columns before real winter data exists.
5. **Manual iPhone Apple-Weather Shortcut automation** (post-M2, owner-owned, separate pipeline task). M3 keeps the honest source label + the `REAL_APPLE_MIN_BYTES = 500000` heuristic in `src/lib/screenshot.ts`; automating the Shortcut + adding a reliable source sidecar (so the heuristic can be dropped) is **out of M3 scope.**
6. **Adjacent standing items** (not M3-blocking): recalibrate the 5-sweater scale for Boone's climate (54°F scored too low); make scoring methodology visible/defensible on the site; copy/sweater-terminology polish; rewrite `README.md` (still describes the old GitHub-Pages / `build_site.py` setup); Fourthwall Storefront API 403 (shop on Merchant Center RSS fallback).

**Coordination note:** `CHECKLIST.md` is edited by multiple in-flight branches — keep it current in the same change that completes a task, and expect to reconcile at merge.
