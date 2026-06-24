# Promotion-Readiness Audit — Handoff

> Self-contained brief for a fresh session. Zero prior context assumed. The site is being prepared for **promotion**, which invites **adversarial scrutiny** because it publicly grades a named competitor (Ray's Weather). The job now is to harden everything inherited from the early-dev "v1" before that spotlight lands.

## 1. Where things stand (all merged + live on `main`)

| Milestone | Status |
|---|---|
| M1 — Next.js port | ✅ live |
| M2 — redesign + accuracy homepage | ✅ live |
| Source Expansion — N-source adapters + coupled snow-aware scoring | ✅ code live; the 7 new forecasters started scoring **2026-06-23** (1 day so far, accruing) |
| Open-Meteo backfill (PR #62) | ✅ merged — 474-day Open-Meteo record |
| **Ray fair scoring (PR #67)** | ✅ **merged + live** — 3 capture/scoring bugs fixed, **interval wind scoring (k=0.5 width penalty)**, era backfilled + re-scored. Ray ≈ 65.2 (fair), Open-Meteo unchanged 91.65, free wins by ~26.5. See `planning/plans/2026-06-24-rays-capture-interval-scoring.md` + memory [[rays-capture-deflation]]. |
| **M3 — interactive data-viz (PR #68)** | ✅ **merged + live** — visx trend chart + sortable tables/sparklines + coverage matrix, rendering the fair data. Plan: `planning/plans/2026-06-23-m3-data-viz.md`. |

**Net:** the central claim is now fair and defensible *by design*, and the data-viz is shipped. The remaining work is the promotion audit + the follow-ups it will formalize.

## 2. The audit — framing

A site that grades a named competitor and then gets promoted is the worst-case audience (Ray's fans, Ray's itself, journalists). The **shiny front end isn't the exposure; the inherited v1 data pipeline is.** The Ray-capture regression — a *silent* failure that quietly made the central claim less defensible and went unnoticed for weeks — is the exemplar of what this audit must surface.

**Priority order (do 1–4 now; 5–6 later):**
1. **Data integrity & silent-failure monitoring** (highest stakes)
2. **Source-labeling honesty**
3. **Claim defensibility + legal / trademark / disclaimer**
4. **Scoring-methodology robustness**
5. SEO / performance — *(deferred)*
6. Accessibility beyond M3 — *(deferred)*

**Output:** a **prioritized risk register** (severity × dimension) folded into `CHECKLIST.md` as a triable backlog — not a vague worry.

## 3. Seed issues already known (start the register here, then discover more)

**Dim 1 — data integrity & monitoring:**
- **No capture-quality monitoring exists.** The Ray precip/wind regression ran for weeks unnoticed. Need an alert when any source's per-field coverage drops (compare daily `scores.json.coverage` deltas). *This is the single most important preventive fix.*
- Are the **7 new forecasters / Open-Meteo / the Apple-fallback** *also* silently degrading? Audit each source's capture reliability + the daily Actions for silent failures (e.g. a scrape that returns `error=None` but empty data).
- The daily bot commits to `main`; **re-scores race the bot** — `scores.json` regenerates `entries`/`totals`/`coverage` from comparison files each run (fixed in PR #67, guarded by `tests/test_scores_consistency.py`), but watch for new drift.

**Dim 2 — source-labeling honesty:**
- **The live M2 homepage still presents the Open-Meteo *fallback* as "Apple Weather."** M3's viz correctly omits it, but the M2 hero scoreboard + the "free forecast averaged 91.8" copy use `apple_weather`, whose 106 scored days are 100% the Open-Meteo fallback (only 2 real iPhone-Shortcut files exist, none scored). Targets: `src/lib/homeStats.ts` (`LABELS`/`IS_FREE`/`bestFree`), `src/components/Scoreboard.tsx`, `src/components/IphoneShot.tsx`. The proper fix is the **real-Apple Shortcut automation** (`upload_screenshot.yml` + a reliable source sidecar so the `REAL_APPLE_MIN_BYTES=500000` heuristic can be dropped); interim, relabel honestly or drop the Apple slot from the M2 hero too.

**Dim 3 — claim defensibility + legal:**
- **The site's stated methodology is stale/incomplete.** `CLAUDE.md` lines ~59–68 still describe `compare.py:score_prediction()` (it's `scripts/scoring.py` now) with "10 binary + 10 amount" precip and no mention of the **interval wind scoring / width penalty / NWS qualitative mapping / snow-aware model**. Update `CLAUDE.md` AND publish a clear methodology on `/right-wrong-ray` — *visible methodology is the defensibility*. The plan flagged this as the Ray-fix's Phase 6.
- Trademark/parody cushioning ("Dave's Sweater" ↔ "Ray's Weather"), the "not affiliated…" disclaimer, and the rights to use Ray's name/scraped data/screenshots — a once-over for trade-libel exposure now that sharp claims about a named business will be promoted.
- Every public stat must be data-derived + reproducible (no hardcoded/stale claims — the M2 review already caught one "dead last 29×" error).

**Dim 4 — scoring-methodology robustness:**
- **Snow handling is unproven on winter data** — the season re-scored on mostly summer data; OWM/Google snow is a mm→in/liquid-equiv proxy. Revisit before winter / before surfacing snow columns.
- Interval-scoring edge cases (the `k=0.5` knob, gust exclusion, two-range "becoming" days, qualitative NWS mapping) — stress-test fairness; confirm reproducibility.

## 4. Recommended approach

Run the audit as a **multi-agent Workflow** (ultracode-appropriate): parallel auditors, one per dimension (1–4), each grounded in the live code/data, returning concrete findings → a synthesizer produces the prioritized risk register → fold into `CHECKLIST.md`. Then triage and execute fixes (the capture-monitoring + methodology-doc are the likely top two). Use adversarial verification on any fix that touches scoring or public numbers (as PR #67 did — the final review caught a real blocker there).

## 5. Deferred build items to carry forward (already in CHECKLIST)

- **Methodology transparency on the site** (Dim 3 above) + refresh the stale `CLAUDE.md` scoring section.
- **Capture-quality monitoring** (Dim 1 above).
- **Live homepage Apple relabel** (Dim 2 above) / the real-Apple Shortcut automation.
- **N-source viz** — M3 v1 is Open-Meteo vs Ray's; widen `SrcKey` (`src/lib/types.ts` + `src/lib/homeStats.ts` maps) + surface the 7 new forecasters once they have enough scored days (they started 2026-06-23).
- **Ambitious M3 motion pass** (scrollytelling / motion lib) — v1 shipped minimal motion.
- Recalibrate the 5-sweater scale for Boone; rewrite `README.md` (still describes the retired GitHub-Pages/`build_site.py` setup); Fourthwall Storefront 403; the Ecowitt weather-station roadmap (M6).

## 6. Constraints & context (don't relearn the hard way)

- **Defensibility is paramount** — the satire only works if the data is real and the methodology is visible/fair. See memories [[davessweater-thesis-direction]], [[davessweater-promotion-readiness]].
- **Two layers:** Python **stdlib-only** pipeline (`scripts/`, daily GitHub Actions → commits `data/` to `main`) + **Next.js 16** site (`src/`, reads committed JSON at build time; Vercel rebuilds on every push to `main`). CI uses **Python 3.12** (local default may be 3.9 — run `python3.12`).
- **NOT a Ray's clone** (legal): share only the teal/orange palette + the local-weather genre.
- **Mobile-first** is the likeliest traffic.
- `CHECKLIST.md` (repo root) is the durable source of truth — read it first, keep it current.
- Process that's worked: superpowers brainstorming → writing-plans → subagent-driven-development; phase-by-phase Workflows with per-task spec+quality review + a final adversarial review before merging anything public.

## 7. Pointers

- `CHECKLIST.md` — outstanding work (authoritative).
- Plans/specs/handoffs: `planning/plans/`, `planning/specs/`, `planning/handoffs/`.
- Memories: `davessweater-thesis-direction`, `davessweater-promotion-readiness`, `rays-capture-deflation`.
- `CLAUDE.md` — premise, voice, architecture (note: its scoring table is stale — fix as part of Dim 3).
