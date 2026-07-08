# Multi-day (5-day) Lead-Time Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score every source's forecast at each lead time (0–5 days ahead), backfill the full history, and surface a forecast-accuracy-decay chart on `/right-wrong-ray` — proving free beats Ray at every horizon.

**Architecture:** Reuse the existing scoring engine. For target date D, source S, lead L: read the forecast row for D from the capture folder `predictions/{D−L}/`, score it with the *same* `_to_contract` + `score_prediction` + `_normalize_actual` the daily comparison already uses. Lead-0 equals the existing single-day comparison by construction (a consistency test pins this). Write per-date `data/leadtime/{D}.json` + a rolling `data/leadtime_scores.json`; render a decay chart with visx (already a dependency).

**Tech Stack:** Python 3 stdlib; pytest; Next.js 16 + TypeScript; vitest; visx (installed).

**Design source:** `planning/specs/2026-07-07-multi-day-scoring-design.md`. Scope decisions (owner, 2026-07-08): full-model score as the scoreboard number + high/low MAE for the chart; chart on `/right-wrong-ray`; disclose the bias number on `/methodology`; 5-day ceiling with disclosed thinning past lead 3.

**Fairness (baked into copy, from the diagnostic):** Ray runs +3.5°F warm on highs with a 7°F MAE (scatter, not a station offset); his Boone station is 3,240 ft vs. our 3,242 ft grading point. The methodology copy states this. Actuals-independence is the disclosed R5 caveat (helps Open-Meteo, not Ray).

---

## File Structure

- `scripts/leadtime.py` — **NEW.** `score_lead(target_date, source, lead, norm_actual)` (reuses compare.py helpers) + `build_leadtime(target_date)` (writes `data/leadtime/{D}.json`) + `build_leadtime_scores()` (rolls up → `data/leadtime_scores.json`).
- `scripts/backfill_leadtime.py` — **NEW.** Iterate every actual date → `build_leadtime` → rebuild aggregate. Idempotent.
- `tests/test_leadtime.py` — **NEW.** pytest: lead-0 ≡ existing comparison; MAE/bias math; lead selection.
- `data/leadtime/{date}.json`, `data/leadtime_scores.json` — **NEW (generated).**
- `src/lib/leadtime.ts` — **NEW.** Types + `getLeadtimeScores()` loader (follows `src/lib/data.ts`).
- `src/lib/__tests__/leadtime.test.ts` — **NEW.** vitest for any render helper.
- `src/components/AccuracyDecayChart.tsx` — **NEW.** visx line chart (MAE vs lead, one line per source).
- Modify: `src/app/right-wrong-ray/page.tsx` (mount the chart), `src/app/methodology/page.tsx` (bias + horizon disclosure), `.github/workflows/daily_compare.yml` (add the two build steps).

**Location-parameterized now, Boone-only populated** (per spec §4.3): every record carries `"location": "Boone"`; multi-location later adds registry entries without touching this code.

---

## Task 1: Lead-time scoring core (`score_lead`)

**Files:**
- Create: `scripts/leadtime.py`
- Test: `tests/test_leadtime.py`

**Reused from `compare.py`/`scoring.py`:** `_to_contract`, `_normalize_actual`, `_best_rays_prediction`, `_fix_bucket_low`, `_get_high`, `_get_low`, `score_prediction`.

- [ ] **Step 1: Write the failing test — lead-0 equals the existing comparison**

```python
# tests/test_leadtime.py
import sys, os, json, glob
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from leadtime import score_lead
import compare

DATA = os.path.join(os.path.dirname(__file__), "..", "data")

def _a_date_with_openmeteo_comparison():
    for f in sorted(glob.glob(f"{DATA}/comparisons/*.json"), reverse=True):
        d = json.load(open(f))
        if d.get("sources", {}).get("openmeteo", {}).get("score"):
            return d["date"], d
    raise AssertionError("no comparison with openmeteo score found")

def test_lead0_matches_existing_comparison():
    date, comp = _a_date_with_openmeteo_comparison()
    norm_actual = compare._normalize_actual(comp["actuals"])
    lead0 = score_lead(date, "openmeteo", 0, norm_actual)
    assert lead0 is not None
    assert lead0["score"] == comp["sources"]["openmeteo"]["score"]["score"]

def test_missing_capture_returns_none():
    # a lead so deep no capture exists that far back for this date
    date, comp = _a_date_with_openmeteo_comparison()
    norm_actual = compare._normalize_actual(comp["actuals"])
    assert score_lead("1900-01-01", "openmeteo", 3, norm_actual) is None
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_leadtime.py -q`
Expected: FAIL (`No module named 'leadtime'`).

- [ ] **Step 3: Implement `score_lead`**

```python
# scripts/leadtime.py
#!/usr/bin/env python3
"""leadtime.py — score each source's forecast by lead time (0-5 days ahead).

For target date D and lead L, the forecast is the row for D found in the capture
folder predictions/{D-L}/. Reuses the exact daily-comparison scoring so lead 0 is
identical to the single-day comparison (guarded by tests/test_leadtime.py)."""
from __future__ import annotations
import json
from datetime import date, timedelta
from pathlib import Path

import compare  # reuse helpers + DATA_DIR
from scoring import score_prediction

DATA_DIR = compare.DATA_DIR
MAX_LEAD = 5
LOCATION = "Boone"

# Source key -> capture filename (Ray's uses the rebuilt sibling when present).
SOURCE_FILES = {
    "openmeteo": "openmeteo_forecast.json",
    "nws": "nws_forecast.json",
    "metno": "metno_forecast.json",
    "openweathermap": "openweathermap_forecast.json",
    "tomorrowio": "tomorrowio_forecast.json",
    "visualcrossing": "visualcrossing_forecast.json",
    "weatherapi": "weatherapi_forecast.json",
    "googleweather": "googleweather_forecast.json",
}


def _row_for(capture_dir: Path, source: str, target_date: str):
    """Return the forecast dict for target_date from a source's capture, or None."""
    if source == "raysweather":
        rebuilt = capture_dir / "rays_boone.rebuilt.json"
        path = rebuilt if rebuilt.exists() else capture_dir / "rays_boone.json"
        if not path.exists():
            return None
        return compare._best_rays_prediction(json.loads(path.read_text()), target_date)
    fname = SOURCE_FILES.get(source)
    path = capture_dir / fname if fname else None
    if not path or not path.exists():
        return None
    for day in json.loads(path.read_text()).get("daily", []):
        if day.get("date") == target_date:
            return day
    return None


def score_lead(target_date: str, source: str, lead: int, norm_actual: dict):
    """Score source's forecast for target_date made `lead` days earlier.

    Returns {score, high_err, low_err, high_bias, low_bias, breakdown} or None if
    no such capture/row exists."""
    capture_day = (date.fromisoformat(target_date) - timedelta(days=lead)).isoformat()
    capture_dir = DATA_DIR / "predictions" / capture_day
    row = _row_for(capture_dir, source, target_date)
    if not row:
        return None

    # The capture-day-low recovery only applies at lead 0 (the midday-capture
    # problem); at lead >= 1 the row already spans the full day. Mirror compare.py
    # by applying _fix_bucket_low only when lead == 0.
    day = dict(row)
    if lead == 0:
        compare._fix_bucket_low(source, target_date, day)

    result = score_prediction(compare._to_contract(day), norm_actual)
    ph, pl = compare._get_high(day), compare._get_low(day)
    ah, al = norm_actual.get("high_f"), norm_actual.get("low_f")
    return {
        "score": result["score"],
        "grade": result["grade"],
        "high_err": abs(ph - ah) if ph is not None and ah is not None else None,
        "low_err": abs(pl - al) if pl is not None and al is not None else None,
        "high_bias": (ph - ah) if ph is not None and ah is not None else None,
        "low_bias": (pl - al) if pl is not None and al is not None else None,
    }
```

**⚠️ Executor note:** verify `SOURCE_FILES` keys against actual filenames in `data/predictions/<recent>/` and the source keys `compare.py` uses in `comparison["sources"]` (grep `sources"]\[` in compare.py). Add/rename to match exactly before running the backfill.

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_leadtime.py -q`
Expected: PASS (2 passed). If `test_lead0_matches_existing_comparison` fails on Ray's or a min()-low source, confirm the `_fix_bucket_low` lead-0 branch matches `compare.py`'s behavior for that source.

- [ ] **Step 5: Commit**

```bash
git add scripts/leadtime.py tests/test_leadtime.py
git commit -m "feat(leadtime): lead-time scoring core reusing the daily engine (lead-0 == comparison)"
```

---

## Task 2: Per-date builder + rolling aggregate

**Files:**
- Modify: `scripts/leadtime.py` (add `build_leadtime` + `build_leadtime_scores`)
- Modify: `tests/test_leadtime.py` (aggregate math test)

- [ ] **Step 1: Write the failing test (MAE/bias aggregation)**

```python
# append to tests/test_leadtime.py
from leadtime import _aggregate_rows

def test_aggregate_mae_and_bias():
    rows = [
        {"source": "openmeteo", "lead": 1, "score": 90, "high_err": 2.0, "high_bias": 2.0, "low_err": 1.0, "low_bias": -1.0},
        {"source": "openmeteo", "lead": 1, "score": 80, "high_err": 4.0, "high_bias": -4.0, "low_err": 3.0, "low_bias": 3.0},
    ]
    agg = _aggregate_rows(rows)
    cell = agg["openmeteo"]["1"]
    assert cell["n"] == 2
    assert cell["avg_score"] == 85.0
    assert cell["high_mae"] == 3.0          # (2+4)/2
    assert cell["high_bias"] == -1.0        # (2 + -4)/2
```

- [ ] **Step 2: Run to verify fail** — `python -m pytest tests/test_leadtime.py -q` → FAIL (`cannot import name '_aggregate_rows'`).

- [ ] **Step 3: Implement**

```python
# append to scripts/leadtime.py
def _norm_actual_for(target_date: str):
    p = DATA_DIR / "actuals" / f"{target_date}.json"
    if not p.exists():
        return None
    return compare._normalize_actual(json.loads(p.read_text()))


def build_leadtime(target_date: str):
    """Score every source x lead for target_date -> data/leadtime/{date}.json."""
    norm_actual = _norm_actual_for(target_date)
    if norm_actual is None:
        return None
    rows = []
    for source in list(SOURCE_FILES) + ["raysweather"]:
        for lead in range(MAX_LEAD + 1):
            r = score_lead(target_date, source, lead, norm_actual)
            if r:
                rows.append({"source": source, "lead": lead, **r})
    out = {"date": target_date, "location": LOCATION, "rows": rows}
    d = DATA_DIR / "leadtime"; d.mkdir(parents=True, exist_ok=True)
    (d / f"{target_date}.json").write_text(json.dumps(out, indent=2))
    return out


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 2) if xs else None


def _aggregate_rows(rows):
    """rows -> {source: {lead(str): {n, avg_score, high_mae, low_mae, high_bias, low_bias}}}."""
    agg = {}
    keyed = {}
    for r in rows:
        keyed.setdefault((r["source"], r["lead"]), []).append(r)
    for (source, lead), group in keyed.items():
        cell = {
            "n": len(group),
            "avg_score": _mean([g["score"] for g in group]),
            "high_mae": _mean([g["high_err"] for g in group]),
            "low_mae": _mean([g["low_err"] for g in group]),
            "high_bias": _mean([g["high_bias"] for g in group]),
            "low_bias": _mean([g["low_bias"] for g in group]),
        }
        agg.setdefault(source, {})[str(lead)] = cell
    return agg


def build_leadtime_scores():
    """Roll up all data/leadtime/*.json -> data/leadtime_scores.json."""
    all_rows = []
    for f in sorted((DATA_DIR / "leadtime").glob("*.json")):
        all_rows += json.loads(f.read_text()).get("rows", [])
    out = {"location": LOCATION, "max_lead": MAX_LEAD, "by_source": _aggregate_rows(all_rows)}
    (DATA_DIR / "leadtime_scores.json").write_text(json.dumps(out, indent=2))
    return out
```

- [ ] **Step 4: Run to verify pass** — `python -m pytest tests/test_leadtime.py -q` → PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/leadtime.py tests/test_leadtime.py
git commit -m "feat(leadtime): per-date builder + rolling MAE/bias aggregate"
```

---

## Task 3: Backfill script

**Files:**
- Create: `scripts/backfill_leadtime.py`

- [ ] **Step 1: Implement** (idempotent — follows `backfill_bucket_low.py`)

```python
# scripts/backfill_leadtime.py
#!/usr/bin/env python3
"""Backfill lead-time scoring across all history, then rebuild the aggregate."""
import sys, glob, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from leadtime import build_leadtime, build_leadtime_scores, DATA_DIR

def main():
    dates = sorted(os.path.basename(f)[:-5] for f in glob.glob(str(DATA_DIR / "actuals" / "*.json")))
    built = 0
    for d in dates:
        if build_leadtime(d):
            built += 1
    agg = build_leadtime_scores()
    n_cells = sum(len(v) for v in agg["by_source"].values())
    print(f"backfilled {built}/{len(dates)} dates; aggregate has {n_cells} source×lead cells")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python scripts/backfill_leadtime.py`
Expected: `backfilled N/N dates; aggregate has M source×lead cells`. Sanity-check `data/leadtime_scores.json`: Open-Meteo `high_mae` rises with lead (≈1.9→3.8), Ray's stays ~7 and > free at every lead, no nulls where n>0.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill_leadtime.py data/leadtime data/leadtime_scores.json
git commit -m "feat(leadtime): backfill across full history + build aggregate"
```

---

## Task 4: TS types + loader + decay chart

**Files:**
- Create: `src/lib/leadtime.ts`
- Create: `src/lib/__tests__/leadtime.test.ts`
- Create: `src/components/AccuracyDecayChart.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/leadtime.test.ts
import { describe, it, expect } from "vitest";
import { toChartSeries } from "@/lib/leadtime";

describe("toChartSeries", () => {
  it("emits one series per source with (lead, mae) points, skipping null cells", () => {
    const scores = { location: "Boone", max_lead: 5, by_source: {
      openmeteo: { "0": { n: 5, high_mae: 1.9 }, "1": { n: 5, high_mae: 2.8 } },
      raysweather: { "0": { n: 5, high_mae: 7.1 }, "1": { n: 0, high_mae: null } },
    } } as any;
    const series = toChartSeries(scores, "high_mae");
    const om = series.find((s) => s.source === "openmeteo")!;
    expect(om.points).toEqual([{ lead: 0, value: 1.9 }, { lead: 1, value: 2.8 }]);
    const ray = series.find((s) => s.source === "raysweather")!;
    expect(ray.points).toEqual([{ lead: 0, value: 7.1 }]); // null cell dropped
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm test -- src/lib/__tests__/leadtime.test.ts` → FAIL.

- [ ] **Step 3: Implement the lib**

```ts
// src/lib/leadtime.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");

export type LeadCell = { n: number; avg_score?: number | null; high_mae?: number | null;
  low_mae?: number | null; high_bias?: number | null; low_bias?: number | null };
export type LeadtimeScores = { location: string; max_lead: number;
  by_source: Record<string, Record<string, LeadCell>> };

export async function getLeadtimeScores(): Promise<LeadtimeScores | null> {
  try { return JSON.parse(await readFile(join(DATA, "leadtime_scores.json"), "utf8")); }
  catch { return null; }
}

export type ChartSeries = { source: string; points: { lead: number; value: number }[] };

export function toChartSeries(scores: LeadtimeScores, metric: keyof LeadCell): ChartSeries[] {
  return Object.entries(scores.by_source).map(([source, byLead]) => ({
    source,
    points: Object.entries(byLead)
      .map(([lead, cell]) => ({ lead: Number(lead), value: cell[metric] as number | null | undefined }))
      .filter((p): p is { lead: number; value: number } => typeof p.value === "number")
      .sort((a, b) => a.lead - b.lead),
  }));
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- src/lib/__tests__/leadtime.test.ts` → PASS.

- [ ] **Step 5: Build the chart** (visx; follow `src/components/TrendChartInteractive.tsx` for the visx idiom already used in this repo — axis scales, `@visx/shape` `LinePath`, responsive wrapper). Render one `LinePath` per series over an x-axis of lead 0–5, y-axis = MAE °F; label the free sources green and Ray's orange (the site's data/brand palette from M2). Add a caption noting the thinning past lead 3.

- [ ] **Step 6: Commit**

```bash
git add src/lib/leadtime.ts src/lib/__tests__/leadtime.test.ts src/components/AccuracyDecayChart.tsx
git commit -m "feat(leadtime): TS loader + toChartSeries + visx accuracy-decay chart"
```

---

## Task 5: Surface on `/right-wrong-ray` + methodology + pipeline wiring

**Files:**
- Modify: `src/app/right-wrong-ray/page.tsx` (load `getLeadtimeScores()`, mount `<AccuracyDecayChart>` in a new "How accuracy decays with lead time" section; gate the section on having ≥ some scored days using the existing `src/lib/gating.ts` pattern)
- Modify: `src/app/methodology/page.tsx` (add the lead-time + bias disclosure: 5-day ceiling with thinning past lead 3; Ray +3.5°F warm / graded at 3,240 ft; the R5 actuals-independence note)
- Modify: `.github/workflows/daily_compare.yml` (after `compare.py`: `python scripts/leadtime.py`-equivalent — actually add a tiny `daily_leadtime.py` or call `build_leadtime` + `build_leadtime_scores` for the target date)

- [ ] **Step 1: Add a `__main__` to `leadtime.py`** that builds the just-compared date + rebuilds the aggregate:

```python
# append to scripts/leadtime.py
if __name__ == "__main__":
    import sys
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    target = sys.argv[1] if len(sys.argv) > 1 else (
        datetime.now(ZoneInfo("America/New_York")) - timedelta(days=1)).strftime("%Y-%m-%d")
    build_leadtime(target)
    build_leadtime_scores()
    print(f"leadtime updated for {target}")
```

- [ ] **Step 2:** Add `python scripts/leadtime.py` to `daily_compare.yml` after the compare step (before the commit step), so `data/leadtime*` travel with each daily commit.
- [ ] **Step 3:** Mount the chart section on `/right-wrong-ray` and add the methodology copy.
- [ ] **Step 4: Verify** — `python -m pytest tests/test_leadtime.py -q && npm test && npm run lint && npm run build` all green; `/right-wrong-ray` renders the decay chart; `/methodology` shows the disclosure. Confirm existing single-day scoreboard numbers are unchanged (additive only).
- [ ] **Step 5: Commit**

```bash
git add scripts/leadtime.py .github/workflows/daily_compare.yml src/app/right-wrong-ray/page.tsx src/app/methodology/page.tsx
git commit -m "feat(leadtime): surface accuracy-decay chart on /right-wrong-ray + methodology disclosure + daily wiring"
```

---

## Self-Review

- **Spec coverage:** indexing (§4.1) = Task 1; artifacts (§4.2) = Tasks 2–3; location key (§4.3) = `LOCATION` const; same-model + MAE track (§5) = Tasks 1–2; capture-day-low lead-0-only (§5) = Task 1 branch; backfill + daily (§7) = Tasks 3, 5; consistency guard (§9) = Task 1 test; chart + bias disclosure (§8) = Tasks 4–5. ✔
- **Placeholders:** none in the pure logic; the one flagged unknown (exact `SOURCE_FILES` keys / source-name strings) is an explicit executor verification step against real capture files, not a hidden gap. ✔
- **Type consistency:** `high_mae`/`low_mae`/`high_bias`/`avg_score`/`n` identical across `_aggregate_rows` (Python) and `LeadCell` (TS); `by_source`/`max_lead`/`location` match Python output → `LeadtimeScores`. `score_lead` return keys (`high_err`/`high_bias`) match what `_aggregate_rows` reads. ✔
- **No scoreboard regression:** lead-time is additive (new files, new section); Task 1's lead-0≡comparison test + Task 5's "unchanged numbers" check guard it. ✔
