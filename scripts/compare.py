#!/usr/bin/env python3
"""
compare.py — The brains of Dave's Sweater

1. "Is It Sweater Weather?" — based on current/forecast temp
2. "Right Ray, Wrong Ray" — compare Ray's prediction to actuals
3. Generate JSON output that the site builder reads

Run daily at ~8 AM after actuals are fetched.
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

from scoring import score_prediction
from sources import SOURCES, derive_type

EST = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


# ═══════════════════════════════════════════════════════════════════
# SWEATER WEATHER LOGIC
# ═══════════════════════════════════════════════════════════════════

def is_sweater_weather(high_f, current_f=None, wind_mph=0, humidity=None):
    """
    The sacred algorithm. Is it sweater weather?

    Uses a blended effective temperature:
        effective_temp = (high * 0.5) + (current * 0.5)

    If only the high is available (e.g. daily actuals with no live reading),
    the high is used on its own.

    Scale (for Boone, NC — a mountain town):
        75°F+   → 0 sweaters — No sweater needed
        65-74°F → 1 sweater  — Light layer at most
        55-64°F → 2 sweaters — Light sweater
        45-54°F → 3 sweaters — Sweater weather
        35-44°F → 4 sweaters — Heavy sweater
        <35°F   → 5 sweaters — Full sweater stack
    """
    if high_f is None:
        return {"answer": "UNKNOWN", "detail": "No temperature data. Wear one just in case.", "layers": "?"}

    # Blend high and current when both are available
    if current_f is not None:
        effective_temp = (high_f * 0.5) + (current_f * 0.5)
    else:
        effective_temp = high_f

    if effective_temp < 35:
        return {
            "answer": "ABSOLUTELY",
            "detail": "That's not sweater weather, that's SWEATER EMERGENCY.",
            "layers": "3+ (sweater, fleece, AND a coat)",
            "emoji": "🥶🧥",
            "sweater_count": 5,
        }
    elif effective_temp < 45:
        return {
            "answer": "YES",
            "detail": "Classic sweater weather. This is what we're here for.",
            "layers": "2 (solid sweater + optional layer)",
            "emoji": "🧣✅",
            "sweater_count": 4,
        }
    elif effective_temp < 55:
        return {
            "answer": "YES",
            "detail": "Still sweater territory. Don't let anyone tell you otherwise.",
            "layers": "1-2 (light to medium sweater)",
            "emoji": "🧶👍",
            "sweater_count": 3,
        }
    elif effective_temp < 65:
        return {
            "answer": "MAYBE",
            "detail": "You could go either way. Bring it and decide later.",
            "layers": "0-1 (light layer, keep one in the car)",
            "emoji": "🤔",
            "sweater_count": 2,
        }
    elif effective_temp < 75:
        return {
            "answer": "NO",
            "detail": "No sweater needed unless you're in aggressive AC.",
            "layers": "0 (the sweater rests today)",
            "emoji": "☀️❌",
            "sweater_count": 1,
        }
    else:
        return {
            "answer": "ABSOLUTELY NOT",
            "detail": "Wearing a sweater would be a cry for help.",
            "layers": "0 (this is shorts weather, Dave)",
            "emoji": "🥵🩳",
            "sweater_count": 0,
        }


# ═══════════════════════════════════════════════════════════════════
# RIGHT RAY / WRONG RAY LOGIC
# ═══════════════════════════════════════════════════════════════════

def _get_high(entry):
    """Get high temp, supporting both 'today_high_f' and 'high_f' keys."""
    return entry.get("today_high_f", entry.get("high_f"))


def _get_low(entry):
    """Get low temp, supporting 'tonight_low_f', 'today_low_f', and 'low_f' keys."""
    return entry.get("tonight_low_f", entry.get("today_low_f", entry.get("low_f")))


def _best_rays_prediction(rays_data, target_date):
    """
    Build the best prediction dict from Ray's data by merging forecast + daily.
    The forecast dict has today_high_f/tonight_low_f (parsed from the strip).
    The daily array has per-day entries with high_f/low_f.
    We merge both, preferring whichever has actual values.
    """
    pred = {}

    # Start with forecast dict
    forecast = rays_data.get("forecast", {})
    if forecast:
        pred["today_high_f"] = forecast.get("today_high_f")
        pred["tonight_low_f"] = forecast.get("tonight_low_f")

    # Pick the daily entry for this date. Prefer an exact date match; if a
    # capture hiccup leaves daily[] mis-anchored (no entry on target_date),
    # fall back to daily[0] (post-fix, this is the capture day) or the nearest
    # future entry — so a date glitch never strips Ray's wind/precip fields.
    daily = rays_data.get("daily") or []
    match = None
    if daily:
        match = next((d for d in daily if d.get("date") == target_date), None)
        if match is None:
            future = [d for d in daily if d.get("date") and d["date"] >= target_date]
            match = min(future, key=lambda d: d["date"]) if future else daily[0]

    if match:
        if pred.get("today_high_f") is None and match.get("high_f") is not None:
            pred["today_high_f"] = match["high_f"]
        if pred.get("tonight_low_f") is None and match.get("low_f") is not None:
            pred["tonight_low_f"] = match["low_f"]
        # Carry over other fields — including the wind interval (wind_lo/wind_hi)
        # and recovered precip_type. NOT precip_in: Ray never gives a numeric
        # amount, so a hardcoded 0.0 would misrepresent his forecast as
        # predicting no rain (amount stays forfeited).
        for k in ("category", "daytime_desc", "wind_mph", "wind_lo", "wind_hi", "precip_type"):
            if k in match and match[k] is not None and k not in pred:
                pred[k] = match[k]

    return pred if pred else None


def _parse_apple_forecast(path):
    """Load Apple Weather JSON, tolerating units like '69°F' or '2.6 mph'."""
    import re
    with open(path) as f:
        raw = f.read()
    # Fix values like 69°F or 2.607 mph → bare numbers
    # Match: a number (with optional decimal) followed by non-quote, non-comma junk
    raw = re.sub(r':\s*(\d+\.?\d*)[^",}\]]*([,}\]])', r': \1\2', raw)
    return json.loads(raw)


def _apple_condition_to_category(condition_str):
    """Map Apple Weather condition strings to scoring categories."""
    if not condition_str:
        return "unknown"
    c = condition_str.lower()
    if any(w in c for w in ("thunder", "severe", "tornado", "hurricane")):
        return "storm"
    if any(w in c for w in ("snow", "flurr", "blizzard", "sleet", "ice", "freez")):
        return "snow"
    if any(w in c for w in ("rain", "shower", "downpour")):
        return "rain"
    if any(w in c for w in ("drizzle", "sprinkle")):
        return "drizzle"
    if any(w in c for w in ("fog", "haze", "mist")):
        return "fog"
    if any(w in c for w in ("cloud", "overcast")):
        return "cloudy"
    if any(w in c for w in ("clear", "sunny", "sun", "fair")):
        return "clear"
    return "unknown"


def _categories_close(a, b):
    """Are two weather categories 'close enough'?"""
    close_pairs = [
        {"clear", "cloudy"},
        {"drizzle", "rain"},
        {"rain", "storm"},
        {"drizzle", "fog"},
    ]
    pair = {a, b}
    return pair in close_pairs


def _normalize_actual(actual):
    """Actuals -> contract. Derive liquid rain from old-schema precip_in when needed."""
    rain = actual.get("rain_in")
    snow = actual.get("snow_in") or 0
    if rain is None:
        rain = max(0.0, (actual.get("precip_in") or 0) - snow)
    return {
        "high_f": actual.get("high_f"), "low_f": actual.get("low_f"),
        "wind_mph": actual.get("wind_mph"),
        "rain_in": round(rain, 3), "snow_in": round(snow, 3),
    }


_CAT_TO_TYPE = {"rain": "rain", "drizzle": "rain", "storm": "rain", "snow": "snow",
                "clear": "none", "cloudy": "none", "fog": "none"}


def _to_contract(pred):
    """Any source's raw prediction dict -> the scoring contract.
    Already-normalized new sources keep their explicit fields_provided.
    Old-schema (precip_in) and text sources (Ray's/Apple) are backfilled."""
    high, low, wind = _get_high(pred), _get_low(pred), pred.get("wind_mph")
    wind_lo, wind_hi = pred.get("wind_lo"), pred.get("wind_hi")
    has_wind = wind is not None or (wind_lo is not None and wind_hi is not None)
    snow = pred.get("snow_in")
    rain = pred.get("rain_in")
    if rain is None and pred.get("precip_in") is not None:
        rain = max(0.0, pred["precip_in"] - (snow or 0))
    ptype = pred.get("precip_type")
    if ptype is None:
        cat = pred.get("category")
        if cat in _CAT_TO_TYPE:
            ptype = _CAT_TO_TYPE[cat]
        elif pred.get("daytime_desc"):
            d = pred["daytime_desc"].lower()
            if any(w in d for w in ("snow", "flurr", "sleet", "wintry")):
                ptype = "snow"
            elif any(w in d for w in ("rain", "shower", "storm", "thunder", "drizzle")):
                ptype = "rain"
            else:
                ptype = "none"
        elif rain is not None or snow is not None:
            ptype = derive_type(rain, snow)
    if pred.get("fields_provided"):
        fp = list(pred["fields_provided"])
    else:
        fp = []
        if high is not None: fp.append("high")
        if low is not None: fp.append("low")
        if has_wind: fp.append("wind")
        if ptype is not None: fp.append("precip_type")
        if rain is not None: fp.append("rain_amount")
        if snow is not None: fp.append("snow_amount")
    return {"high_f": high, "low_f": low, "wind_mph": wind,
            "wind_lo": wind_lo, "wind_hi": wind_hi, "precip_type": ptype,
            "rain_in": (round(rain, 3) if rain is not None else None),
            "snow_in": (round(snow, 3) if snow is not None else None),
            "fields_provided": fp}


# ═══════════════════════════════════════════════════════════════════
# DAILY COMPARISON RUNNER
# ═══════════════════════════════════════════════════════════════════

def run_daily_comparison(target_date=None):
    """
    Run the full daily comparison for a given date.
    Reads predictions + actuals, produces comparison JSON.
    """
    if target_date is None:
        yesterday = datetime.now(EST) - timedelta(days=1)
        target_date = yesterday.strftime("%Y-%m-%d")

    print(f"\n{'='*60}")
    print(f"  DAVE'S SWEATER DAILY COMPARISON — {target_date}")
    print(f"{'='*60}\n")

    # Load actuals
    actuals_path = DATA_DIR / "actuals" / f"{target_date}.json"
    if not actuals_path.exists():
        print(f"  ERROR: No actuals found for {target_date}")
        print(f"  Run: python capture_openmeteo.py --actuals --date {target_date}")
        return None
    with open(actuals_path) as f:
        actuals = json.load(f)
    norm_actual = _normalize_actual(actuals)
    print(f"  Actuals: High {actuals['high_f']}°F / Low {actuals['low_f']}°F — {actuals['conditions']}")

    # Load Open-Meteo prediction for that date
    pred_dir = DATA_DIR / "predictions" / target_date
    comparison = {
        "date": target_date,
        "generated_at": datetime.now(EST).isoformat(),
        "actuals": actuals,
        "sweater_weather": is_sweater_weather(
            actuals.get("high_f"),
            wind_mph=0,  # Actuals don't include wind in archive
        ),
        "sources": {},
    }

    # Score Open-Meteo prediction
    om_path = pred_dir / "openmeteo_forecast.json"
    if om_path.exists():
        with open(om_path) as f:
            om_data = json.load(f)
        # Find the prediction for the target date
        for day in om_data.get("daily", []):
            if day["date"] == target_date:
                result = score_prediction(_to_contract(day), norm_actual)
                comparison["sources"]["openmeteo"] = {
                    "prediction": day,
                    "score": result,
                }
                print(f"  Open-Meteo: {result['score']}/100")
                break
    else:
        print(f"  No Open-Meteo prediction found for {target_date}")

    # Score Ray's prediction (from extracted data — may be sparse)
    rays_path = pred_dir / "rays_boone.json"
    if rays_path.exists():
        with open(rays_path) as f:
            rays_data = json.load(f)
        # Attach Ray's current conditions if available
        if rays_data.get("current"):
            comparison["rays_current"] = rays_data["current"]

        # Build the best prediction dict by merging forecast + daily data
        rays_pred = _best_rays_prediction(rays_data, target_date)

        if rays_pred and (_get_high(rays_pred) is not None or _get_low(rays_pred) is not None):
            result = score_prediction(_to_contract(rays_pred), norm_actual)
            comparison["sources"]["raysweather"] = {
                "prediction": rays_pred,
                "score": result,
            }
            print(f"  Ray's Weather: {result['score']}/100")
        else:
            comparison["sources"]["raysweather"] = {
                "note": "Screenshot captured but structured data extraction pending",
                "screenshot": f"predictions/{target_date}/rays_forecast.png",
            }
            print(f"  Ray's Weather: Screenshot only (no structured data to score yet)")
    else:
        print(f"  No Ray's Weather prediction found for {target_date}")

    # Score Apple Weather prediction — prefer real iPhone Shortcut data,
    # fall back to the Open-Meteo-based iphone_forecast.json
    apple_path = pred_dir / "iphone_forecast_apple.json"
    if apple_path.exists():
        apple_data = _parse_apple_forecast(apple_path)
        apple_source = "iPhone Shortcut"
    else:
        apple_path = pred_dir / "iphone_forecast.json"
        if apple_path.exists():
            apple_data = _parse_apple_forecast(apple_path)
            apple_source = "Open-Meteo"
            # capture_iphone_weather.py writes a nested structure where the
            # scoreable fields live under data["forecast"]. Unwrap so the
            # flat Shortcut-style scoring code below can read them.
            if isinstance(apple_data, dict) and isinstance(apple_data.get("forecast"), dict):
                forecast_dict = dict(apple_data["forecast"])
                forecast_dict.setdefault("source", "Open-Meteo (iPhone fallback)")
                apple_data = forecast_dict
        else:
            apple_data = None
            apple_source = None

    if apple_data:
        # The Shortcut uploads a flat dict: today_high_f, tonight_low_f, wind_mph, conditions
        # Map rainfall_in → precip_in for scoring compatibility
        if "rainfall_in" in apple_data and "precip_in" not in apple_data:
            apple_data["precip_in"] = apple_data["rainfall_in"]
        # Map conditions string to a category for scoring
        if apple_data.get("conditions") and not apple_data.get("category"):
            apple_data["category"] = _apple_condition_to_category(apple_data["conditions"])
        # Infer precip from conditions: non-precipitation conditions imply 0.0"
        if "precip_in" not in apple_data and apple_data.get("category"):
            cat = apple_data["category"]
            if cat in ("rain", "drizzle", "storm", "snow"):
                apple_data["precip_in"] = 0.01  # known precip, unknown amount
            elif cat != "unknown":
                apple_data["precip_in"] = 0.0
        if _get_high(apple_data) is not None or _get_low(apple_data) is not None:
            result = score_prediction(_to_contract(apple_data), norm_actual)
            comparison["sources"]["apple_weather"] = {
                "prediction": apple_data,
                "score": result,
            }
            print(f"  Apple Weather ({apple_source}): {result['score']}/100")
        else:
            print(f"  Apple Weather: No temperature data to score")
    else:
        print(f"  No Apple Weather prediction found for {target_date}")

    # New free forecasters (NWS, Met.no, OWM, WeatherAPI, Visual Crossing, Tomorrow.io, Google)
    existing = set(comparison["sources"].keys())
    for s in SOURCES:
        key = s["key"]
        if key in existing:
            continue
        fpath = pred_dir / f"{key}_forecast.json"
        if not fpath.exists():
            continue
        try:
            data = json.load(open(fpath))
        except (json.JSONDecodeError, OSError):
            continue
        for day in data.get("daily", []):
            if day.get("date") == target_date:
                result = score_prediction(_to_contract(day), norm_actual)
                comparison["sources"][key] = {"prediction": day, "score": result}
                print(f"  {s['label']}: {result['score']}/100")
                break

    # Sweater weather verdict
    sw = comparison["sweater_weather"]
    print(f"\n  🧣 Sweater Weather? {sw['answer']} {sw.get('emoji', '')}")
    print(f"     {sw['detail']}")
    print(f"     Recommended layers: {sw['layers']}")

    # Save comparison
    comp_dir = DATA_DIR / "comparisons"
    comp_dir.mkdir(parents=True, exist_ok=True)
    comp_path = comp_dir / f"{target_date}.json"
    with open(comp_path, "w") as f:
        json.dump(comparison, f, indent=2)
    print(f"\n  Saved comparison: {comp_path}")

    # Update running score
    _update_running_scores(target_date, comparison)

    return comparison


def _update_running_scores(date, comparison):
    """Append today's scores and recalculate totals from all comparison files."""
    scores_path = DATA_DIR / "scores.json"
    if scores_path.exists():
        with open(scores_path) as f:
            scores = json.load(f)
    else:
        scores = {"entries": [], "totals": {}}

    # Skip if this date is already in the entries
    if any(e.get("date") == date for e in scores["entries"]):
        print(f"  Scores already recorded for {date}, skipping")
    else:
        entry = {"date": date}
        for source, data in comparison.get("sources", {}).items():
            if "score" in data:
                entry[source] = data["score"]["score"]
        entry["sweater_weather"] = comparison["sweater_weather"]["answer"]
        scores["entries"].append(entry)

    # Recalculate totals from all comparison files (source of truth)
    totals = {}
    comp_dir = DATA_DIR / "comparisons"
    for comp_file in sorted(comp_dir.glob("*.json")):
        try:
            with open(comp_file) as f:
                comp = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for source, data in comp.get("sources", {}).items():
            if "score" not in data:
                continue
            if source not in totals:
                totals[source] = {"right": 0, "wrong": 0, "meh": 0, "total_score": 0, "days": 0}
            verdict = data["score"]["grade"]["verdict"]
            totals[source][verdict] += 1
            totals[source]["total_score"] += data["score"]["score"]
            totals[source]["days"] += 1

    scores["totals"] = totals

    coverage = {}
    cov_fields = ["high_temp", "low_temp", "wind", "precip_type", "precip_amount"]
    for comp_file in sorted(comp_dir.glob("*.json")):
        try:
            with open(comp_file) as f:
                comp = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for source, data in comp.get("sources", {}).items():
            if "score" not in data:
                continue
            cov = data["score"].get("coverage", {})
            if source not in coverage:
                coverage[source] = {fld: {"provided": 0, "days": 0} for fld in cov_fields}
            for fld in cov_fields:
                coverage[source][fld]["days"] += 1
                if cov.get(fld):
                    coverage[source][fld]["provided"] += 1
    scores["coverage"] = coverage

    with open(scores_path, "w") as f:
        json.dump(scores, f, indent=2)
    print(f"  Updated running scores: {scores_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Dave's Sweater daily comparison")
    parser.add_argument("--date", type=str, help="Date to compare (YYYY-MM-DD, default: yesterday)")
    parser.add_argument("--sweater-only", action="store_true", help="Just check sweater weather for today")
    args = parser.parse_args()

    if args.sweater_only:
        # Quick sweater check using current Open-Meteo data
        from capture_openmeteo import fetch_json, FORECAST_URL
        raw = fetch_json(FORECAST_URL)
        current = raw.get("current", {})
        temp = current.get("temperature_2m")
        wind = current.get("wind_speed_10m", 0)
        result = is_sweater_weather(temp, wind)
        print(f"\n🧣 IS IT SWEATER WEATHER IN BOONE?")
        print(f"   {result['answer']} {result.get('emoji', '')}")
        print(f"   {result['detail']}")
        print(f"   Layers: {result['layers']}")
    else:
        run_daily_comparison(args.date)
