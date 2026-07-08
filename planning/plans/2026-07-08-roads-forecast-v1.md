# Winter Road-Condition Forecast (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/roads` — a scored winter road-condition *forecast* ("will the roads be bad tomorrow morning?") plus live incidents/closures for the NC High Country, reusing the snow/ice/temp data the pipeline already captures.

**Architecture:** Python stdlib pipeline (mirrors `capture_openmeteo.py`/`compare.py`): a pure rubric turns the existing Open-Meteo forecast into a road-surface verdict → written to `data/roads_forecast.json`; a new capture pulls NCDOT DriveNC snow&ice + incidents + NPS Blue Ridge Parkway alerts → `data/road_conditions/{date}.json` (serves both live display and the scoring actual); a pure scorer compares verdict vs. actual → `data/road_scores.json`. Next.js `/roads` reads those JSON files via `src/lib/roads.ts` and renders forecast + live conditions + a Right/Wrong-style scoreboard.

**Tech Stack:** Python 3 stdlib (`urllib`, `json`, `zoneinfo`); pytest; Next.js 16 App Router + TypeScript; vitest. Free API keys: `DRIVENC_KEY`, `NPS_KEY` (env / GitHub secrets).

**Design source:** `planning/specs/2026-07-08-traffic-road-forecast-design.md` (owner-approved: v1-first, own `/roads` product, build v3 cameras later). This plan covers **v1 only**; v2 (traffic forecast), v3 (camera-CV), v4 (parking) are in the Roadmap section at the end.

**Seasonality note:** built in July → the surface-risk forecast + scoring go live but only *exercise* in winter; the incidents/closures half is useful year-round. Plan is written so nothing waits for winter to be testable (rubric + scorer are pure and tested against fixtures).

---

## File Structure

- `scripts/roads.py` — **NEW.** Pure logic: `road_condition_forecast(day)` (rubric → verdict) and `score_road_forecast(forecast_level, actual_level)` (ordinal scorer). No I/O beyond a `__main__` that reads the latest Open-Meteo prediction and writes `data/roads_forecast.json`.
- `scripts/capture_roads.py` — **NEW.** Fetches DriveNC `event` + `snowandice` + NPS `blri` alerts → `data/road_conditions/{date}.json`. Mirrors `capture_openmeteo.py` I/O.
- `scripts/compare_roads.py` — **NEW.** For a target date: read that day's forecast level (from the prior day's `roads_forecast.json` archive) + the captured actual → score → update `data/road_scores.json`.
- `tests/test_roads.py` — **NEW.** pytest for the rubric + scorer (pure, fixture-driven).
- `data/roads_forecast.json` — **NEW (generated).** Latest road-surface forecast (today + tomorrow + next days).
- `data/road_conditions/{date}.json` — **NEW (generated).** Captured conditions per day (live display + scoring actual).
- `data/road_scores.json` — **NEW (generated).** Running road-forecast scoreboard.
- `src/lib/roads.ts` — **NEW.** Types + loaders (`getRoadsForecast()`, `getLatestRoadConditions()`, `getRoadScores()`) following `src/lib/data.ts`.
- `src/lib/__tests__/roads.test.ts` — **NEW.** vitest for any render-time TS helpers (verdict → label/color).
- `src/app/roads/page.tsx` — **NEW.** The `/roads` route.
- `src/components/RoadConditions.tsx` — **NEW.** Presentational block (forecast card + live-conditions list + scoreboard).
- Modify: `src/components/SiteHeader.tsx` (nav entry), `src/app/sitemap.ts` (add `/roads`), `src/app/methodology/page.tsx` (road-scoring rubric disclosure), `.github/workflows/daily_capture.yml` + `daily_compare.yml` (wire the new steps).

---

## Task 1: Road-condition forecast rubric (pure)

**Files:**
- Create: `scripts/roads.py`
- Test: `tests/test_roads.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_roads.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from roads import road_condition_forecast, LEVELS

def fc(**kw):
    base = {"low_f": 40, "high_f": 55, "snow_in": 0.0, "rain_in": 0.0, "precip_type": "none"}
    base.update(kw); return base

def test_dry_warm_is_clear():
    r = road_condition_forecast(fc())
    assert r["level"] == "Clear"

def test_plain_rain_above_freezing_is_wet():
    r = road_condition_forecast(fc(rain_in=0.3, low_f=40, precip_type="rain"))
    assert r["level"] == "Wet"

def test_light_snow_near_freezing_is_slushy():
    r = road_condition_forecast(fc(snow_in=0.6, low_f=32, precip_type="snow"))
    assert r["level"] == "Slushy"

def test_cold_wet_refreeze_is_icy():
    r = road_condition_forecast(fc(rain_in=0.2, low_f=28, precip_type="rain"))
    assert r["level"] == "Icy"

def test_heavy_snow_is_hazardous():
    r = road_condition_forecast(fc(snow_in=3.0, low_f=25, precip_type="snow"))
    assert r["level"] == "Hazardous"

def test_freezing_rain_is_hazardous():
    # rain falling into sub-freezing air = the worst case
    r = road_condition_forecast(fc(rain_in=0.15, low_f=30, precip_type="rain", freezing=True))
    assert r["level"] == "Hazardous"

def test_reason_and_risk_present():
    r = road_condition_forecast(fc(snow_in=3.0, low_f=25))
    assert isinstance(r["reason"], str) and r["reason"]
    assert 0 <= r["risk"] <= 100
    assert r["level"] in LEVELS
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_roads.py -q`
Expected: FAIL (`ModuleNotFoundError: No module named 'roads'`).

- [ ] **Step 3: Implement the rubric**

```python
# scripts/roads.py
#!/usr/bin/env python3
"""roads.py — winter road-condition forecast rubric + scorer (pure logic).

Turns the existing Open-Meteo forecast (low/high/snow/rain/precip_type) into a
road-surface verdict. Thresholds live in RUBRIC so the /methodology page can
render the exact numbers the code runs (same pattern as the fireworks rubric).
"""
from __future__ import annotations

# Ordinal severity, best -> worst. Index IS the severity (used by the scorer).
LEVELS = ["Clear", "Wet", "Slushy", "Icy", "Hazardous"]

RUBRIC = {
    "hazard_snow_in": 2.0,      # >= this much forecast snow -> Hazardous
    "icy_snow_in": 0.5,         # >= this much snow (cold) -> at least Icy
    "slushy_snow_in": 0.1,      # any real snow near freezing -> Slushy
    "refreeze_low_f": 30.0,     # wet AND at/below this -> Icy (refreeze)
    "freezing_f": 32.0,         # precip at/below this is frozen/mixed
    "wet_rain_in": 0.1,         # >= this much rain (warm) -> Wet
}


def road_condition_forecast(day: dict) -> dict:
    """day: {low_f, high_f, snow_in, rain_in, precip_type, freezing?} -> verdict."""
    low = day.get("low_f")
    snow = day.get("snow_in") or 0.0
    rain = day.get("rain_in") or 0.0
    freezing_rain = bool(day.get("freezing")) or (
        rain > 0 and low is not None and low <= RUBRIC["freezing_f"] and (snow or 0) == 0
    )
    R = RUBRIC

    if freezing_rain or snow >= R["hazard_snow_in"]:
        level, reason = "Hazardous", _reason_hazard(snow, freezing_rain, low)
    elif snow >= R["icy_snow_in"] or (
        low is not None and low <= R["refreeze_low_f"] and (rain > 0 or snow > 0)
    ):
        level, reason = "Icy", _reason_icy(snow, rain, low)
    elif snow >= R["slushy_snow_in"]:
        level, reason = "Slushy", f"About {snow:.1f} in of snow near freezing means slush and wet lanes."
    elif rain >= R["wet_rain_in"]:
        level, reason = "Wet", f"Around {rain:.1f} in of rain; wet roads, no freezing expected."
    else:
        level, reason = "Clear", "Dry or only trace precipitation; roads expected clear."

    risk = int(round(100 * LEVELS.index(level) / (len(LEVELS) - 1)))
    return {"level": level, "reason": reason, "risk": risk}


def _reason_hazard(snow, freezing_rain, low):
    if freezing_rain:
        return f"Rain into sub-freezing air (low ~{low:.0f}°F): freezing rain / black-ice risk."
    return f"Heavy snow (~{snow:.1f} in) forecast; expect covered, hazardous roads."


def _reason_icy(snow, rain, low):
    if snow:
        return f"About {snow:.1f} in of snow with a low near {low:.0f}°F; icy patches likely."
    return f"Wet roads with a low near {low:.0f}°F; refreeze / black-ice risk overnight."
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_roads.py -q`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/roads.py tests/test_roads.py
git commit -m "feat(roads): road-condition forecast rubric (pure, tested)"
```

---

## Task 2: Road-condition scorer (pure)

**Files:**
- Modify: `scripts/roads.py` (add `score_road_forecast`)
- Modify: `tests/test_roads.py` (add scorer tests)

- [ ] **Step 1: Write the failing tests**

```python
# append to tests/test_roads.py
from roads import score_road_forecast

def test_exact_match_full_score():
    assert score_road_forecast("Icy", "Icy")["score"] == 100

def test_adjacent_partial_score():
    s = score_road_forecast("Icy", "Slushy")["score"]  # off by one level
    assert 50 <= s < 100

def test_far_miss_low_score():
    s = score_road_forecast("Clear", "Hazardous")["score"]  # off by four
    assert s == 0

def test_score_is_symmetric():
    assert score_road_forecast("Wet", "Icy")["score"] == score_road_forecast("Icy", "Wet")["score"]
```

- [ ] **Step 2: Run to verify fail**

Run: `python -m pytest tests/test_roads.py -q`
Expected: FAIL (`cannot import name 'score_road_forecast'`).

- [ ] **Step 3: Implement the scorer**

```python
# append to scripts/roads.py
def score_road_forecast(forecast_level: str, actual_level: str) -> dict:
    """Ordinal accuracy: exact = 100, each level of distance costs 25 pts."""
    fi, ai = LEVELS.index(forecast_level), LEVELS.index(actual_level)
    distance = abs(fi - ai)
    score = max(0, 100 - 25 * distance)
    return {"score": score, "distance": distance,
            "forecast": forecast_level, "actual": actual_level}
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/test_roads.py -q`
Expected: PASS (11 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/roads.py tests/test_roads.py
git commit -m "feat(roads): ordinal road-forecast scorer (pure, tested)"
```

---

## Task 3: Daily forecast writer (`roads.py __main__`)

**Files:**
- Modify: `scripts/roads.py` (add `__main__` that reads the latest Open-Meteo prediction and writes `data/roads_forecast.json`)

- [ ] **Step 1: Implement the writer** (I/O; verified by running, not a unit test)

Read the newest `data/predictions/{date}/openmeteo_forecast.json` (same shape confirmed in the repo: `daily[]` rows with `low_f`, `high_f`, `snow_in`, `rain_in`, `precip_type`). Emit a verdict per day.

```python
# append to scripts/roads.py
import json, sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

EST = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def _latest_openmeteo():
    pred = DATA_DIR / "predictions"
    days = sorted(d for d in pred.iterdir() if d.is_dir())
    for d in reversed(days):
        f = d / "openmeteo_forecast.json"
        if f.exists():
            return json.loads(f.read_text())
    return None


def write_forecast():
    om = _latest_openmeteo()
    if not om:
        print("no openmeteo forecast found; skipping"); return
    out = {
        "generated_at": datetime.now(EST).isoformat(),
        "location": "Boone",
        "rubric": RUBRIC,
        "days": [
            {"date": row.get("date"), **road_condition_forecast(row)}
            for row in om.get("daily", [])
        ],
    }
    (DATA_DIR / "roads_forecast.json").write_text(json.dumps(out, indent=2))
    print(f"wrote roads_forecast.json ({len(out['days'])} days)")


if __name__ == "__main__":
    write_forecast()
```

- [ ] **Step 2: Run it against real data**

Run: `python scripts/roads.py`
Expected: prints `wrote roads_forecast.json (7 days)`; `data/roads_forecast.json` exists with a `days[]` array whose entries have `level`/`reason`/`risk`.

- [ ] **Step 3: Commit**

```bash
git add scripts/roads.py data/roads_forecast.json
git commit -m "feat(roads): write daily road-condition forecast from Open-Meteo"
```

---

## Task 4: Capture live/actual road conditions (`capture_roads.py`)

**Files:**
- Create: `scripts/capture_roads.py`

**⚠️ Executor note:** request free keys first (DriveNC developer account → `DRIVENC_KEY`; developer.nps.gov → `NPS_KEY`). Then **verify the live JSON field names** with a keyed call before finalizing the parser — the exact keys below (`Reason`, `Condition`, `Road`, `County`, `StartDate`) are best-effort from research and must be confirmed against `https://drivenc.gov/help/endpoint/event`. Filter to Watauga/Avery/Ashe by county.

- [ ] **Step 1: Implement the capture** (mirror `capture_openmeteo.py` I/O; fail *soft* — a missing key writes an empty-but-valid file rather than crashing the pipeline)

```python
# scripts/capture_roads.py
#!/usr/bin/env python3
"""capture_roads.py — NCDOT DriveNC (incidents + snow&ice) + NPS Parkway alerts
for the High Country -> data/road_conditions/{date}.json (live display + scoring actual)."""
import json, os, sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.request import urlopen, Request
from urllib.error import URLError

EST = ZoneInfo("America/New_York")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
COUNTIES = {"WATAUGA", "AVERY", "ASHE"}
DRIVENC_KEY = os.environ.get("DRIVENC_KEY", "")
NPS_KEY = os.environ.get("NPS_KEY", "")

def _get(url):
    try:
        with urlopen(Request(url, headers={"User-Agent": "DavesSweater/1.0"}), timeout=20) as r:
            return json.loads(r.read().decode())
    except (URLError, ValueError) as e:
        print(f"  WARN fetch {url}: {e}"); return None

def capture():
    today = datetime.now(EST).strftime("%Y-%m-%d")
    out = {"captured_at": datetime.now(EST).isoformat(), "date": today,
           "incidents": [], "snow_and_ice": [], "parkway_alerts": [], "worst_actual_level": "Clear"}

    if DRIVENC_KEY:
        ev = _get(f"https://www.drivenc.gov/api/v2/get/event?key={DRIVENC_KEY}") or []
        out["incidents"] = [_norm_event(e) for e in (ev if isinstance(ev, list) else ev.get("data", []))
                            if str(e.get("County", "")).upper() in COUNTIES]
        si = _get(f"https://www.drivenc.gov/api/v2/get/snowandice?key={DRIVENC_KEY}") or []
        out["snow_and_ice"] = [_norm_snow(s) for s in (si if isinstance(si, list) else si.get("data", []))
                               if str(s.get("County", "")).upper() in COUNTIES]
    else:
        print("  NOTE: DRIVENC_KEY unset — writing empty DriveNC sections")

    if NPS_KEY:
        al = _get(f"https://developer.nps.gov/api/v1/alerts?parkCode=blri&api_key={NPS_KEY}")
        out["parkway_alerts"] = [{"title": a.get("title"), "category": a.get("category"),
                                  "description": a.get("description")}
                                 for a in ((al or {}).get("data", []))]

    out["worst_actual_level"] = _worst_level(out["snow_and_ice"])
    d = DATA_DIR / "road_conditions"; d.mkdir(parents=True, exist_ok=True)
    (d / f"{today}.json").write_text(json.dumps(out, indent=2))
    print(f"wrote road_conditions/{today}.json "
          f"({len(out['incidents'])} incidents, worst={out['worst_actual_level']})")

def _norm_event(e):
    return {"road": e.get("Road") or e.get("RoadwayName"), "reason": e.get("Reason") or e.get("Description"),
            "severity": e.get("Severity"), "county": e.get("County"), "closed": bool(e.get("RoadClosed"))}

def _norm_snow(s):
    return {"road": s.get("Road") or s.get("RoadwayName"), "condition": s.get("Condition"), "county": s.get("County")}

def _worst_level(snow_rows):
    """Map DriveNC snow&ice condition text -> our LEVELS. Verify exact strings against live data."""
    text = " ".join(str(r.get("condition", "")).lower() for r in snow_rows)
    if any(w in text for w in ("closed", "impassable", "severe")): return "Hazardous"
    if "ice" in text or "icy" in text or "black ice" in text:      return "Icy"
    if "snow" in text or "slush" in text:                          return "Slushy"
    if "wet" in text:                                              return "Wet"
    return "Clear"

if __name__ == "__main__":
    capture()
```

- [ ] **Step 2: Run it (works even with no keys — writes a valid empty file)**

Run: `python scripts/capture_roads.py`
Expected (no keys): prints the NOTE + `wrote road_conditions/{today}.json (0 incidents, worst=Clear)`. With keys set, confirm real rows and re-check field names.

- [ ] **Step 3: Commit**

```bash
git add scripts/capture_roads.py data/road_conditions/
git commit -m "feat(roads): capture DriveNC + NPS Parkway road conditions (fail-soft)"
```

---

## Task 5: Score a day (`compare_roads.py`)

**Files:**
- Create: `scripts/compare_roads.py`

The forecast level for date D was written the *prior* day. Since `roads_forecast.json` is overwritten daily, archive the day-D-for-D verdict when capturing (simplest: `compare_roads.py` re-derives the forecast for D from `predictions/{D-1}/openmeteo_forecast.json` using the same rubric — no new storage, mirrors how `compare.py` reads prior predictions).

- [ ] **Step 1: Implement**

```python
# scripts/compare_roads.py
#!/usr/bin/env python3
"""compare_roads.py — score the road-condition forecast for a date vs the captured actual."""
import json, sys
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from roads import road_condition_forecast, score_road_forecast

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def forecast_level_for(target: str) -> str | None:
    prior = (date.fromisoformat(target) - timedelta(days=1)).isoformat()
    f = DATA_DIR / "predictions" / prior / "openmeteo_forecast.json"
    if not f.exists(): return None
    for row in json.loads(f.read_text()).get("daily", []):
        if row.get("date") == target:
            return road_condition_forecast(row)["level"]
    return None

def compare(target: str):
    actual_f = DATA_DIR / "road_conditions" / f"{target}.json"
    if not actual_f.exists(): print(f"no actual for {target}"); return
    actual = json.loads(actual_f.read_text()).get("worst_actual_level", "Clear")
    fl = forecast_level_for(target)
    if fl is None: print(f"no forecast for {target}"); return
    result = {"date": target, **score_road_forecast(fl, actual)}
    scores_f = DATA_DIR / "road_scores.json"
    scores = json.loads(scores_f.read_text()) if scores_f.exists() else {"days": []}
    scores["days"] = [d for d in scores["days"] if d["date"] != target] + [result]
    scores["days"].sort(key=lambda d: d["date"])
    n = len(scores["days"])
    scores["average"] = round(sum(d["score"] for d in scores["days"]) / n, 1) if n else None
    scores_f.write_text(json.dumps(scores, indent=2))
    print(f"scored {target}: forecast={fl} actual={actual} score={result['score']}")

if __name__ == "__main__":
    compare(sys.argv[1] if len(sys.argv) > 1 else (date.today() - timedelta(days=1)).isoformat())
```

- [ ] **Step 2: Run (needs a captured actual + a prior prediction; otherwise prints a clean skip)**

Run: `python scripts/compare_roads.py 2026-01-15`
Expected: a skip message if no data, or `scored … score=NN` when data exists.

- [ ] **Step 3: Commit**

```bash
git add scripts/compare_roads.py data/road_scores.json
git commit -m "feat(roads): score road-condition forecast vs captured actual"
```

---

## Task 6: TS types + loaders (`src/lib/roads.ts`)

**Files:**
- Create: `src/lib/roads.ts`
- Create: `src/lib/__tests__/roads.test.ts`

- [ ] **Step 1: Write the failing test** (pure helper — verdict → display)

```ts
// src/lib/__tests__/roads.test.ts
import { describe, it, expect } from "vitest";
import { levelDisplay } from "@/lib/roads";

describe("levelDisplay", () => {
  it("maps each level to a label + tone", () => {
    expect(levelDisplay("Hazardous").tone).toBe("bad");
    expect(levelDisplay("Clear").tone).toBe("good");
    expect(levelDisplay("Icy").label).toBe("Icy");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/lib/__tests__/roads.test.ts`
Expected: FAIL (cannot resolve `@/lib/roads`).

- [ ] **Step 3: Implement**

```ts
// src/lib/roads.ts
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");
async function readJson<T>(p: string): Promise<T | null> {
  try { return JSON.parse(await readFile(p, "utf8")) as T; } catch { return null; }
}

export type RoadLevel = "Clear" | "Wet" | "Slushy" | "Icy" | "Hazardous";
export type RoadDay = { date: string; level: RoadLevel; reason: string; risk: number };
export type RoadsForecast = { generated_at: string; location: string; days: RoadDay[]; rubric: Record<string, number> };
export type RoadConditions = {
  captured_at: string; date: string;
  incidents: { road: string; reason: string; severity?: string; county: string; closed: boolean }[];
  snow_and_ice: { road: string; condition: string; county: string }[];
  parkway_alerts: { title: string; category: string; description: string }[];
  worst_actual_level: RoadLevel;
};
export type RoadScores = { days: { date: string; score: number; forecast: RoadLevel; actual: RoadLevel }[]; average: number | null };

export async function getRoadsForecast() { return readJson<RoadsForecast>(join(DATA, "roads_forecast.json")); }
export async function getRoadScores() { return readJson<RoadScores>(join(DATA, "road_scores.json")); }
export async function getLatestRoadConditions(): Promise<RoadConditions | null> {
  const dir = join(DATA, "road_conditions");
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  return files.length ? readJson<RoadConditions>(join(dir, files[files.length - 1])) : null;
}

const TONES: Record<RoadLevel, "good" | "warn" | "bad"> = {
  Clear: "good", Wet: "warn", Slushy: "warn", Icy: "bad", Hazardous: "bad",
};
export function levelDisplay(level: RoadLevel) { return { label: level, tone: TONES[level] }; }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/__tests__/roads.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roads.ts src/lib/__tests__/roads.test.ts
git commit -m "feat(roads): TS types + loaders + level display helper"
```

---

## Task 7: `/roads` page + component + nav + sitemap

**Files:**
- Create: `src/app/roads/page.tsx`
- Create: `src/components/RoadConditions.tsx`
- Modify: `src/components/SiteHeader.tsx` (add a Roads nav link — follow the existing Resources/Today link pattern)
- Modify: `src/app/sitemap.ts` (append `/roads`)

- [ ] **Step 1: Build the component** (presentational; follows existing component style — Tailwind, server component)

```tsx
// src/components/RoadConditions.tsx
import { levelDisplay, type RoadsForecast, type RoadConditions, type RoadScores } from "@/lib/roads";

const TONE_CLASS = { good: "text-emerald-600", warn: "text-amber-600", bad: "text-red-600" } as const;

export function RoadConditionsBlock({ forecast, conditions, scores }: {
  forecast: RoadsForecast | null; conditions: RoadConditions | null; scores: RoadScores | null;
}) {
  const tomorrow = forecast?.days?.[1] ?? forecast?.days?.[0];
  return (
    <div className="space-y-8">
      {tomorrow && (
        <section>
          <h2 className="text-2xl font-semibold">Tomorrow&apos;s road-condition forecast</h2>
          <p className={`text-3xl font-bold ${TONE_CLASS[levelDisplay(tomorrow.level).tone]}`}>{tomorrow.level}</p>
          <p className="text-slate-600">{tomorrow.reason}</p>
        </section>
      )}
      {conditions && (
        <section>
          <h2 className="text-2xl font-semibold">Current conditions
            <span className="ml-2 text-sm font-normal text-slate-500">
              as of {new Date(conditions.captured_at).toLocaleString()}</span>
          </h2>
          {conditions.incidents.length === 0 && conditions.parkway_alerts.length === 0
            ? <p className="text-slate-600">No active incidents or Parkway closures reported.</p>
            : <ul className="list-disc pl-5">
                {conditions.incidents.map((i, k) => <li key={`i${k}`}>{i.road}: {i.reason}{i.closed ? " (CLOSED)" : ""}</li>)}
                {conditions.parkway_alerts.map((a, k) => <li key={`p${k}`}>Blue Ridge Parkway — {a.title}</li>)}
              </ul>}
          <p className="mt-2 text-sm text-slate-500">Real-time: <a className="underline" rel="nofollow"
            href="https://drivenc.gov">DriveNC.gov</a>.</p>
        </section>
      )}
      {scores?.average != null && (
        <section>
          <h2 className="text-2xl font-semibold">How our road forecast is scoring</h2>
          <p>Average accuracy so far: <strong>{scores.average}/100</strong> over {scores.days.length} scored days.</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build the route** (server component; mirror an existing route like `src/app/methodology/page.tsx` for metadata/layout shell)

```tsx
// src/app/roads/page.tsx
import type { Metadata } from "next";
import { getRoadsForecast, getLatestRoadConditions, getRoadScores } from "@/lib/roads";
import { RoadConditionsBlock } from "@/components/RoadConditions";

export const metadata: Metadata = {
  title: "Boone road conditions & winter road forecast | Dave's Sweater",
  description: "Will the roads be bad tomorrow morning? A scored winter road-condition forecast plus live incidents and Blue Ridge Parkway closures for Boone and the NC High Country.",
  alternates: { canonical: "/roads" },
};

export default async function RoadsPage() {
  const [forecast, conditions, scores] = await Promise.all([
    getRoadsForecast(), getLatestRoadConditions(), getRoadScores(),
  ]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">High Country road conditions</h1>
      <p className="mt-2 text-slate-600">Will the roads be bad tomorrow? We forecast it — then check ourselves.</p>
      <div className="mt-8"><RoadConditionsBlock forecast={forecast} conditions={conditions} scores={scores} /></div>
    </main>
  );
}
```

- [ ] **Step 3: Add nav + sitemap**

In `src/components/SiteHeader.tsx`, add a nav link to `/roads` labeled "Roads" following the existing link markup. In `src/app/sitemap.ts`, append an entry for `/roads` (copy the shape of an existing static route entry).

- [ ] **Step 4: Verify build + render**

Run: `npm run test && npm run lint && npm run build`
Expected: all green; `.next/server/app/roads.html` produced. Then start the dev server (via the preview tooling) and confirm `/roads` renders the forecast + "no active incidents" empty state.

- [ ] **Step 5: Commit**

```bash
git add src/app/roads src/components/RoadConditions.tsx src/components/SiteHeader.tsx src/app/sitemap.ts
git commit -m "feat(roads): /roads page with forecast, live conditions, scoreboard + nav/sitemap"
```

---

## Task 8: Pipeline wiring + methodology disclosure

**Files:**
- Modify: `.github/workflows/daily_capture.yml` (add `python scripts/roads.py` after the Open-Meteo capture; add `python scripts/capture_roads.py` with `DRIVENC_KEY`/`NPS_KEY` from secrets)
- Modify: `.github/workflows/daily_compare.yml` (add `python scripts/compare_roads.py` after `compare.py`)
- Modify: `src/app/methodology/page.tsx` (add a "Road-condition forecast" section rendering the `LEVELS` + `RUBRIC` thresholds and the ordinal scoring, same transparent style as the weather rubric)

- [ ] **Step 1:** Add the capture/forecast steps to `daily_capture.yml` (after the existing Open-Meteo step), passing `DRIVENC_KEY: ${{ secrets.DRIVENC_KEY }}` and `NPS_KEY: ${{ secrets.NPS_KEY }}` as `env:`. Commit `data/` as the workflow already does.
- [ ] **Step 2:** Add `python scripts/compare_roads.py` to `daily_compare.yml` after the weather compare step.
- [ ] **Step 3:** Add the methodology section (read `LEVELS`/`RUBRIC` values into copy; disclose the actuals source = DriveNC snow&ice, and the self-judging softness resolved later by v3 cameras — mirror the existing Open-Meteo-archive disclosure).
- [ ] **Step 4: Verify + commit**

Run: `npm run build` (methodology renders); confirm the two workflow YAMLs are valid.
```bash
git add .github/workflows/daily_capture.yml .github/workflows/daily_compare.yml src/app/methodology/page.tsx
git commit -m "feat(roads): wire road capture/forecast/score into daily pipeline + methodology"
```

---

## Roadmap (later phases — separate plans)

- **v2 — Traffic forecast.** Predict corridor congestion/travel-time from App State ICS + festival/leaf/ski calendar + weather; grade against TomTom live speed (free tier) and Google's predicted ETA. New `scripts/capture_traffic.py`, `scripts/forecast_traffic.py`, a Brier/MAE scorer, `/traffic` + a Right/Wrong-style scoreboard. Reuses this plan's capture/score/loader patterns.
- **v3 — Camera-CV ground truth.** Edge Raspberry Pi 5 + Hailo running Frigate → ByteTrack → congestion level, posting `data/actuals`-style readings; ~$150/site, 2–3 chokepoint sites (double as backlink cams). Replaces the traffic API as the graded actual (Ecowitt arc).
- **v4 — Parking indicators.** Camera-occupancy (rides on v3 cameras) + owner-pursued meter/ticket/tow data → a "downtown full" index + forecast. See design §2a.

---

## Self-Review

- **Spec coverage:** v1 (road-condition forecast, own `/roads`, scored) fully covered by Tasks 1–8; grading model (ordinal, transparent, disclosed) = Tasks 2/8; free data stack (DriveNC + NPS) = Task 4; v2/v3/v4 = Roadmap. ✔
- **Placeholders:** none — pure logic has complete code/tests; the one genuine unknown (exact DriveNC field names) is explicitly flagged as an executor verification step against the live keyed API, not hidden. ✔
- **Type consistency:** `LEVELS`/`level`/`risk`/`reason` consistent Python↔TS; `RoadLevel` union matches `LEVELS`; `worst_actual_level`/`score`/`average` names match across `capture_roads.py`, `compare_roads.py`, and `roads.ts`. ✔
- **Seasonality:** rubric + scorer are fixture-tested (no winter needed to verify); live incidents useful year-round; scoring simply accrues once winter actuals arrive. ✔
