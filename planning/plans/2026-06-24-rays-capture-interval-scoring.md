# Ray's Capture Fix + Interval Wind Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD, atomic commits, `- [ ]` steps.

**Goal:** Make Ray's scoring fair and defensible — fix three stacked capture/scoring bugs, score wind as an **interval with a vagueness penalty**, recover Ray's precip-type, backfill the whole Ray era from saved raw text, and re-score.

**Why:** Investigation (2026-06-24) found Ray is mis-scored by our pipeline, not his forecasts. Recovering his data alone lifts him ~+3.8; an interval width-penalty claws back his vague ranges; net ≈ **63.6** (was 65.5) — flat, but every point now earned and source-neutral. Open-Meteo unchanged (~91.6).

**Locked decisions:**
- **Interval wind scoring, width coefficient `k = 0.5`.** A forecast is an interval `[lo, hi]`; effective error = `|midpoint − actual| + 0.5 × (hi − lo)`, run through the existing wind band (tol ±3 mph, −2/mph, max 20). Point forecasts (`lo == hi`, width 0) are unaffected — **backward-compatible**.
- **Qualitative wind → NWS scale interval:** `calm`→(0,1), `light`→(1,7), `breezy`→(12,20), `windy`/`gusty`→(18,30).
- **Precip AMOUNT stays forfeited** for Ray (he publishes no number — do NOT invent one). Recover precip **type** only.
- **Preserve original captures** — backfill writes rebuilt sibling files, never overwrites `rays_boone.json`, for auditability.
- Expected after re-score: Ray season mean ≈ **63.6 ± 2**, Open-Meteo ≈ **91.6 unchanged**, wind coverage ~100/109, precip-type ~100/109.

**Standing rules:** Python **stdlib-only** at runtime (`capture_rays.py` uses Playwright only when live-scraping; backfill re-parses saved text, no Playwright). Separate from the M3 viz milestone (this touches `scripts/` + `data/`, not `src/`). Stage files explicitly — **never `git add -A`** (this branch's `.gitignore` is narrow). Keep `scripts/scoring.py` import-light.

**Source of truth for parsing:** every era `data/predictions/<date>/rays_boone.json` stores Ray's forecast verbatim in `raw_text` (5–6k chars) + per-day `daily[].daytime_desc`. The fix parses that text; it does NOT re-scrape Ray.

---

## Phase 0 — Housekeeping

### Task 0.1: Broaden `.gitignore`

- [ ] **Step 1:** Replace the line `scripts/__pycache__/` with:
```
# Python bytecode
__pycache__/
*.pyc

# Local tooling
.claude/
```
- [ ] **Step 2:** `git add .gitignore && git commit -m "chore: ignore __pycache__/*.pyc/.claude"`

---

## Phase 1 — Scoring engine: interval wind (`scripts/scoring.py`)

### Task 1.1: Interval-aware wind scoring (backward-compatible)

**Files:** Modify `scripts/scoring.py`; Test `tests/test_scoring.py`

- [ ] **Step 1: Write failing tests.** Add to `tests/test_scoring.py`:
```python
def W(**kw):
    base = {"high_f":84,"low_f":61,"wind_mph":None,"precip_type":None,"rain_in":None,"snow_in":None,
            "fields_provided":["high","low","wind"]}
    base.update(kw); return base

ACTW = {"high_f":84,"low_f":61,"wind_mph":8.0,"rain_in":0.0,"snow_in":0.0}

def test_point_wind_unchanged():
    # a point forecast (wind_mph only) scores exactly as the old band
    assert score_prediction(W(wind_mph=8.0), ACTW)["breakdown"]["wind"]["points"] == 20.0
    assert score_prediction(W(wind_mph=13.0), ACTW)["breakdown"]["wind"]["points"] == 16.0  # |13-8|=5 -> 20-(5-3)*2

def test_interval_wind_width_penalty():
    # wide range pays a vagueness tax even when the midpoint is accurate
    r = score_prediction(W(wind_lo=5, wind_hi=15), ACTW)  # mid 10, width 10 -> eff |10-8|+5=7 -> 20-(7-3)*2
    assert r["breakdown"]["wind"]["points"] == 12.0

def test_tight_interval_keeps_credit():
    r = score_prediction(W(wind_lo=5, wind_hi=10), ACTW)  # mid 7.5, width 5 -> eff |7.5-8|+2.5=3.0 -> 20
    assert r["breakdown"]["wind"]["points"] == 20.0

def test_qualitative_wind_as_nws_interval():
    # "light" maps to (1,7); mid 4, width 6 -> eff |4-8|+3=7 -> 12
    assert score_prediction(W(wind_lo=1, wind_hi=7), ACTW)["breakdown"]["wind"]["points"] == 12.0

def test_wind_forfeit_when_absent():
    p = W(); p["fields_provided"] = ["high","low"]  # no wind provided
    assert score_prediction(p, ACTW)["breakdown"]["wind"]["points"] is None
```
- [ ] **Step 2:** `pytest tests/test_scoring.py -k wind -v` → FAIL.
- [ ] **Step 3: Implement.** In `scripts/scoring.py` add (near the wind constants):
```python
WIND_WIDTH_K = 0.5  # vagueness tax: half the forecast-range width is added to the error

def _wind_interval(pred):
    lo, hi = pred.get("wind_lo"), pred.get("wind_hi")
    if lo is not None and hi is not None:
        return (min(lo, hi), max(lo, hi))
    w = pred.get("wind_mph")
    return (w, w) if w is not None else None

def _wind_points(pred, actual):
    if "wind" not in pred.get("fields_provided", []):
        return None
    iv = _wind_interval(pred); aw = actual.get("wind_mph")
    if iv is None or aw is None:
        return None
    lo, hi = iv
    eff = abs((lo + hi) / 2.0 - aw) + WIND_WIDTH_K * (hi - lo)
    return round(max(0.0, 20 - max(0.0, eff - WIND_TOL) * WIND_SLOPE), 1)
```
In `score_prediction`, replace the `wind = _band(...) if "wind" in fp else None` line with `wind = _wind_points(pred, actual)`. Update the wind breakdown so `predicted` shows the interval midpoint (or `f"{lo}-{hi}"` when `wind_lo != wind_hi`), keeping `points/max/scored/actual/error` as today.
- [ ] **Step 4:** `pytest tests/test_scoring.py -v` → all pass (the existing point-wind tests must still pass — backward compatibility).
- [ ] **Step 5:** Commit `feat(scoring): interval wind scoring with 0.5x width vagueness penalty`.

---

## Phase 2 — Capture: `scripts/capture_rays.py`

### Task 2.1: Anchor day-0 to the capture date (fixes the day-name mislabel)

**Files:** Modify `scripts/capture_rays.py`; Test `tests/test_capture_rays.py` (create)

- [ ] Read `capture_rays.py` ~lines 380–410. Replace the `days_ahead = (days_of_week.index(day_name) - today.weekday()) % 7` logic: anchor `daily[0].date = capture_date` (passed in / derived from EST now or, in backfill, from the directory name) and assign `daily[i].date = capture_date + i` in **encounter order**. After building, assert/log if `daily[0].high_f != forecast.today_high_f` (the off-by-one canary) — log a warning, don't crash.
- [ ] Test: a fixture daily list parses to incrementing dates anchored at the capture date.
- [ ] Commit `fix(capture): anchor Ray daily[0] to the capture date`.

### Task 2.2: Wind interval parser + precip-type recovery

**Files:** Modify `scripts/capture_rays.py`; Test `tests/test_capture_rays.py`

- [ ] **Step 1: Failing tests** for `_parse_wind_interval(desc) -> (lo,hi)|None`:
```python
import pytest
from capture_rays import _parse_wind_interval, _parse_precip_type
@pytest.mark.parametrize("desc,exp", [
    ("SSW wind 5-10 mph", (5,10)),
    ("Light South wind becoming 5-15 mph", (1,15)),      # light(1-7) U 5-15 -> full span
    ("SW wind 5-10 mph becoming NW 10-20 mph late", (5,20)),
    ("NW wind 10-20 mph gusting to 40", (10,20)),         # gust excluded
    ("N wind around 5 mph", (5,5)),
    ("Light WNW wind", (1,7)),                            # qualitative -> NWS light
    ("Nearly calm wind", (0,1)),
    ("Partly cloudy.", None),                             # no wind info
])
def test_parse_wind_interval(desc, exp):
    assert _parse_wind_interval(desc) == exp
def test_parse_precip_type():
    assert _parse_precip_type("Scattered showers and thunderstorms") == "rain"
    assert _parse_precip_type("Snow showers, accumulating") == "snow"
    assert _parse_precip_type("Sunny and dry") == "none"
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `_parse_wind_interval`: strip gust clauses (`gust… N`), collect all `\d+-\d+ mph` endpoints + `around/near/about N` + `N mph`; if any → `(min, max)`; else NWS qualitative map (`calm`(0,1), `light`(1,7), `breezy`(12,20), `windy`/`gusty`(18,30)); else `None`. `_parse_precip_type`: snow/flurries/wintry→`snow`, rain/showers/thunder/storm/drizzle→`rain` (both→`mixed`), clear/sunny/dry/cloudy→`none`, else `None`. Wire both into the per-day parse, emitting `wind_lo`, `wind_hi` (and keep `wind_mph` = midpoint for back-compat) + `precip_type` on each `daily[]` entry. Fall back to `overnight_desc`/`narrative` when `daytime_desc` lacks wind.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** Commit `feat(capture): wind-interval + precip-type parsing from Ray's narrative`.

---

## Phase 3 — Scoring path: `scripts/compare.py`

### Task 3.1: Date-alignment fallback + carry the interval

**Files:** Modify `scripts/compare.py`

- [ ] In `_best_rays_prediction` (~line 139): after the exact-date match loop, if nothing matched, fall back to `daily[0]` (now correctly the capture day) or the nearest future entry. Carry `wind_lo`/`wind_hi`/`precip_type` into the scored prediction's contract (add `wind` to `fields_provided` when an interval exists; add `precip_type` to `fields_provided` when recovered). **Keep `precip_in = None`** (amount stays forfeited). Confirm non-Ray sources are untouched (they carry `wind_mph` only → scored as a point via `_wind_interval` fallback).
- [ ] Verify: `python scripts/compare.py --date 2026-06-22` then check the raysweather breakdown now has `wind`/`precip_type` scored (was all-false). Commit `fix(compare): date fallback so a hiccup never strips Ray's wind/precip`.

---

## Phase 4 — Historical backfill: `scripts/backfill_rays.py` (new)

### Task 4.1: Re-parse the saved era into rebuilt files

**Files:** Create `scripts/backfill_rays.py`

- [ ] For each `data/predictions/<date>/rays_boone.json` where `<date> >= 2026-03-04` (the Ray era): import the **fixed** parsers from `capture_rays.py`, re-parse the saved `raw_text` (and existing `daily[].*_desc`), rebuild `daily[]` with dates anchored to `<date>` (from the directory name — never `datetime.now`), recovering `wind_lo`/`wind_hi`/`precip_type`. Write to **`rays_boone.rebuilt.json`** (preserve the original). Validate the canary (`daily[0].high_f == forecast.today_high_f`); on failure, **log and skip** (leave that day as-is — never guess).
- [ ] `compare.py` must prefer `rays_boone.rebuilt.json` when present (small loader tweak). 
- [ ] Run: `python scripts/backfill_rays.py`; report rebuilt/skipped counts. Commit `feat(backfill): rebuild Ray's era wind/precip from saved raw_text (originals preserved)`.

---

## Phase 5 — Re-score + verify

### Task 5.1: Re-score the era and check the numbers

- [ ] Re-run the scorer over the era: `for d in <era dates>: python scripts/compare.py --date $d` (actuals already saved; `compare.py` rebuilds `data/scores.json` totals + coverage each run).
- [ ] **Verify against the simulation:** Ray season mean ≈ **63.6 ± 2**; Open-Meteo mean **unchanged ≈ 91.6**; Ray wind coverage ~100/109, precip-type ~100/109; spot-check 2026-06-22 flips from 39.6 (all wind/precip false) to a covered score. Print a before/after per-source summary.
- [ ] `git add data/ && git commit -m "data: re-score Ray's era under interval scoring + recovered capture"`.

---

## Phase 6 — Methodology transparency (tracked, may defer)

- [ ] Document on `/right-wrong-ray`: the interval scoring + 0.5 width penalty + the NWS qualitative-wind mapping + that precip amount is forfeited for sources that don't publish a number. This visible methodology IS the defensibility. (Can fold into M3 or ship as a small `src/` follow-up.)

---

## Notes for the executor
- **Backward compatibility is non-negotiable:** Open-Meteo + all other sources carry `wind_mph` (a point); they must score identically before/after (width 0). The existing point-wind tests prove it.
- **Never invent a precip amount** for Ray; recover precip *type* only.
- **Preserve originals** — rebuilt files are siblings; the original captures stay for audit.
- Stage files explicitly; this branch's `.gitignore` is narrow (Phase 0 fixes it).
