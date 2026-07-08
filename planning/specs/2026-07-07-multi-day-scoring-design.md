# Multi-day (lead-time) forecast scoring — design

**Date:** 2026-07-07
**Status:** DRAFT for owner review (written overnight; owner approved the *direction* — 5-day scoring —
before this doc existed). Do not implement until owner reviews this spec.
**Related:** `planning/seo/2026-07-07-rays-competitive-research.md` (research + diagnostics),
`CHECKLIST.md` → "Multi-day scoring — gate check", `scripts/compare.py`, `scripts/scoring.py`.

## 1. Why

Today the tracker scores only the **next-day** (lead-1, really "capture-day/day-ahead") forecast. But every
daily capture since 2026-03-04 already stores each source's **full multi-day array**, so we can score how
accurate each source was at 0, 1, 2, … days of lead time — for free, retroactively. That yields a
**forecast-accuracy-decay curve per source**, which:

- Deepens the core bit: "his 5-day is vibes past day 2 — here's the measured curve."
- Produces a more credible headline than the single-gap number (see §3 finding).
- Establishes the lead-time data model that the **multi-location** milestone will reuse verbatim.
- Unlocks the parked article *"How accurate is a 10-day forecast?"* (its brief currently forbids implying
  we measured decay — after this, we'll have measured it locally, 1–5 days out).

## 2. Scope

**In:** Generalize scoring from single-day to lead-time (0–5 days) for all sources at the Boone location;
backfill the full history; a rolling lead-time aggregate; disclosure of forecaster bias; capture two Ray
fields we currently drop (`golfballs`, `snowmanometer`) so the "how-sure-was-Ray" calibration can accrue.

**Out (designed-for, built later):** multi-location capture/scoring (schema is parameterized now, only
Boone is populated); the site visualization component (we define its data contract, not the UI); the
golfballs *calibration analysis* (needs accrued data); any new forecast sources.

**Horizon ceiling:** **5 days.** Ray publishes 7, but (a) days 6–7 are paywalled narrative, not cleanly
scoreable, and (b) our archive reliably holds his rows to ~4–5 days out (sample cliffs from 121 days at
lead 3 to 9 at lead 4). We score 0–5 and **disclose the thinning past lead 3** rather than implying full
7-day coverage.

## 3. Load-bearing findings (from the 2026-07-07 diagnostic spike)

Mean absolute error, °F, Ray vs Open-Meteo, by lead (our real archive, ~120 shared days):

| Lead | Ray high MAE | OM high MAE | Ray low MAE | OM low MAE |
|---|---|---|---|---|
| 0 | 7.1 | 1.9 | 4.1 | 1.7 |
| 1 | 6.9 | 2.8 | 3.8 | 2.5 |
| 2 | 6.7 | 3.5 | 4.0 | 1.9 |
| 3 | 6.7 | 3.8 | 3.8 | 2.1 |
| 4 | 4.4* | 3.7 | 3.5* | 2.4 |  (*n=9, thin)

**Story:** free wins at every measurable horizon; its edge is largest at 1 day (2.8 vs 6.9) and *narrows*
by day 4 as Open-Meteo naturally decays while Ray stays flat. "Free's lead is biggest exactly when you're
planning tomorrow" is more defensible than a single headline gap.

**Fairness is airtight (this is why we can publish):**
- Ray's high error is **not** a cold/elevation offset. Signed bias is **+3.5°F (warm)**, only half the
  7.1° MAE → the error is mostly genuine scatter, not a fixed station offset. He over-forecasts, so the
  "you graded me at a colder spot" attack fails on its face.
- **Elevation is identical:** Ray's Boone station = 3,240 ft; our grading point (Open-Meteo at his coords)
  = 3,242 ft. We grade him at the elevation he forecasts for, ±2 ft.
- Open-Meteo's own bias is +1.1° / MAE 1.9° (tight) — consistent with it being graded against its own
  archive (the self-judging caveat is already disclosed on `/methodology`).
- **Actuals independence (verified 2026-07-08):** our "actual" is Open-Meteo's archive = ERA5/ERA5-Land +
  ECMWF IFS *reanalysis* (official stations + satellite/aircraft/buoy/radar, downscaled via 90m DEM). It is
  NOT Ray's station and NOT a personal-weather-station network (Weather Underground) — so Ray is graded
  against a source independent of him (no "you used my numbers as truth" defense). The genuine circularity
  is the R5 one and runs the OTHER way: Open-Meteo forecast vs Open-Meteo archive share a provider (and the
  recent-days archive uses ECMWF IFS), which flatters Open-Meteo's ABSOLUTE score, not Ray's — it cannot
  explain his 7° miss. So the ranking/bias findings are robust; only Open-Meteo's absolute level carries the
  disclosed asterisk. Independent ground truth (Ecowitt station, roadmap) is the real fix, not a blocker here.

**Design consequence:** we will **report signed bias alongside accuracy** and optionally show a
bias-corrected view, so nobody can claim we ignored it — and Ray still loses on scatter. This turns a
potential attack into a transparency win.

## 4. Data model

### 4.1 Indexing
For target date **D**, source **S**, lead **L** (0–5): the forecast is the row for D found in capture
folder `data/predictions/{D − L}/{S}_forecast.json` (Ray: `rays_boone.json`). `compare.py` already
row-matches by exact date; we generalize the capture-folder selection from "today" to "D − L".

### 4.2 New artifacts
- **`data/leadtime/{D}.json`** — per target date, one file: for each (location, source, lead) that we
  could score, the full scored breakdown (reusing `score_prediction`) **plus** raw high/low/wind forecast
  values and signed errors (so the MAE/bias tracks don't require re-derivation).
- **`data/leadtime_scores.json`** — rolling aggregate consumed by the site: per (location, source, lead)
  → avg score, high/low/wind MAE, high/low signed bias, n_days, and a short trailing series for
  sparklines. Location-keyed (only `"Boone"` populated in v1).

Rationale for separate files (not extending `comparisons/{D}.json`): keeps the existing single-day
comparison consumers (homepage, `/right-wrong-ray`) untouched and low-risk; lead-time is additive.

### 4.3 Location parameterization (build Boone only)
Every record carries a `location` key. A small registry seeds it:
```
LOCATIONS = { "Boone": {lat: 36.2168, lon: -81.6746, elevation_ft: 3242,
                        rays_station: {name: "Boone", id: 1}} }
```
v1 populates only Boone. Multi-location later = add registry entries + per-location capture; the scoring,
artifacts, and site contract already accept it. **Guardrail (per session decision):** because we'll
publicly criticize Ray's "3 narratives across 66 towns," our per-location data must be genuinely distinct
per town — the registry + per-location captures guarantee that structurally.

## 5. Scoring model at extended leads

**Keep the same 100-point model at every lead.** Ray forfeits wind (20) and precip-amount (10) at all
leads exactly as he does at lead 0 (he never publishes numeric wind/QPF) — so extended-lead scoring is
*consistent* with the published methodology, not a new penalty. Sources that DO provide wind/precip at
extended leads (Open-Meteo, NWS, etc.) are scored on all fields at all leads.

**Also emit a "core" high/low MAE track** per lead, because (a) the accuracy-*decay* story is cleanest on
temperature and (b) not every source provides every field at every lead — temperature is the common
denominator for the cross-source decay chart. So each lead has: full 100-pt score (headline scoreboard)
+ high/low MAE + bias (decay chart + fairness disclosure).

**Capture-day-low note:** `compare.py:_fix_bucket_low` (the Met.no/OWM warm-low recovery) applies only at
lead 0 (the midday capture-day problem). At lead ≥ 1 the forecast row spans the full UTC day and already
reaches the overnight trough, so the fix is a no-op there — cleaner, and the code should skip it for L≥1
explicitly.

## 6. Ray capture additions (same code, fold in now)

`rays_boone.json` currently lacks `golfballs` and `snowmanometer` (confirmed 2026-07-07). Add both to the
Ray capture from the **public** `getForecastSummary`/`blurbs` endpoints (guardrail #4: public endpoints
only). These don't feed multi-day scoring; we capture them now so the future "how sure was Ray?"
calibration (does stated confidence track measured accuracy?) has history. Backfill from saved `raw_text`
where the value is present; forfeit silently where it isn't.

## 7. Backfill & daily run

- **`scripts/backfill_leadtime.py`** — iterate every actual date × lead 0–5 × source; write
  `data/leadtime/{D}.json` and rebuild `data/leadtime_scores.json`. Idempotent (re-runnable), following
  the pattern of the existing `renormalize_history.py` / `backfill_bucket_low.py`.
- **Daily:** extend the Daily Compare step so that when date D gets its actuals, we score the D−0..D−5
  captures for D and update the aggregate. Guarded the same way as the existing compare (health check).
- **Consistency guard:** a pytest like `test_scores_consistency.py` pinning that lead-0 lead-time scores
  equal the existing single-day comparison scores (they must, by construction) — catches drift.

## 8. Site surfacing (contract only; UI deferred)

Data contract for a later component: `leadtime_scores.json` → an **accuracy-decay chart** (x = lead 0–5,
y = score or MAE, one line per source) with the headline "Free wins at every horizon," plus a bias
disclosure row on `/methodology` ("Ray runs ~3.5°F warm on highs and still misses by ~7°F; graded at his
own station's elevation, 3,240 ft"). Exact component is a separate UI pass.

## 9. Testing / done-criteria

- pytest: lead-time scoring on fixtures (deterministic); lead-0 ≡ single-day equivalence; bias/MAE math.
- `npm test` / lint / `next build` green if any TS lib/type is touched.
- Backfill runs clean over full history; `leadtime_scores.json` sane (n_days plausible, Ray < free at all
  leads, no NaNs).
- `/methodology` gains the horizon + bias disclosure copy.
- No change to existing single-day scoreboard numbers (additive only).

## 10. Open questions for owner (morning)

1. **Full 100-pt model vs. high/low-only at extended leads for the public scoreboard?** Recommend: keep
   the full model as the scoreboard number (consistent), lead the *chart* with high/low MAE (clean decay).
2. **Where does the decay chart live** — `/right-wrong-ray`, `/methodology`, or homepage? (Recommend
   `/right-wrong-ray` with a homepage teaser once it has enough days.)
3. **Bias-corrected view** — show it, or just disclose the bias number? (Recommend disclose the number;
   offer the corrected view only if he ever contests.)
4. Confirm 5-day ceiling is final (vs. 4, given lead-4 sample is already thin at n≈9 today — it thickens
   as history accrues).
