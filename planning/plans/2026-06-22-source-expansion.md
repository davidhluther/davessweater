# Source Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 free, automatable forecasters behind a source-registry/adapter pattern and rework `compare.py` scoring into the coupled, snow-aware, transparent model from the spec — pipeline/scoring only (M3 visualizes it).

**Architecture:** Extract scoring into a pure, pytest-tested `scripts/scoring.py` (the coupled model: fixed 100-pt denominator, precip = type 10 + amount 10 scored in the right unit, tolerance bands, omission-forfeit, coverage). Each new source is a stdlib-only adapter under `scripts/sources/` returning a **normalized daily prediction** dict; a registry drives a `capture_sources.py` runner (skips keyed sources whose env key is absent) and a uniform ingestion loop in `compare.py`. Actuals + forecasts split precip into rain (liquid) + snow (depth). Backward-compatible: `score`/`grade`/`totals` keys and `precip_in` are preserved so the M2 site still renders; numbers change (season re-scored).

**Tech Stack:** Python 3.12 stdlib only at runtime (`urllib`, `json`) — no pip deps in capture/compare; **pytest** for tests (dev/CI only). Reference: `planning/specs/2026-06-22-source-expansion-design.md`.

**Standing rules:** capture scripts must stay stdlib-only (run in Actions with no `pip install`). Never print API keys or request URLs. Keys come from `os.environ`; absent key ⇒ skip that source, never fail the run.

---

## Normalized daily prediction (the contract every adapter returns)

```python
# one dict per forecast day
{
  "date": "YYYY-MM-DD",
  "high_f": float | None,
  "low_f": float | None,
  "wind_mph": float | None,
  "precip_type": "none" | "rain" | "snow" | "mixed" | None,  # the source's call
  "rain_in": float | None,    # liquid inches
  "snow_in": float | None,    # snow DEPTH inches
  "fields_provided": [ ... ], # subset of: "high","low","wind","precip_type","rain_amount","snow_amount"
}
```
`fields_provided` is authoritative for scoring (forfeit anything absent) and for the coverage index.

## File structure

**Create:**
- `scripts/scoring.py` — pure scoring engine (coupled model) + helpers. Imported by `compare.py`.
- `scripts/sources/__init__.py` — `SOURCES` registry + shared normalize helpers (`http_get_json`, `f`, `mph`, `derive_type`).
- `scripts/sources/nws.py`, `metno.py`, `openweathermap.py`, `weatherapi.py`, `visualcrossing.py`, `tomorrowio.py`, `googleweather.py` — one `fetch(lat, lon) -> list[normalized-daily]` each.
- `scripts/capture_sources.py` — runner: for each registered source with creds available, write `data/predictions/{today}/{key}_forecast.json`.
- `tests/test_scoring.py`, `tests/test_sources.py` — pytest.

**Modify:**
- `scripts/compare.py` — import scoring from `scripts/scoring.py`; refactor source ingestion to a registry loop producing normalized predictions; thread `coverage` into the comparison + scores rollup. Keep existing Open-Meteo/Apple/Ray's ingestion as normalizers that emit the contract above.
- `scripts/capture_openmeteo.py` — split precip into `rain_in` + `snow_in` (+ `precip_type`, `fields_provided`) on forecast daily entries AND actuals; keep `precip_in` for backward-compat.
- `.github/workflows/daily_capture.yml` — add a `capture_sources.py` step with the five keyed secrets as env. (Edit via shell — the Write tool is hook-blocked on workflow files.)

---

## Phase 1 — Scoring engine + actuals split (TDD)

### Task 1: Extract + redesign the scoring engine

**Files:** Create `scripts/scoring.py`, Create `tests/test_scoring.py`

- [ ] **Step 1: Write failing tests** in `tests/test_scoring.py`:

```python
from scoring import score_prediction, precip_type

ACT = {"high_f": 84, "low_f": 61, "wind_mph": 6, "rain_in": 0.12, "snow_in": 0.0}

def P(**kw):
    base = {"high_f": None, "low_f": None, "wind_mph": None, "precip_type": None,
            "rain_in": None, "snow_in": None, "fields_provided": []}
    base.update(kw)
    return base

def test_perfect_committed_forecast_scores_100():
    pred = P(high_f=85, low_f=62, wind_mph=7, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["score"] == 100.0

def test_vague_precip_forfeits_amount_not_zeroed():
    # correct rain call, no number -> type points, amount forfeited
    pred = P(high_f=80, low_f=58, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    # 24 (hi 4 off) + 27 (lo 3 off) + 20 (wind) + 10 (type) + 0 (amount forfeit) = 81
    assert r["score"] == 81.0
    assert r["coverage"]["precip_amount"] is False
    assert r["coverage"]["precip_type"] is True

def test_omitted_wind_forfeits_its_category():
    pred = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","precip_type","rain_amount"])
    r = score_prediction(pred, ACT)
    assert r["coverage"]["wind"] is False
    assert r["breakdown"]["wind"]["points"] is None
    assert r["score"] == 80.0  # 30+30+0+10+10

def test_precision_not_punished_within_rain_tolerance():
    # right to the tenth (0.10 vs 0.12) -> full amount credit
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["breakdown"]["precip_amount"]["points"] == 10.0

def test_snow_scored_in_depth_with_coarse_tolerance():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="snow", snow_in=5.0,
             fields_provided=["high","low","wind","precip_type","snow_amount"])
    # 5 vs 6 -> within max(1, 20%*6=1.2) -> full amount
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip_amount"]["points"] == 10.0
    assert r["score"] == 100.0

def test_wrong_precip_form_gets_partial_type_credit():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="rain", rain_in=0.5,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip_type"]["points"] == 4.0  # said precip, wrong form

def test_precip_type_derivation():
    assert precip_type(0.2, 0.0) == "rain"
    assert precip_type(0.0, 3.0) == "snow"
    assert precip_type(0.1, 2.0) == "mixed"
    assert precip_type(0.0, 0.0) == "none"

def test_grade_band_labels_unchanged():
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["grade"]["verdict"] == "right"
```

- [ ] **Step 2: Run, confirm fail**

Run: `python3 -m pytest tests/test_scoring.py -q`
Expected: import error / failures (module missing).

- [ ] **Step 3: Implement `scripts/scoring.py`**

```python
"""Pure scoring engine for Dave's Sweater — the coupled, snow-aware model.
No I/O. Inputs are normalized prediction/actual dicts (see plan contract)."""

TEMP_TOL, TEMP_SLOPE = 2.0, 3.0        # °F: full within 2, -3/°F beyond
WIND_TOL, WIND_SLOPE = 3.0, 2.0        # mph: full within 3, -2/mph beyond
RAIN_TOL, RAIN_SLOPE = 0.1, 20.0       # in: full within 0.1", -2 per 0.1" beyond
SNOW_MIN_TOL, SNOW_PCT, SNOW_SLOPE = 1.0, 0.20, 2.0  # in depth: full within max(1", 20%), -2/in beyond


def precip_type(rain_in, snow_in):
    r = (rain_in or 0) > 0.005
    s = (snow_in or 0) > 0.05
    if r and s:
        return "mixed"
    if s:
        return "snow"
    if r:
        return "rain"
    return "none"


def _band(pred, actual, maxpts, tol, slope):
    if pred is None or actual is None:
        return 0.0
    err = abs(pred - actual)
    return round(max(0.0, maxpts - max(0.0, err - tol) * slope), 1)


def _snow_tol(actual_snow):
    return max(SNOW_MIN_TOL, (actual_snow or 0) * SNOW_PCT)


def _type_points(pred_type, actual_type):
    if pred_type == actual_type:
        return 10.0
    precip = {"rain", "snow", "mixed"}
    if pred_type in precip and actual_type in precip:
        return 4.0
    return 0.0


def _amount_points(pred, actual, actual_type):
    fp = pred.get("fields_provided", [])
    if actual_type == "none":
        parts = []
        if "rain_amount" in fp:
            parts.append(_band(pred.get("rain_in"), 0.0, 10, RAIN_TOL, RAIN_SLOPE))
        if "snow_amount" in fp:
            parts.append(_band(pred.get("snow_in"), 0.0, 10, _snow_tol(0), SNOW_SLOPE))
        return round(sum(parts) / len(parts), 1) if parts else None
    if actual_type == "rain":
        if "rain_amount" not in fp:
            return None
        return _band(pred.get("rain_in"), actual.get("rain_in"), 10, RAIN_TOL, RAIN_SLOPE)
    if actual_type == "snow":
        if "snow_amount" not in fp:
            return None
        return _band(pred.get("snow_in"), actual.get("snow_in"), 10, _snow_tol(actual.get("snow_in")), SNOW_SLOPE)
    # mixed: 5 rain + 5 snow, each forfeitable
    parts = []
    if "rain_amount" in fp:
        parts.append(_band(pred.get("rain_in"), actual.get("rain_in"), 5, RAIN_TOL, RAIN_SLOPE))
    if "snow_amount" in fp:
        parts.append(_band(pred.get("snow_in"), actual.get("snow_in"), 5, _snow_tol(actual.get("snow_in")), SNOW_SLOPE))
    return round(sum(parts), 1) if parts else None


def _score_grade(score):
    if score >= 90:
        return {"verdict": "right", "ray_count": 5}
    if score >= 75:
        return {"verdict": "right", "ray_count": 4}
    if score >= 60:
        return {"verdict": "meh", "ray_count": 3}
    if score >= 40:
        return {"verdict": "wrong", "ray_count": 2}
    return {"verdict": "wrong", "ray_count": 1}


def score_prediction(pred, actual):
    fp = pred.get("fields_provided", [])
    actual_type = precip_type(actual.get("rain_in"), actual.get("snow_in"))

    high = _band(pred.get("high_f"), actual.get("high_f"), 30, TEMP_TOL, TEMP_SLOPE) if "high" in fp else None
    low = _band(pred.get("low_f"), actual.get("low_f"), 30, TEMP_TOL, TEMP_SLOPE) if "low" in fp else None
    wind = _band(pred.get("wind_mph"), actual.get("wind_mph"), 20, WIND_TOL, WIND_SLOPE) if "wind" in fp else None
    ptype = _type_points(pred.get("precip_type"), actual_type) if "precip_type" in fp else None
    pamt = _amount_points(pred, actual, actual_type)

    cats = {"high_temp": (high, 30), "low_temp": (low, 30), "wind": (wind, 20),
            "precip_type": (ptype, 10), "precip_amount": (pamt, 10)}
    total = round(sum((pts or 0) for pts, _ in cats.values()), 1)
    return {
        "score": total,
        "grade": _score_grade(total),
        "coverage": {k: (pts is not None) for k, (pts, _) in cats.items()},
        "breakdown": {k: {"points": pts, "max": mx, "scored": pts is not None} for k, (pts, mx) in cats.items()},
    }
```

- [ ] **Step 4: Run, confirm pass** — `python3 -m pytest tests/test_scoring.py -q` → all pass. Add a root `conftest.py` with `import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent / "scripts"))` so flat imports (`from scoring import ...`, `from sources.nws import ...`) resolve — matching the repo's flat-script pattern (`compare.py` uses `from capture_openmeteo import ...`).

- [ ] **Step 5: Commit**
```bash
git add scripts/scoring.py tests/test_scoring.py tests/__init__.py conftest.py
git commit -m "feat(scoring): coupled snow-aware fair model in scripts/scoring.py (TDD)"
```

### Task 2: Split precip in `capture_openmeteo.py` (forecast + actuals)

**Files:** Modify `scripts/capture_openmeteo.py`

- [ ] **Step 1:** In `capture_forecast()`'s daily loop, replace the precip fields. `precipitation_sum` is liquid rain (inches); `snowfall_sum` is snow depth (cm → /2.54). Build:
```python
rain_in = round(precip[i] or 0, 3) if i < len(precip) else 0.0
snow_in = round((snowfall[i] or 0) / 2.54, 3) if i < len(snowfall) else 0.0
ptype = "mixed" if rain_in > 0.005 and snow_in > 0.05 else ("snow" if snow_in > 0.05 else ("rain" if rain_in > 0.005 else "none"))
forecast["daily"].append({
    "date": dates[i],
    "high_f": highs[i] if i < len(highs) else None,
    "low_f": lows[i] if i < len(lows) else None,
    "wind_mph": wind[i] if i < len(wind) else None,
    "precip_type": ptype,
    "rain_in": rain_in,
    "snow_in": snow_in,
    "precip_in": round(rain_in + snow_in, 3),   # backward-compat (M2 reads this)
    "precip_prob": precip_prob[i] if i < len(precip_prob) else None,
    "weather_code": code, "conditions": WMO_CODES.get(code, "Unknown"),
    "category": weather_category(code),
    "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
})
```

- [ ] **Step 2:** In `fetch_actuals()`, split the same way and add `rain_in`/`snow_in`/`precip_type` (keep `precip_in` for compat):
```python
rain_in = round((daily.get("precipitation_sum", [0])[0] or 0), 3)
snow_in = round((daily.get("snowfall_sum", [0])[0] or 0) / 2.54, 3)
actuals.update({"rain_in": rain_in, "snow_in": snow_in,
                "precip_type": ("mixed" if rain_in>0.005 and snow_in>0.05 else "snow" if snow_in>0.05 else "rain" if rain_in>0.005 else "none"),
                "precip_in": round(rain_in + snow_in, 3)})
```

- [ ] **Step 3: Verify** — run `python3 scripts/capture_openmeteo.py --forecast` and `--actuals --date 2026-06-19`; confirm the JSON now has `rain_in`/`snow_in`/`precip_type`/`fields_provided`. Run `git diff` to confirm `precip_in` is still present.

- [ ] **Step 4: Commit**
```bash
git add scripts/capture_openmeteo.py
git commit -m "feat(openmeteo): split precip into rain(liquid)+snow(depth)+type; keep precip_in"
```

---

## Phase 2 — Source registry, adapters, capture runner

### Task 3: Registry + shared helpers

**Files:** Create `scripts/sources/__init__.py`

- [ ] **Step 1: Implement** the registry + stdlib HTTP + a normalize helper. Each source declares `key, label, is_free, env_key (or None), module`.
```python
import json, os, urllib.request, urllib.error

LAT, LON = 36.2168, -81.6746
UA = "DavesSweater/1.0 (+https://davessweater.com)"

def http_get_json(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def derive_type(rain_in, snow_in, has_precip=None):
    r = (rain_in or 0) > 0.005; s = (snow_in or 0) > 0.05
    if r and s: return "mixed"
    if s: return "snow"
    if r: return "rain"
    if has_precip: return "rain"   # provider says precip but no split -> assume rain
    return "none"

# key -> {label, is_free, env_key, import path}
SOURCES = [
    {"key": "nws",            "label": "NWS",            "env_key": None,                     "module": "sources.nws"},
    {"key": "metno",          "label": "Met.no",         "env_key": None,                     "module": "sources.metno"},
    {"key": "openweathermap", "label": "OpenWeatherMap", "env_key": "OPENWEATHER_API_KEY",    "module": "sources.openweathermap"},
    {"key": "weatherapi",     "label": "WeatherAPI",     "env_key": "WEATHERAPI_KEY",         "module": "sources.weatherapi"},
    {"key": "visualcrossing", "label": "Visual Crossing","env_key": "VISUALCROSSING_KEY",     "module": "sources.visualcrossing"},
    {"key": "tomorrowio",     "label": "Tomorrow.io",    "env_key": "TOMORROW_API_KEY",       "module": "sources.tomorrowio"},
    {"key": "googleweather",  "label": "Google Weather", "env_key": "GOOGLE_WEATHER_API_KEY", "module": "sources.googleweather"},
]

def available_sources():
    """Sources whose creds are present (keyless always; keyed only if env set)."""
    return [s for s in SOURCES if s["env_key"] is None or os.environ.get(s["env_key"])]
```

- [ ] **Step 2: Commit**
```bash
git add scripts/sources/__init__.py
git commit -m "feat(sources): registry + stdlib HTTP + type-derivation helpers"
```

### Task 4: NWS adapter (REFERENCE — full implementation)

**Files:** Create `scripts/sources/nws.py`, add tests to `tests/test_sources.py`

NWS is two-step: `GET /points/{lat},{lon}` → `properties.forecast` (the daily forecast URL) → that returns `properties.periods[]` (day/night pairs). NWS gives temp (per period), wind (string like "10 mph"), `probabilityOfPrecipitation`, and `detailedForecast` text (parse snow/rain words). Daily high = day period temp, low = following night period temp.

- [ ] **Step 1: Write a normalization test** (uses a captured sample payload fixture so it's offline/deterministic) in `tests/test_sources.py`:
```python
from sources.nws import normalize_periods

def test_nws_pairs_day_night_into_daily():
    periods = [
        {"number":1,"isDaytime":True,"temperature":84,"windSpeed":"6 mph",
         "probabilityOfPrecipitation":{"value":60},"shortForecast":"Rain Likely","startTime":"2026-06-20T06:00:00-04:00"},
        {"number":2,"isDaytime":False,"temperature":61,"windSpeed":"3 mph",
         "probabilityOfPrecipitation":{"value":20},"shortForecast":"Partly Cloudy","startTime":"2026-06-20T18:00:00-04:00"},
    ]
    days = normalize_periods(periods)
    d = days[0]
    assert d["date"] == "2026-06-20"
    assert d["high_f"] == 84 and d["low_f"] == 61
    assert d["wind_mph"] == 6.0
    assert d["precip_type"] == "rain"            # "Rain Likely"
    assert "precip_type" in d["fields_provided"]
    assert "rain_amount" not in d["fields_provided"]   # NWS short forecast gives no amount
```

- [ ] **Step 2:** Run → fail. **Step 3: Implement** `scripts/sources/nws.py`:
```python
import re
from sources import http_get_json, LAT, LON

def _wind(s):
    m = re.search(r"(\d+)", s or "")
    return float(m.group(1)) if m else None

def _type_from_text(text):
    t = (text or "").lower()
    snow = any(w in t for w in ("snow", "flurr", "sleet", "ice", "wintry", "blizzard"))
    rain = any(w in t for w in ("rain", "shower", "thunder", "drizzle"))
    if snow and rain: return "mixed"
    if snow: return "snow"
    if rain: return "rain"
    return "none"

def normalize_periods(periods):
    days = []
    for i, p in enumerate(periods):
        if not p.get("isDaytime"):
            continue
        nxt = periods[i + 1] if i + 1 < len(periods) else {}
        date = (p.get("startTime") or "")[:10]
        days.append({
            "date": date,
            "high_f": p.get("temperature"),
            "low_f": nxt.get("temperature") if not nxt.get("isDaytime") else None,
            "wind_mph": _wind(p.get("windSpeed")),
            "precip_type": _type_from_text(p.get("shortForecast") or p.get("detailedForecast")),
            "rain_in": None, "snow_in": None,
            "fields_provided": ["high", "low", "wind", "precip_type"],
        })
    return days

def fetch(lat=LAT, lon=LON):
    pt = http_get_json(f"https://api.weather.gov/points/{lat},{lon}")
    forecast_url = pt["properties"]["forecast"]
    data = http_get_json(forecast_url)
    return normalize_periods(data["properties"]["periods"])
```

- [ ] **Step 4:** Run tests → pass. **Step 5: Commit** `git add scripts/sources/nws.py tests/test_sources.py && git commit -m "feat(sources): NWS adapter (reference) + normalization test"`.

### Tasks 5–10: the remaining adapters

Each mirrors Task 4's structure (a pure `normalize_*` tested against a sample payload + a thin `fetch`). Endpoints and field mappings below are **validated against live Boone responses**. `fields_provided` lists exactly what each can supply.

**Task 5 — Met.no** (`scripts/sources/metno.py`, keyless, requires UA): `GET https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat}&lon={lon}`. Response `properties.timeseries[]` is hourly; aggregate per local date: `high_f`/`low_f` from `data.instant.details.air_temperature` (°C → F), `wind_mph` from `wind_speed` (m/s → mph ×2.23694), precip from `data.next_6_hours.details.precipitation_amount` (mm → in ÷25.4) summed per day (liquid; Met.no compact doesn't split snow → `precip_type` via temp: ≤0°C ⇒ snow). `fields_provided=["high","low","wind","precip_type","rain_amount"]` (snow_amount only when type=snow via the same field).

**Task 6 — OpenWeatherMap** (`openweathermap.py`, `OPENWEATHER_API_KEY`): `GET https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&units=imperial&appid={key}` (no-card 5-day/3-hr). Aggregate `list[]` per local date (`dt_txt[:10]`): high=max `main.temp_max`, low=min `main.temp_min`, wind=max `wind.speed`, rain=sum `rain.3h` (mm→in), snow=sum `snow.3h` (mm→in, treat as depth proxy), type via `weather[0].main`. `fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"]`.

**Task 7 — WeatherAPI.com** (`weatherapi.py`, `WEATHERAPI_KEY`): `GET https://api.weatherapi.com/v1/forecast.json?key={key}&q={lat},{lon}&days=3`. `forecast.forecastday[].day`: `maxtemp_f`,`mintemp_f`,`maxwind_mph`,`totalprecip_in` (liquid),`totalsnow_cm`(→in /2.54),`daily_will_it_snow`/`daily_will_it_rain` → type. `fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"]`.

**Task 8 — Visual Crossing** (`visualcrossing.py`, `VISUALCROSSING_KEY`): `GET https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{lat},{lon}?unitGroup=us&include=days&contentType=json&key={key}`. `days[]`: `tempmax`,`tempmin`,`windspeed`,`precip`(in),`snow`(in depth),`preciptype`(list e.g. ["rain"]/["snow"]). `fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"]`.

**Task 9 — Tomorrow.io** (`tomorrowio.py`, `TOMORROW_API_KEY`): `GET https://api.tomorrow.io/v4/weather/forecast?location={lat},{lon}&timesteps=1d&units=imperial&apikey={key}`. `timelines.daily[].values`: `temperatureMax`,`temperatureMin`,`windSpeedMax`(or `windSpeedAvg`),`rainAccumulationSum`(in),`snowAccumulationSum`(in depth). type via which accumulation > 0. `fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"]`.

**Task 10 — Google Weather** (`googleweather.py`, `GOOGLE_WEATHER_API_KEY`): `GET https://weather.googleapis.com/v1/forecast/days:lookup?key={key}&location.latitude={lat}&location.longitude={lon}&days=3&unitsSystem=IMPERIAL`. `forecastDays[]`: `displayDate` (y/m/d) → date; `maxTemperature.degrees`,`minTemperature.degrees`; `daytimeForecast.wind.speed.value`; `daytimeForecast.precipitation` → `qpf.quantity` (liquid) + `snowQpf.quantity` (depth) + `probability.type` (RAIN/SNOW). `fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"]`.

For each (Tasks 5–10): **Step 1** write a `normalize_*` test against a small captured sample dict; **Step 2** run→fail; **Step 3** implement `normalize_*` + `fetch`; **Step 4** run→pass; **Step 5** commit `feat(sources): <name> adapter`. (Capture a real sample once via a scratch call with the key from env; do NOT commit raw keys or scratch scripts.)

### Task 11: Capture runner

**Files:** Create `scripts/capture_sources.py`

- [ ] **Step 1: Implement** — loops `available_sources()`, imports each module, calls `fetch()`, writes `data/predictions/{today}/{key}_forecast.json` in the shape `{source, captured_at, location, daily:[...normalized...]}`. Each source wrapped in try/except so one failure doesn't abort the rest (matches `continue-on-error` ethos). Print `OK <key>` / `SKIP <key> (no creds)` / `FAIL <key>: <err>`.
```python
import importlib, json
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from sources import available_sources, SOURCES

EST = ZoneInfo("America/New_York")
DATA = Path(__file__).resolve().parent.parent / "data"

def main():
    today = datetime.now(EST).strftime("%Y-%m-%d")
    out = DATA / "predictions" / today
    out.mkdir(parents=True, exist_ok=True)
    avail = {s["key"] for s in available_sources()}
    for s in SOURCES:
        if s["key"] not in avail:
            print(f"  SKIP {s['key']} (no creds)"); continue
        try:
            mod = importlib.import_module(s["module"])
            daily = mod.fetch()
            payload = {"source": s["key"], "label": s["label"],
                       "captured_at": datetime.now(EST).isoformat(), "location": "Boone", "daily": daily}
            (out / f"{s['key']}_forecast.json").write_text(json.dumps(payload, indent=2))
            print(f"  OK   {s['key']} ({len(daily)} days)")
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL {s['key']}: {type(e).__name__}: {e}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify locally** with keys exported from your shell env (the same secrets) — `python3 scripts/capture_sources.py` writes `{key}_forecast.json` for each. Confirm normalized fields look sane for Boone. **Step 3: Commit** (do NOT commit the generated prediction files from a local run with a different date than CI — `git add scripts/capture_sources.py` only).

### Task 12: Uniform ingestion + coverage in `compare.py`

**Files:** Modify `scripts/compare.py`

- [ ] **Step 1:** Replace `from ... score_prediction` usage with `from scoring import score_prediction`. Delete the old in-file `score_prediction` + `_score_grade` (now in `scoring.py`).
- [ ] **Step 2:** Add a registry-driven loop after the existing Open-Meteo/Ray's/Apple blocks: for each `{key}_forecast.json` in the prediction dir matching a registered source, load it, find the target date in `daily`, score it, and write `comparison["sources"][key] = {"prediction": day, "score": result}`. The existing 3 sources keep their bespoke load but must emit the normalized contract (add `fields_provided`, `rain_in`/`snow_in`/`precip_type`) before scoring — wrap each in a small `normalize_*` so all five categories are scoreable. Open-Meteo already has the fields (Task 2). Ray's: `fields_provided=["high","low","wind","precip_type"]` when present, type from `category`/`daytime_desc`. Apple: map `rainfall_in`→`rain_in`, type from `conditions`, `fields_provided` per what's present.
- [ ] **Step 3:** Thread coverage into the rollup: in `_update_running_scores`, also accumulate a per-source coverage tally `{field: provided_count}` from each comparison's `score.coverage`, and write `scores["coverage"][source] = {field: {"provided": n, "days": d}}`. Keep `totals` exactly as-is (backward-compat).
- [ ] **Step 4: Verify** — `python3 scripts/compare.py --date 2026-06-19` runs clean, writes a comparison with `sources[*].score.coverage`, and `scores.json` gains a `coverage` block. Existing `score`/`grade`/`totals` keys unchanged in shape.
- [ ] **Step 5: Commit** `feat(compare): registry-driven ingestion + coverage; use scripts/scoring`.

---

## Phase 3 — Re-score, workflow, verify

### Task 13: Re-score the season

**Files:** regenerates `data/comparisons/*.json` + `data/scores.json`

- [ ] **Step 1:** Run compare across every date with actuals:
```bash
for d in $(ls data/actuals/*.json | xargs -n1 basename | sed 's/.json//'); do python3 scripts/compare.py --date "$d"; done
```
- [ ] **Step 2: Sanity-check** the regenerated `scores.json`: free sources (Open-Meteo/Apple) still average high; Ray's lower; numbers shifted but the relative order holds. Spot-check 3 comparison files for `coverage` + `precip_type`/`rain_in`/`snow_in`.
- [ ] **Step 3: Commit** `chore(data): re-score season under the coupled snow-aware model`.

### Task 14: Wire new captures into the daily workflow

**Files:** Modify `.github/workflows/daily_capture.yml` (**edit via shell — Write tool is hook-blocked on workflow files**)

- [ ] **Step 1:** Add, after the Open-Meteo capture step, a step that runs `python scripts/capture_sources.py` with the five keyed secrets passed as `env:` (`OPENWEATHER_API_KEY`, `WEATHERAPI_KEY`, `VISUALCROSSING_KEY`, `TOMORROW_API_KEY`, `GOOGLE_WEATHER_API_KEY`), `continue-on-error: true`. Ensure the commit step's `git add data/predictions/` picks up the new `{key}_forecast.json` files. Use only `${{ secrets.* }}` in `env:` and a static `run:` (no untrusted input → no injection surface).
- [ ] **Step 2: Verify** YAML parses (`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/daily_capture.yml'))"` if pyyaml present, else visual) and the secret names match Task-11 env reads.
- [ ] **Step 3: Commit** `ci: capture the new free forecasters in daily_capture`.

### Task 15: Full verification

- [ ] **Step 1:** `python3 -m pytest -q` → all scoring + source-normalization tests pass.
- [ ] **Step 2:** Confirm `available_sources()` returns the 2 keyless even with no env; returns keyed ones when their env is set; capture runner SKIPs cleanly when a key is absent.
- [ ] **Step 3:** Re-read 2–3 regenerated comparisons + `scores.json`: every scored source has a `coverage` block; the coverage rollup distinguishes who publishes `precip_amount` (rain/snow) vs who doesn't (e.g., Ray's, NWS).
- [ ] **Step 4: Update CHECKLIST.md** — mark Source Expansion built; note season re-scored; AccuWeather/Google decisions; the coverage index now in data for M3.
- [ ] **Step 5:** Push the branch and open a PR (target `main`); confirm CI is green. No production deploy implications (pipeline/data only; Vercel rebuilds on `data/` merge to main later).

---

## Notes for the executor

- **stdlib only** in `scripts/sources/*` and `capture_sources.py` (urllib/json) — they run in Actions with no `pip install`.
- **Never** print keys or full request URLs; GitHub masks secret values but don't rely on it.
- **Backward-compat is a hard requirement:** keep `precip_in`, `score`, `grade`, `totals` so the M2 site (separate branch) still renders after these branches merge. New fields are additive.
- **Adapters return the normalized contract exactly** (the dict at the top of this plan); `fields_provided` must be accurate — it drives both fair scoring (forfeit absent) and the coverage index.
- **Re-scoring changes the published numbers** — that's expected and more defensible; the relative "free beats paid" result holds.
- Sample-payload fixtures keep adapter tests offline/deterministic — capture one real sample per provider (key from env), trim it, inline it in the test; never commit a scratch fetch script or a raw key.
