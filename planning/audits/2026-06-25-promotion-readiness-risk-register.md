# Promotion-Readiness Risk Register — 2026-06-25

> Output of the multi-agent promotion-readiness audit (the CHECKLIST "Active next session" item).
> Self-contained. The site is being prepped for **promotion**, which invites **adversarial scrutiny**
> because it publicly grades a named competitor (Ray's Weather). This register is the triable backlog;
> the headline items also feed `CHECKLIST.md`.

## How this was produced

Ran as a deterministic multi-agent Workflow (run `wf_110d67e9-6ca`, 28 agents):

1. **4 parallel dimension auditors**, each grounded in the live `main` code + data, read-only:
   (1) data integrity & silent-failure monitoring, (2) source-labeling honesty,
   (3) claim defensibility + legal, (4) scoring-methodology robustness.
2. **Adversarial verification** — every finding touching public numbers or scoring got an independent
   skeptic that re-checked the evidence against the code/data and tried to *refute* it. Plus a
   completeness critic hunting cross-dimension gaps.
3. **Synthesis** — drop/downgrade refuted findings, dedup across dimensions, prioritize by promotion exposure.

**24 findings → 22 verified + 2 critic additions → 12-entry register.** No finding survived that a verifier
refuted; severities below reflect the verifiers' adjustments (e.g. the "ghost rows" harm claim was refuted
and downgraded — see Appendix).

## Executive summary

The shiny front end isn't the exposure — the inherited v1 data pipeline and the labels on top of it are.
Three things are genuinely promotion-blocking and should be fixed before any push to promote:

- **"Apple Weather" is a fabricated source.** 107 of 108 "Apple" days are not Apple — 106 are the
  Open-Meteo fallback and 1 is null-source; only **2026-03-06** is real Apple data. It's published as a
  distinct free contender (📱 label) on `/right-wrong-ray`, drives the homepage "free · 91.9" headline
  chip (Open-Meteo's data, winning a 0.1-pt tiebreak), and sits beside a *real* 2.2 MB Apple screenshot —
  so it reads as deliberate. Any reader who diffs the Apple and Open-Meteo columns finds them identical.
- **The headline gap is partly manufactured.** Ray is structurally capped at **90/100** every day because
  the precip-amount forfeit is summed as 0 against a fixed 100-point denominator. Normalizing to his
  available max lifts Ray 65.3 → ~72.7 and shrinks the promoted Open-Meteo−Ray gap **26.3 → ~19.0** —
  ~28% of the headline "free wins by ~26.5" is the un-normalized forfeit, not forecast skill.
- **The methodology is invisible and the referee shares a jersey with the winner.** The only on-site
  methodology is a 2-line caption that contradicts the table right above it ("four fields" vs the five it
  renders), and "actuals" are the Open-Meteo archive — Open-Meteo's forecast is graded against Open-Meteo's
  own data, disclosed nowhere. "You graded us 65 and won't show your work" is the most damaging line Ray's
  could write, and today it's true.

The good news: the **data integrity is otherwise clean** (the headline numbers reproduce exactly from
committed data; the rebuild-from-comparisons invariant holds; the disclaimer is present and global), the
7 new sources are correctly excluded from the *scored* headline numbers, and the worst items are mostly
small fixes.

## Impact on the deferred "ship Apple branch" decision

**The audit overturns "ship `feat/apple-real-data` as-is."** That branch backfills 26 real Apple days but
**keeps the Open-Meteo fallback scored as "Apple" on the other 83 days with no caveat** — i.e. it ships the
exact configuration this register rates **critical / promotion-blocking** (R1). Recommended path:

1. Do **R1** first — gate or honestly relabel the Apple slot (and exclude it from `bestFree`) so the
   fallback is never presented as Apple.
2. *Then* the Apple-real-data backfill can land on top of an honest labeling scheme: real Apple shown only
   on days real Apple data exists; fallback days clearly marked (or Apple gated like the 7 new sources).

Shipping the branch before R1 would publish the critical finding, not fix it.

## Risk register (prioritized)

Severity weighted by promotion exposure: silent data failures + false/misleading public claims rank highest.
Recommended fix order: **R1 → R6 → R2 → R4 → R5 → R3 → R7 → R8 → R9 → R11 → R12** (R10 = counsel, parallel).

| ID | Sev | Dim | Eff | Issue |
|----|-----|-----|-----|-------|
| **R1** | 🔴 Critical | 2 + 3 | M | "Apple Weather" is the Open-Meteo fallback on every public surface (107/108 days non-Apple) |
| **R2** | 🔴 Critical | 4 | M | Ray capped at 90/100 by the precip-amount forfeit → headline gap inflated ~28% (~7 pts) |
| **R6** | 🟠 High | 1 + 2 | S | 7 "gated" new sources are actually rendered publicly on `/right-wrong-ray` (UpcomingForecasts has no allowlist) |
| **R4** | 🟠 High | 3 | M | On-site methodology is invisible + the caption ("four fields") contradicts the five-field table above it |
| **R5** | 🟠 High | 4 + 2 | L | Open-Meteo graded against its own archive (actuals provenance), disclosed nowhere |
| **R3** | 🟠 High | 1 | M | No capture-quality / coverage-drop monitoring anywhere (the Ray-regression class) |
| **R7** | 🟡 Medium | 1 | M | Silent missing-actuals path dropped 2026-05-22 from the record (green workflow); + 2 ghost empty rows |
| **R8** | 🟡 Medium | 3 | S | `CLAUDE.md` scoring section documents a different, simpler model than the code runs |
| **R9** | 🟡 Medium | 1 | M | Concurrent compare runs + `-X ours` merge footgun (benign today, latent) |
| **R11** | 🟡 Medium | 4 + 1 | M | OWM/Met.no day-0 low is the partial-bucket min, not the calendar-day low (gated now; blocks un-gating) |
| **R12** | 🟡 Medium | 4 | M | Snow-depth scoring path has never graded a single real day; unproven before winter |
| **R10** | 🟡 Medium | 3 | M | Trademark / scrape-republish exposure → counsel review (not engineering) |

Low-severity / no-launch-action items in the Appendix.

---

## Detailed findings

### 🔴 R1 — "Apple Weather" is the Open-Meteo fallback on every public surface
**Dim 2 + 3 · effort M · verified: confirmed (multiple verifiers, severity critical)**

> **OWNER DECISION (2026-06-26): ACCEPTED RISK — won't fix.** Owner keeps the fallback-as-Apple labeling
> (no gate, no relabel, no `bestFree` change): doesn't expect scrutiny on it, and real historical Apple data
> is impractical for a critic to reconstruct. Recorded for defensibility provenance; the `feat/apple-real-data`
> branch (26 real days) may still ship. Residual (optional): the headline free source can flip
> Apple↔Open-Meteo on a 0.1-pt tiebreak.

What's true now:
- Across all 478 comparison files, of 108 Apple-scored days **106 are byte-identical to Open-Meteo**; only
  2026-03-05 (null source) and 2026-03-06 differ. **Exactly one true Apple day** exists (2026-03-06,
  source `"Apple Weather (iPhone Shortcut)"`). `compare.py:359-376` prefers `iphone_forecast_apple.json`
  and falls back to `iphone_forecast.json` (Open-Meteo), tagging it `"Open-Meteo (iPhone fallback)"`; the UI
  discards that provenance.
- Published as a distinct source with no caveat: `/right-wrong-ray` SOURCES hardcodes
  `{key:'apple_weather', label:'Apple Weather', icon:'📱'}` (`page.tsx:16-25`); `latest_forecasts.json`
  shows Apple's high/low/wind `73.2/51.8/8mph` identical to Open-Meteo.
- The homepage "free vs paid" headline chip resolves to **"Apple Weather · 91.9"** — Open-Meteo's data
  winning a 0.1-pt tiebreak (`homeStats.ts:84-86` `bestFree` reduce; tracking avgs apple 91.94 vs om 91.78
  over 108 vs 110 days) → `WhyTimeline.tsx:113`.
- The hero phone photo is captioned "Apple Weather · free" purely from byte size
  (`screenshot.ts:9-13`, `REAL_APPLE_MIN_BYTES=500000`); current shots are genuine ~2.2 MB Apple photos,
  but the *scored* data those days is the Open-Meteo fallback — a real Apple screenshot lends false
  authenticity to a non-Apple number.
- `CLAUDE.md` claims "the scoreboard labels it so there's no confusion" — **no such label exists in the UI** (false).

Why it matters: the entire bit is "the data is REAL" while mocking Ray's for hoping nobody checks. Publishing
Open-Meteo numbers under an "Apple Weather 📱" badge is falsifiable in seconds (open the Apple app) and, once
spotted, detonates every other claim including the Ray verdict. It also shows *two* free contenders beating
Ray when there's really one (Open-Meteo, double-counted).

Fix: (interim, before promotion) drop the Apple slot from all public surfaces until real Shortcut data
exists, **or** relabel honestly (e.g. "Apple (Open-Meteo proxy)") with an on-page note; **exclude
`apple_weather` from `bestFree`** so `freeLabel` is always Open-Meteo; caption the photo neutrally unless the
scored day is genuinely Apple; add Apple to the coverage matrix (`coverage.ts` omits it). (Proper) finish the
iPhone-Shortcut automation writing `iphone_forecast_apple.json` daily and gate Apple exactly like the 7 new sources.

### 🔴 R2 — Ray is structurally capped at 90/100; the headline gap is inflated ~28%
**Dim 4 · effort M · verified: confirmed (severity high)**

> **✅ RESOLVED 2026-06-26 — RENORMALIZED.** Score is now `raw_points / max_available × 100` (forfeited fields
> drop out of the denominator). Open-Meteo (91.66) + Apple (91.94) provably unchanged; Ray 65.3 → **72.68**;
> tracking gap 26.5 → **19.1**. Backfilled all 476 comparisons (idempotent), `ScoreBreakdown` shows the
> "raw of N available → score" reconciliation, methodology caption + `CLAUDE.md` updated. 17 py + 45 vitest
> pass, build green, **adversarial review CLEAN**. Plan: `planning/plans/2026-06-26-r2-coverage-normalized-scoring.md`.
> Ships on the next commit + push.

What's true now: `scoring.py:143` `total = round(sum((p or 0) for p in (high, low, wind, ptype, pamt)), 1)`
— a forfeited (`None`) category is added as 0 but the denominator stays 100. Ray forfeits `precip_amount` on
**110/110 days** by design (`compare.py:153-160`; he never publishes a numeric amount), so a Ray forecast that
is *perfect* on high/low/wind/type still scores exactly **90.0** and can never exceed it. Sources carrying
rain/snow amount can hit 100. Independently reproduced: re-normalizing Ray to each day's available-max lifts
his tracking avg **65.32 → 72.69** and cuts the Open-Meteo−Ray gap **26.34 → 18.98**. The site consumes raw
`total_score/days` out of 100 with no normalization (`homeStats.ts:31,62,88`) → the raw gap is the
homepage "The gap · 26 pts" stat (`WhyTimeline.tsx:115`).

Why it matters: the most defensible attack a Ray's lawyer/journalist has — "your own data says Ray gives 0
precip amounts, yet you score him out of 100 as if he answered, then headline the gap you manufactured." The
forfeit is fair; scoring it against a full-100 denominator is a choice that demonstrably enlarges the promoted
number. (`test_scoring.py:28` is even named `test_vague_precip_forfeits_amount_not_zeroed`, but the 10 points
*are* lost against 100 — observationally identical to zeroing for the average.)

Fix (pick one, disclose it): (a) score each source out of its own provided-fields max
(`score/max_available×100`) so coverage asymmetry can't move the gap — cleanest; or (b) keep the 100
denominator but prominently state Ray's 90 ceiling and report **both** raw and coverage-normalized gaps.
Do not promote the raw 26.5 without this. `whyStats` already carries `raysPrecipProvided:0/raysPrecipDays`.

### 🟠 R6 — The "gated" new sources are rendered publicly on the tracker
**Dim 1 + 2 · effort S · verified: confirmed (critic finding, high) — quickest high-value win**

What's true now: `right-wrong-ray/page.tsx:141` renders `UpcomingForecasts` unconditionally, and
`UpcomingForecasts.tsx:18-21` lists **all** `latest_forecasts.json` source keys with no allowlist. So the 7
new sources' forecasts are already public, even though their *scored* numbers are gated from the scoreboard.
The committed repo also shows e.g. OpenWeatherMap scoring **30.8** (a free source losing) — and those low
numbers are partly the unfair day-0 low bug (R11).

Why it matters: falsifies the premise that the new sources are gated; surfaces noisy 2-day data and an
unfairly-tanked source publicly, right when scrutiny lands.

Fix: apply the scoreboard's source allowlist to `UpcomingForecasts`; ideally one shared min-days gate used by
every public surface.

### 🟠 R4 — Methodology is invisible, and the on-page caption contradicts its own table
**Dim 3 · effort M · verified: confirmed (methodology high; caption-contradiction lowered medium)**

What's true now: the entire on-site methodology is the 2-line caption at `right-wrong-ray/page.tsx:133-136`
("...four fields: high temp (30), low temp (30), wind (20), precipitation (20)..."). But the `ScoreBreakdown`
table rendered immediately above (`page.tsx:98,126`; `ScoreBreakdown.tsx:4-10`) and the `CoverageMatrix`
(`coverage.ts:7-13`) both enumerate **five** fields (precip split into type /10 + amount /10). None of the
real engine's load-bearing mechanics are shown anywhere — interval wind + the `WIND_WIDTH_K=0.5` vagueness tax
(`scoring.py:6,45`), precip partial-credit (`scoring.py:53-59`), the snow-aware coupled model
(`scoring.py:62-84`), the NWS qualitative-wind mapping (`capture_rays.py:338-369`). There is no `/methodology`
route; the footer "How we score it" link lands on the bare caption. (Live proof the hidden mechanics shape
Ray specifically: all 110 of Ray's scored days carry interval wind and pay the width tax — invisible to readers.)

Why it matters: for a site whose thesis is "shown with tracked data not assertion," visible methodology *is*
the defensibility. The wind width-penalty and precip partial-credit are exactly the mechanics most likely to
be attacked as rigged, and they're hidden.

Fix: add a real methodology section / `/methodology` route describing the model *as implemented in
`scoring.py`*; correct the caption to five fields; note the NWS qualitative mapping and that Ray forfeits
(not is penalized for) precip amount; link `scoring.py` + `data/scores.json` so "recompute it yourself" is
literally one click away (closes the reproducibility gap — inputs are already all committed).

### 🟠 R5 — Open-Meteo is graded against its own archive, disclosed nowhere
**Dim 4 + 2 · effort L · verified: confirmed (high)**

What's true now: actuals come solely from the Open-Meteo historical archive (`capture_openmeteo.py:39-47`;
`compare.py:287-294` reads only `data/actuals/{date}.json`). Forecast wind = `wind_speed_10m_max` and actual
wind = `wind_speed_10m_max` from the same vendor; temps likewise. So on temp+wind the winning free source
is judged by its own provider's reanalysis (Open-Meteo: 476 days, avg 91.66, **1** wrong day ever). User copy
calls this "the actual weather" / "what actually happened" (`page.tsx:65,135`, `WhyTimeline.tsx:103`,
`layout.tsx:18`) and **names no provider**. There is no independent ground truth and no NWS/station cross-check.

Why it matters: "Open-Meteo beats Ray by 26 points, as measured by Open-Meteo" is a one-sentence takedown,
and it's literally true today. Ray, by contrast, is graded against a competitor-supplied truth.

Fix: (now) disclose the actuals source on `/right-wrong-ray` ("actuals = Open-Meteo archive") — non-negotiable;
(substantive) cross-validate a sample of actuals vs NWS/ASOS and publish the agreement; prioritize the Ecowitt
ground-truth station; consider reporting a gap that doesn't rest on the self-judged source (e.g. real-Apple or
NWS vs Ray).

### 🟠 R3 — No capture-quality / coverage-drop monitoring exists
**Dim 1 · effort M · verified: confirmed (high)**

What's true now: nothing in `scripts/` or `.github/` diffs today's `scores.json.coverage` against yesterday's
or asserts a minimum number of captured sources. All three capture steps are `continue-on-error: true`
(`daily_capture.yml:33,40,42`), so even the named-competitor Ray's capture cannot fail the job;
`capture_sources.py:33-34` prints `FAIL <key>` to a log nobody reads; `compare.py` never calls `sys.exit`
nonzero on a missing source. `test_scores_consistency.py:14-21` only reconciles entries-vs-totals math — it
would still pass if a source silently stopped capturing (the exact Ray-regression shape).

Why it matters: this is the preventive control whose absence let Ray's capture deflate for weeks. A silent
coverage drop on the named-competitor comparison is the single most credibility-destroying failure mode, and
there's zero detection.

Fix: a post-compare guard script (its own step, **not** continue-on-error) that loads the previously committed
`scores.json.coverage`, compares to the freshly written one, and **fails the job** on: any source's coverage
ratio dropping vs a rolling baseline, any expected daily source absent from `predictions/<date>/`, or total
sources scored today < N. Emit the diff to the job summary. Pair with a test asserting predictions↔comparisons
parity for the last K dates + no silent date gaps. Stdlib-only, cheap; converts every future silent regression
into a red run.

### 🟡 R7 — Silent missing-actuals drops a day; + 2 ghost empty-comparison rows
**Dim 1 · effort M · verified: silent-gap confirmed (high); ghost-rows confirmed mechanism, harm refuted (low)**

What's true now: when the archive has no data yet, `fetch_actuals` returns `None` with exit 0
(`capture_openmeteo.py:197-200`); `compare.run_daily_comparison` prints "ERROR: No actuals found" and returns
`None` but `__main__` never exits nonzero (`compare.py:288-291,624-625`) — the workflow step succeeds green.
**2026-05-22 is the only missing date** in the entire 2026-03-01→2026-06-24 range: `predictions/2026-05-22/`
has a full capture set but no actuals/comparison was ever created. (Recoverable: the Open-Meteo archive now
returns 2026-05-22 = high 59.8 / low 51.9.) Separately, two empty comparison files (`2026-03-03`,
`2026-06-18`, both `sources={}`) create 2 ghost rows in `scores.json` (entries=478 vs 476 real days) — but
every public renderer filters them out (verifier refuted the "blank rows on the chart/table" harm), so this is
repo-data tidiness, not a visible UI bug.

Fix: make missing-actuals loud + retried (archive lags 1-5 days) and flag a day unscored beyond a window; add
a backfill sweep that re-runs `predictions/<date>/` dirs lacking a comparison once actuals land; backfill
2026-05-22 now; stop writing empty comparison files (skip when no source scored) and delete the 2 ghost rows.

### 🟡 R8 — `CLAUDE.md` scoring section is stale/wrong
**Dim 3 · effort S · verified: confirmed (medium) — pairs with R4**

What's true now: `CLAUDE.md:59` attributes scoring to `compare.py:score_prediction()` — it's
`scripts/scoring.py:125` (compare only orchestrates). The documented rubric is also wrong: wind as a flat
"±3 mph, -2/mph" with **no interval/width tax** (real: `scoring.py:6,45`); precip as "10 binary + 10 amount"
with **no snow-aware coupling and no partial credit** (real: `scoring.py:53-84`, `_type_points` returns 4.0
for right-category/wrong-type, snow tol `max(1.0, 20%)`); NWS qualitative-wind mapping undocumented entirely.
(Field weights 30/30/20/20 and grade thresholds 90/75/60/40 *are* correct.)

Fix: repoint at `scoring.py` and describe the implemented model; treat `CLAUDE.md` and the new on-site
methodology (R4) as one synchronized description.

### 🟡 R9 — Concurrent compare + `-X ours` merge footgun
**Dim 1 · effort M · verified: confirmed (medium) — benign today, latent**

What's true now: `daily_compare.yml:3-9` triggers on cron **and** `workflow_run` completion, so compare jobs
overlap (today produced two "Daily comparison" commits 17 min apart). All three data workflows push via
`git pull --no-rebase -X ours` (`daily_compare.yml:69`, `daily_capture.yml:59`, `upload_screenshot.yml:106`).
`-X ours` lets a stale job keep its own data file on a collision. Benign **today** because
`_update_running_scores` fully rebuilds entries/totals/coverage from all comparison files each run (idempotent,
verified — the colliding commit changed only timestamp fields), and `daily_compare` does `reset --hard
origin/main` first — but `daily_capture` does **not**.

Fix: add a `concurrency:` group (queue, `cancel-in-progress: false`) or move to rebase-and-retry instead of
`-X ours`; add the `reset --hard origin/main` preamble to `daily_capture`; keep the rebuild-from-comparisons
invariant under test (it is).

### 🟡 R11 — OWM/Met.no day-0 low is the partial-bucket minimum
**Dim 4 + 1 · effort M · verified: confirmed (Dim 1 view high; Dim 4 view low — gated → net medium)**

What's true now: OWM (`sources/openweathermap.py:62-66`) and Met.no (`sources/metno.py:56-66`) derive the
daily low as `min()` over only the sub-daily entries the API returns. At a ~12:20 PM capture the day-0 bucket
starts at capture time, so its "low" is the remaining-day (evening) minimum, missing the pre-dawn trough —
biased high — and day-0 is exactly what gets scored at full 30-pt weight (`compare.py:421-423`, `scoring.py:130`).
Live: 2026-06-24 actual low 53.2 → OWM 70.7 (0/30), Met.no 66.0 (0/30); the same providers' day-ahead
forecasts were near-correct (55.6 / 52.7). The other 5 new sources use provider daily min/max and are clean.
**Currently confined to the gated 7 new sources** (not in public numbers) — so low public impact today, but a
genuine fairness defect that **must be fixed before un-gating** (it would unfairly depress the very free
sources the site champions).

Fix: for bucket-aggregating sources, forfeit the day-0 low (drop "low" from `fields_provided` that day) or
score the day+1 forecast made the prior morning; add a unit test asserting same-provider day-0 vs day-ahead
low agree within a few degrees.

### 🟡 R12 — Snow-depth scoring has never graded a real day
**Dim 4 · effort M · verified: confirmed (medium; verifier notes it's *understated*)**

What's true now: snow falls on 25/478 actual days; within Ray's window only 2026-03-16/17. Snow amount is
scored in depth with a coarse tolerance (`scoring.py:49-50` `max(1.0in, 20%)`, `SNOW_SLOPE=2.0`) coupled to
type (`scoring.py:62-84`). The proxy guard works (OWM/Google forfeit snow_amount → `None` rather than scoring
liquid-equiv mm as depth). But the verifier found the **pure snow-depth band has fired 0 times in any committed
comparison** — the 2 Ray snow days were scored under the *older* pre-snow-aware model (legacy `precip_in`-only
predictions); under current code those days return `None` for every source. So the coupled snow path will run
for the **first time live, in winter, self-judged against Open-Meteo's own archive** (R5 bites hardest here —
snow depth is the highest-model-error field).

Fix: before surfacing any snow column / winter claim — replay a past Boone snow event through `scoring.py` to
sanity-check the depth band + rain/snow type cascade; document the snow tolerance; decide/disclose how the
self-archived snow depth is validated (Ecowitt ideally measures it).

### 🟡 R10 — Trademark / scrape-republish exposure (counsel, not engineering)
**Dim 3 · effort M · verified: unverified-legal (flagged, not adjudicated)**

What's true now: the "Not affiliated with... Ray's Weather" disclaimer **is** on the live site and global
(`SiteFooter.tsx:10` via `layout.tsx:36`) — good. But the pipeline screenshots RaysWeather.com via Playwright
and scrapes its text (`capture_rays.py`), the UI republishes Ray's name + `rays_forecast.png` screenshots,
the site name is a phonetic play on the mark, and there's a commercial `/shop` — while the site sharply grades
Ray. The verdicts being true + data-derived is the strongest protection.

Fix: have counsel review (1) the right to republish scraped screenshots vs. citing/linking; (2) whether
nominative fair use holds given the commercial shop + phonetic-mark name; (3) that every comparative claim
stays traceable to committed data (it currently is). Consider whether screenshots are load-bearing or can be
replaced with cited data to shrink the surface. *(Not legal advice — risk flagged for review.)*

---

## Appendix — low-severity / no-launch-action, and refuted claims

**Low severity (note; act when wiring new sources in, not for launch):**
- **New sources mislabeled "free" internally** — 5 of 7 (OWM, WeatherAPI, Visual Crossing, Tomorrow.io,
  Google) require API keys / paid tiers but a `compare.py:408` comment calls all 7 "free." Latent: they don't
  carry a "free" badge publicly yet. Before any enters a public scoreboard, classify by an explicit
  free/free-tier-with-key/paid flag; never fold keyed commercial APIs into a "free" stat.
  (`sources/__init__.py:40-46`)
- **Small-sample gate is a by-name allowlist, not a min-days rule** — protected today by four independent
  allowlists *and* the TS `SrcKey` union (adding a key is a compile error, not a silent leak). Add an explicit
  min-days threshold when wiring the new sources into headline stats. (`homeStats.ts:3-8,70`)
- **iPhone capture JSON/PNG can diverge** — the real Apple screenshot is reused (correct intent) while the
  scored data is the fallback; fold a JSON/PNG-mismatch flag into the R3 monitor. (`capture_iphone_weather.py:509-512`)

**Refuted / downgraded (kept for transparency — the register must itself be defensible):**
- **"Ghost rows surface as blank rows on the trend chart / per-day table"** — *refuted*. The 2 empty rows
  exist in `scores.json` but every renderer filters them (`homeStats.ts:120`, `sparkline.ts:7`,
  `page.tsx` renders only the latest comparison). Real exposure is repo-data tidiness only → folded into R7
  at low severity, not the "visible UI bug" originally claimed.

## Pointers
- Workflow run: `wf_110d67e9-6ca` (full per-finding evidence + verifier transcripts).
- `CHECKLIST.md` — the triaged backlog (authoritative).
- Memories: `davessweater-promotion-readiness`, `davessweater-apple-real-data`, `davessweater-thesis-direction`, `rays-capture-deflation`.
