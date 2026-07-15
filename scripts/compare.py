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
            "layers": "3+",
            "emoji": "🥶🧥",
            "sweater_count": 5,
        }
    elif effective_temp < 45:
        return {
            "answer": "YES",
            "detail": "Classic sweater weather. This is what we're here for.",
            "layers": "2",
            "emoji": "🧣✅",
            "sweater_count": 4,
        }
    elif effective_temp < 55:
        return {
            "answer": "YES",
            "detail": "Still sweater territory. Don't let anyone tell you otherwise.",
            "layers": "1-2",
            "emoji": "🧶👍",
            "sweater_count": 3,
        }
    elif effective_temp < 65:
        return {
            "answer": "MAYBE",
            "detail": "You could go either way. Bring it and decide later.",
            "layers": "0-1",
            "emoji": "🤔",
            "sweater_count": 2,
        }
    elif effective_temp < 75:
        return {
            "answer": "NO",
            "detail": "No sweater needed unless you're in aggressive AC.",
            "layers": "0",
            "emoji": "☀️❌",
            "sweater_count": 1,
        }
    else:
        return {
            "answer": "ABSOLUTELY NOT",
            "detail": "Wearing a sweater would be a cry for help.",
            "layers": "0",
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
    cat = pred.get("category")
    # Precip TYPE follows the forecast's weather category: a rain / storm / snow
    # forecast IS a precip forecast even when its predicted amount rounds to 0" (e.g.
    # Open-Meteo can pair a thunderstorm weather-code with 0" QPF). This overrides an
    # amount-derived "none", and keeps the Apple fallback — which reads the conditions
    # text — consistent with Open-Meteo. Amount is scored separately.
    if cat in _CAT_TO_TYPE and _CAT_TO_TYPE[cat] != "none" and ptype in (None, "none"):
        ptype = _CAT_TO_TYPE[cat]
    elif ptype is None:
        if pred.get("daytime_desc"):
            d = pred["daytime_desc"].lower()
            if any(w in d for w in ("snow", "flurr", "sleet", "wintry")):
                ptype = "snow"
            elif any(w in d for w in ("rain", "shower", "storm", "thunder", "drizzle")):
                ptype = "rain"
            else:
                ptype = "none"
        elif rain is not None or snow is not None:
            ptype = derive_type(rain, snow)
    # A "no precipitation" forecast IS a zero-inch amount forecast — score it as
    # such, so a source that says "no rain" earns the amount points on dry days
    # instead of forfeiting them. When rain/snow IS predicted but no amount is
    # given (Ray says "rain" but no total), the amount stays None and is scored as
    # a miss — you can't gain by leaving the hard field blank.
    if ptype == "none":
        if rain is None:
            rain = 0.0
        if snow is None:
            snow = 0.0
    if pred.get("fields_provided"):
        fp = list(pred["fields_provided"])
        if ptype == "none":
            for amt in ("rain_amount", "snow_amount"):
                if amt not in fp:
                    fp.append(amt)
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
# CAPTURE-DAY LOW RECOVERY (bucket-aggregating sources)
# ═══════════════════════════════════════════════════════════════════
# Met.no and OpenWeatherMap derive the daily low as min() over their sub-daily
# timeseries. On the capture day (~midday) that series no longer covers the
# pre-dawn hours, so its "low" is the afternoon/evening minimum — biased warm by
# 5–17°F, which unfairly tanked the low-temp score (30 of 100 pts) on every one
# of their scored days. Recover the capture-day low from the day-ahead forecast
# issued the prior morning (predictions/{date-1}/{key}_forecast.json), whose row
# for the date spans the full (UTC) day and so still reaches the overnight trough
# the midday capture missed. Forfeit the low only when no prior capture exists.
# Sources reading a provider daily-min (Open-Meteo, NWS, WeatherAPI, Visual
# Crossing, Tomorrow.io, Google) are unaffected.
#
# Membership rule: add any source whose adapter derives the daily low via min()
# over a partial-day sub-daily series (rather than a provider-supplied daily
# minimum), or it will silently reintroduce the warm bias for that source.
_BUCKET_LOW_SOURCES = {"metno", "openweathermap"}


def _prev_date(date_str):
    return (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")


def _day_ahead_low(key, date):
    """The low `key` forecast for `date` in the prior day's capture, or None."""
    fpath = DATA_DIR / "predictions" / _prev_date(date) / f"{key}_forecast.json"
    if not fpath.exists():
        return None
    try:
        data = json.load(open(fpath))
    except (json.JSONDecodeError, OSError):
        return None
    for row in data.get("daily", []):
        if row.get("date") == date:
            return row.get("low_f")
    return None


def _fix_bucket_low(key, date, day):
    """For bucket-low sources, replace the partial-capture-day low with the
    day-ahead forecast low; forfeit 'low' when no prior forecast exists.
    Mutates and returns the day/prediction dict; a no-op for other sources."""
    if key not in _BUCKET_LOW_SOURCES:
        return day
    recovered = _day_ahead_low(key, date)
    if recovered is not None:
        day["low_f"] = recovered
    else:
        day["low_f"] = None
        fp = day.get("fields_provided")
        if isinstance(fp, list):
            day["fields_provided"] = [f for f in fp if f != "low"]
    return day


# ═══════════════════════════════════════════════════════════════════
# DAVE'S SWEATER INDEX (DSI) — the composite consensus
# ═══════════════════════════════════════════════════════════════════
# The DSI is our own forecast: the mean of the independent automated forecasters,
# scored on the exact same 100-point contract as every source it aggregates —
# because the whole point of the tracker is "we check them all, including ours."
#
# This MIRRORS the display composite in src/lib/composite.ts (same members, same
# ≥2 guard, same high/low mean, same majority precip-type vote) and EXTENDS it:
# the site's composite renders only high/low/precip, but to grade the DSI fairly
# against sources that publish wind and precip amount, the *scored* DSI also
# averages those fields. Feed the aggregate through the same _to_contract +
# score_prediction path so the implied-zero rule and field handling stay
# identical to every other source. Keep the member set and vote logic in sync
# with composite.ts if either changes.
COMPOSITE_KEY = "composite"
# Excluded from the consensus, matching composite.ts: Ray's is the forecaster we
# grade against, and the Apple slot mirrors the Open-Meteo fallback (including it
# would double-weight Open-Meteo).
COMPOSITE_EXCLUDE = {"raysweather", "apple_weather"}


def _mean(xs):
    return sum(xs) / len(xs)


def _contract_wind(contract):
    """Point wind for a scored contract: interval midpoint if it carries one,
    else the scalar. None when the source published no wind."""
    if "wind" not in contract.get("fields_provided", []):
        return None
    lo, hi = contract.get("wind_lo"), contract.get("wind_hi")
    if lo is not None and hi is not None:
        return (lo + hi) / 2.0
    return contract.get("wind_mph")


def build_composite(member_contracts, norm_actual):
    """Aggregate the member forecasters' scored contracts into the DSI and score
    it. `member_contracts` maps source key -> the contract that was scored for it
    (post _to_contract). Returns {"prediction", "score"} or None when fewer than
    two members supply a high or a low (same guard as composite.ts — a consensus
    needs at least two voices)."""
    highs = [c["high_f"] for c in member_contracts.values() if c.get("high_f") is not None]
    lows = [c["low_f"] for c in member_contracts.values() if c.get("low_f") is not None]
    if len(highs) < 2 or len(lows) < 2:
        return None

    winds = [w for c in member_contracts.values() if (w := _contract_wind(c)) is not None]
    rains = [c["rain_in"] for c in member_contracts.values()
             if "rain_amount" in c.get("fields_provided", []) and c.get("rain_in") is not None]
    snows = [c["snow_in"] for c in member_contracts.values()
             if "snow_amount" in c.get("fields_provided", []) and c.get("snow_in") is not None]

    # Majority precip type across the members that contributed a high (mirrors
    # composite.ts): one clear leader wins; a tie that includes "none" stays
    # "none"; a tie purely between precip types reads as "mixed".
    counts = {}
    for c in member_contracts.values():
        if c.get("high_f") is None:
            continue
        t = c.get("precip_type")
        if t:
            counts[t] = counts.get(t, 0) + 1
    top = max(counts.values()) if counts else 0
    leaders = [k for k, v in counts.items() if v == top]
    if len(leaders) == 1:
        precip = leaders[0]
    elif not leaders or "none" in leaders:
        precip = "none"
    else:
        precip = "mixed"

    rain_mean = round(_mean(rains), 3) if rains else None
    snow_mean = round(_mean(snows), 3) if snows else None
    # precip_in is display-only (the "Rain" column on the site); scoring reads
    # rain_in/snow_in. Keep it consistent with the members' raw shape.
    precip_in = None
    if rain_mean is not None or snow_mean is not None:
        precip_in = round((rain_mean or 0) + (snow_mean or 0), 3)

    raw = {
        "high_f": round(_mean(highs), 1),
        "low_f": round(_mean(lows), 1),
        "wind_mph": round(_mean(winds), 1) if winds else None,
        "precip_type": precip,
        "rain_in": rain_mean,
        "snow_in": snow_mean,
        "precip_in": precip_in,
        # Provenance so the row is auditable: who fed the consensus this day.
        "members": sorted(member_contracts.keys()),
        "member_count": len(highs),
    }
    result = score_prediction(_to_contract(raw), norm_actual)
    return {"prediction": raw, "score": result}


def add_composite_source(comparison):
    """Compute the DSI for a comparison and attach it as sources['composite'].
    Rebuilds from the member sources on every call (idempotent); removes any
    stale composite when fewer than two members are scoreable. Members are every
    scored source except the COMPOSITE_EXCLUDE set — reproduced from each stored
    raw prediction via _to_contract so live and backfill runs agree exactly."""
    actuals = comparison.get("actuals")
    if not actuals:
        return None
    norm = _normalize_actual(actuals)
    members = {}
    for key, sd in comparison.get("sources", {}).items():
        if key in COMPOSITE_EXCLUDE or key == COMPOSITE_KEY:
            continue
        pred = sd.get("prediction")
        if pred is None or "score" not in sd:
            continue
        members[key] = _to_contract(pred)
    built = build_composite(members, norm)
    if built is None:
        comparison.get("sources", {}).pop(COMPOSITE_KEY, None)
        return None
    comparison["sources"][COMPOSITE_KEY] = built
    return built


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

    # Score Ray's prediction (from extracted data — may be sparse).
    # Prefer the backfill-rebuilt sibling (anchored dates + recovered wind
    # interval / precip_type) when present; fall back to the original capture.
    rays_rebuilt = pred_dir / "rays_boone.rebuilt.json"
    rays_path = rays_rebuilt if rays_rebuilt.exists() else pred_dir / "rays_boone.json"
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
                # Record which data backed the Apple slot: real Apple ("iPhone
                # Shortcut" or a backfilled screenshot) vs the Open-Meteo fallback.
                "source": apple_source,
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
                day = _fix_bucket_low(key, target_date, day)
                result = score_prediction(_to_contract(day), norm_actual)
                comparison["sources"][key] = {"prediction": day, "score": result}
                print(f"  {s['label']}: {result['score']}/100")
                break

    # Dave's Sweater Index — the consensus of the members just scored above.
    # Added last so it aggregates every source that reported today.
    dsi = add_composite_source(comparison)
    if dsi:
        print(f"  Dave's Sweater Index ({dsi['prediction']['member_count']} sources): "
              f"{dsi['score']['score']}/100")

    # Sweater weather verdict
    sw = comparison["sweater_weather"]
    print(f"\n  🧣 Sweater Weather? {sw['answer']} {sw.get('emoji', '')}")
    print(f"     {sw['detail']}")
    print(f"     Recommended layers: {sw['layers']}")

    # Don't persist a comparison with nothing scored — an empty-sources file only
    # creates a ghost row in scores.json (a date with no source data). Skip it so
    # a partial/failed run can't quietly seed a phantom day.
    if not any("score" in d for d in comparison["sources"].values()):
        print(f"  No source scored for {target_date}; skipping comparison write.")
        return None

    # Save comparison
    comp_dir = DATA_DIR / "comparisons"
    comp_dir.mkdir(parents=True, exist_ok=True)
    comp_path = comp_dir / f"{target_date}.json"
    with open(comp_path, "w") as f:
        json.dump(comparison, f, indent=2)
    print(f"\n  Saved comparison: {comp_path}")

    # Update running score
    _update_running_scores(target_date, comparison)

    # Emit the newest unscored forecasts for the "what they're predicting now" section
    build_latest_forecasts()
    build_forecast_5day()

    return comparison


def _update_running_scores(date, comparison):
    """Rebuild running scores (entries + totals + coverage) from ALL comparison
    files — the single source of truth — so a re-score can never leave stale per-day
    rows. (Was append-only, which silently froze existing entries after a re-score and
    let the public per-day numbers drift out of sync with the totals.) The current
    date's comparison file is already on disk when this runs, so it is included."""
    scores_path = DATA_DIR / "scores.json"
    comp_dir = DATA_DIR / "comparisons"
    cov_fields = ["high_temp", "low_temp", "wind", "precip_type", "precip_amount"]

    entries, totals, coverage = [], {}, {}
    for comp_file in sorted(comp_dir.glob("*.json")):
        try:
            with open(comp_file) as f:
                comp = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        entry = {"date": comp.get("date") or comp_file.stem}
        for source, data in comp.get("sources", {}).items():
            if "score" not in data:
                continue
            entry[source] = data["score"]["score"]
            if source not in totals:
                totals[source] = {"right": 0, "wrong": 0, "meh": 0, "total_score": 0, "days": 0}
            totals[source][data["score"]["grade"]["verdict"]] += 1
            totals[source]["total_score"] += data["score"]["score"]
            totals[source]["days"] += 1
            cov = data["score"].get("coverage", {})
            if source not in coverage:
                coverage[source] = {fld: {"provided": 0, "days": 0} for fld in cov_fields}
            for fld in cov_fields:
                coverage[source][fld]["days"] += 1
                if cov.get(fld):
                    coverage[source][fld]["provided"] += 1
        sw = comp.get("sweater_weather")
        if isinstance(sw, dict) and "answer" in sw:
            entry["sweater_weather"] = sw["answer"]
        entries.append(entry)

    scores = {"entries": entries, "totals": totals, "coverage": coverage}
    with open(scores_path, "w") as f:
        json.dump(scores, f, indent=2)
    print(f"  Updated running scores: {scores_path} ({len(entries)} entries)")


# ═══════════════════════════════════════════════════════════════════
# UPCOMING (UNSCORED) FORECASTS — "what they're predicting now"
# ═══════════════════════════════════════════════════════════════════

SOURCE_LABELS = {"openmeteo": "Open-Meteo", "raysweather": "Ray's Weather", "apple_weather": "Apple Weather"}


def _wind_display(contract):
    lo, hi = contract.get("wind_lo"), contract.get("wind_hi")
    if lo is not None and hi is not None:
        return f"{round(lo)}–{round(hi)} mph"
    w = contract.get("wind_mph")
    return f"{round(w)} mph" if w is not None else None


def _forecast_display(contract):
    return {
        "high_f": contract.get("high_f"),
        "low_f": contract.get("low_f"),
        "wind": _wind_display(contract),
        "precip_type": contract.get("precip_type"),
    }


def _has_captures(pred_dir):
    """A capture folder counts as real only if a source actually wrote a forecast
    there. A failed capture (e.g. a hung Action) can leave an empty folder, and
    anchoring on it blanks latest_forecasts.json and forecast_5day.json — the whole
    homepage Today module + 5-day strip (as happened 2026-07-09)."""
    return (any(pred_dir.glob("*_forecast.json"))
            or (pred_dir / "rays_boone.json").exists()
            or (pred_dir / "rays_boone.rebuilt.json").exists())


def _newest_unscored_capture():
    """The newest predictions/{date} capture folder with no comparison yet (the
    current upcoming day), or None. BOTH unscored-forecast builders anchor here:
    latest_forecasts.json and forecast_5day.json must agree on the capture
    folder or the site contradicts itself (the day panel shows one date, the
    5-day strip starts on another). Empty folders from a failed capture are
    skipped so the anchor falls back to the newest folder that actually has data."""
    import re
    pred_root = DATA_DIR / "predictions"
    if not pred_root.exists():
        return None
    comp_dir = DATA_DIR / "comparisons"
    dirs = sorted(d.name for d in pred_root.iterdir()
                  if d.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", d.name)
                  and _has_captures(d)
                  and not (comp_dir / f"{d.name}.json").exists())
    return dirs[-1] if dirs else None


def build_latest_forecasts():
    """Emit data/latest_forecasts.json — each source's newest *unscored* forecast
    (the upcoming day, before its actuals exist), so the site can show "here's what
    each predicts; come back and check." Reuses the same per-source parsing as the
    daily comparison so nothing is duplicated. No scoring (no actuals yet)."""
    date = _newest_unscored_capture()
    if date is None:
        return None
    pred_dir = DATA_DIR / "predictions" / date
    sources = {}

    om = pred_dir / "openmeteo_forecast.json"
    if om.exists():
        for day in json.load(open(om)).get("daily", []):
            if day.get("date") == date:
                sources["openmeteo"] = _forecast_display(_to_contract(day))
                break

    rays_rebuilt = pred_dir / "rays_boone.rebuilt.json"
    rays_path = rays_rebuilt if rays_rebuilt.exists() else pred_dir / "rays_boone.json"
    if rays_path.exists():
        rays_pred = _best_rays_prediction(json.load(open(rays_path)), date)
        if rays_pred and (_get_high(rays_pred) is not None or _get_low(rays_pred) is not None):
            sources["raysweather"] = _forecast_display(_to_contract(rays_pred))

    apple_path = pred_dir / "iphone_forecast_apple.json"
    apple_data = None
    if apple_path.exists():
        apple_data = _parse_apple_forecast(apple_path)
    elif (pred_dir / "iphone_forecast.json").exists():
        apple_data = _parse_apple_forecast(pred_dir / "iphone_forecast.json")
        if isinstance(apple_data, dict) and isinstance(apple_data.get("forecast"), dict):
            apple_data = dict(apple_data["forecast"])
    if apple_data:
        if apple_data.get("conditions") and not apple_data.get("category"):
            apple_data["category"] = _apple_condition_to_category(apple_data["conditions"])
        if "precip_in" not in apple_data and apple_data.get("category"):
            cat = apple_data["category"]
            if cat in ("rain", "drizzle", "storm", "snow"):
                apple_data["precip_in"] = 0.01
            elif cat != "unknown":
                apple_data["precip_in"] = 0.0
        if _get_high(apple_data) is not None or _get_low(apple_data) is not None:
            sources["apple_weather"] = _forecast_display(_to_contract(apple_data))

    for s in SOURCES:
        key = s["key"]
        if key in sources:
            continue
        fpath = pred_dir / f"{key}_forecast.json"
        if not fpath.exists():
            continue
        try:
            data = json.load(open(fpath))
        except (json.JSONDecodeError, OSError):
            continue
        for day in data.get("daily", []):
            if day.get("date") == date:
                day = _fix_bucket_low(key, date, day)
                sources[key] = _forecast_display(_to_contract(day))
                break

    labels = dict(SOURCE_LABELS)
    for s in SOURCES:
        labels[s["key"]] = s["label"]
    for k, v in sources.items():
        v["label"] = labels.get(k, k)

    if not sources:
        # Anchor had no parseable sources — writing this would blank the homepage's
        # Today module. Keep the last good file rather than overwrite it with nothing.
        print(f"  No sources parsed for {date}; keeping previous latest_forecasts.json.")
        return None
    out = {"date": date, "generated_at": datetime.now(EST).isoformat(), "sources": sources}
    with open(DATA_DIR / "latest_forecasts.json", "w") as f:
        json.dump(out, f, indent=2)
    print(f"  Wrote latest forecasts: {len(sources)} sources for {date}")
    return out


# Daytime window for the rain-timing bars: 6 AM–10 PM local, the hours a person
# is actually out in the weather. The capture URL sets timezone=America/New_York,
# so Open-Meteo's hourly timestamps are already local and the hour slices directly.
_HOURLY_START, _HOURLY_END = 6, 22


def _daytime_hourly(hourly, window):
    """Group Open-Meteo hourly precip into per-date daytime lists.

    `hourly` is the raw {time, precipitation, precipitation_probability} block
    from openmeteo_forecast.json. Returns {date: [{hour, prob, inches}, ...]}
    for dates in `window`, restricted to _HOURLY_START.._HOURLY_END inclusive.
    Tolerant of ragged/short arrays (same idiom as the daily loop)."""
    times = hourly.get("time") or []
    precip = hourly.get("precipitation") or []
    prob = hourly.get("precipitation_probability") or []
    win = set(window)
    out = {}
    for i, t in enumerate(times):
        date = t[:10]  # "2026-07-09T14:00" -> "2026-07-09"
        if date not in win:
            continue
        try:
            hour = int(t[11:13])
        except (ValueError, IndexError):
            continue
        if hour < _HOURLY_START or hour > _HOURLY_END:
            continue
        out.setdefault(date, []).append({
            "hour": hour,
            "prob": prob[i] if i < len(prob) and prob[i] is not None else 0,
            "inches": round(precip[i], 3) if i < len(precip) and precip[i] is not None else 0.0,
        })
    return out


def build_forecast_5day():
    """Emit data/forecast_5day.json — every source's outlook for the next six
    days (capture day + 5), read from the same newest-unscored capture folder
    build_latest_forecasts anchors on. Each days[] entry carries the exact
    per-source shape of latest_forecasts.json ({high_f, low_f, wind,
    precip_type[, precip_prob], label}) so the TS compositeForecast() consumes
    each day unchanged — the composite itself stays in TS (src/lib/composite.ts),
    which also owns the Ray's/Apple EXCLUDE set, so both are included here just
    like the daily file. Missing or corrupt capture files skip that source
    (same tolerance idiom as the source loop above)."""
    date = _newest_unscored_capture()
    if date is None:
        return None
    pred_dir = DATA_DIR / "predictions" / date
    start = datetime.strptime(date, "%Y-%m-%d")
    window = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6)]
    days = {}  # date -> {source_key: display dict}
    sky = {}  # date -> Open-Meteo sky category (the only source that carries one)

    def _load(path):
        try:
            return json.load(open(path))
        except (json.JSONDecodeError, OSError):
            return None

    def _put(d, key, pred):
        entry = _forecast_display(_to_contract(pred))
        if pred.get("precip_prob") is not None:
            entry["precip_prob"] = pred["precip_prob"]
        days.setdefault(d, {})[key] = entry

    hourly_by_date = {}  # date -> [{hour, prob, inches}] across the daytime window
    om = _load(pred_dir / "openmeteo_forecast.json")
    if om:
        for day in (om.get("daily") or []):
            if day.get("date") in window:
                _put(day["date"], "openmeteo", day)
                sky[day["date"]] = day.get("category")
        hourly_by_date = _daytime_hourly(om.get("hourly") or {}, window)

    rays_rebuilt = pred_dir / "rays_boone.rebuilt.json"
    rays = _load(rays_rebuilt if rays_rebuilt.exists() else pred_dir / "rays_boone.json")
    if rays:
        rows = {r.get("date"): r for r in (rays.get("daily") or [])}
        for d in window:
            # Day 0 mirrors build_latest_forecasts: _best_rays_prediction merges
            # the capture-day strip over daily[]. Beyond day 0 the strip
            # describes the capture day, not d, so only an exact daily[] row
            # counts — fed through the same helper one row at a time so its
            # field whitelist (which never carries precip_in) still applies.
            # Same rule as leadtime._rays_row.
            if d == date:
                pred = _best_rays_prediction(rays, d)
            elif d in rows:
                pred = _best_rays_prediction({"daily": [rows[d]]}, d)
            else:
                continue
            if pred and (_get_high(pred) is not None or _get_low(pred) is not None):
                _put(d, "raysweather", pred)

    # Apple is a flat single-day capture (the real Shortcut file, or the
    # fallback's nested `forecast` dict), so it only ever contributes day 0 —
    # same parse as build_latest_forecasts, same reason leadtime.py skips it.
    apple_data = None
    try:
        apple_path = pred_dir / "iphone_forecast_apple.json"
        if apple_path.exists():
            apple_data = _parse_apple_forecast(apple_path)
        elif (pred_dir / "iphone_forecast.json").exists():
            apple_data = _parse_apple_forecast(pred_dir / "iphone_forecast.json")
            if isinstance(apple_data, dict) and isinstance(apple_data.get("forecast"), dict):
                apple_data = dict(apple_data["forecast"])
    except (json.JSONDecodeError, OSError):
        apple_data = None
    if apple_data:
        if apple_data.get("conditions") and not apple_data.get("category"):
            apple_data["category"] = _apple_condition_to_category(apple_data["conditions"])
        if "precip_in" not in apple_data and apple_data.get("category"):
            cat = apple_data["category"]
            if cat in ("rain", "drizzle", "storm", "snow"):
                apple_data["precip_in"] = 0.01
            elif cat != "unknown":
                apple_data["precip_in"] = 0.0
        if _get_high(apple_data) is not None or _get_low(apple_data) is not None:
            _put(date, "apple_weather", apple_data)

    for s in SOURCES:
        key = s["key"]
        data = _load(pred_dir / f"{key}_forecast.json")
        if not data:
            continue
        for day in (data.get("daily") or []):
            d = day.get("date")
            if d not in window or key in days.get(d, {}):
                continue
            if d == date:
                # The capture-day low recovery only applies to day 0 (the
                # midday-capture problem); later rows already span their full
                # day and must keep their own lows (leadtime.score_lead's rule).
                day = _fix_bucket_low(key, d, dict(day))
            _put(d, key, day)

    labels = dict(SOURCE_LABELS)
    for s in SOURCES:
        labels[s["key"]] = s["label"]
    for srcs in days.values():
        for k, v in srcs.items():
            v["label"] = labels.get(k, k)

    def _day_entry(d):
        entry = {"date": d, "sky": sky.get(d), "sources": days[d]}
        hrs = hourly_by_date.get(d)
        # Only attach timing bars where there's a real chance to time — a day of
        # bare 5% bars is noise. UI shows the bar iff `hourly` is present.
        if hrs and any(h["prob"] >= 20 or h["inches"] >= 0.01 for h in hrs):
            entry["hourly"] = hrs
        return entry

    if not days:
        # No parseable forecast days — writing this empties the 5-day strip. Keep
        # the last good file rather than overwrite it with nothing.
        print(f"  No forecast days parsed from {date}; keeping previous forecast_5day.json.")
        return None
    out = {"generated_at": datetime.now(EST).isoformat(), "location": "Boone",
           "days": [_day_entry(d) for d in sorted(days)]}
    with open(DATA_DIR / "forecast_5day.json", "w") as f:
        json.dump(out, f, indent=2)
    print(f"  Wrote 5-day forecasts: {len(days)} days from {date}")
    return out


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Dave's Sweater daily comparison")
    parser.add_argument("--date", type=str, help="Date to compare (YYYY-MM-DD, default: yesterday)")
    parser.add_argument("--sweater-only", action="store_true", help="Just check sweater weather for today")
    parser.add_argument("--forecasts-only", action="store_true",
                        help="Just rebuild data/latest_forecasts.json + data/forecast_5day.json")
    args = parser.parse_args()

    if args.forecasts_only:
        build_latest_forecasts()
        build_forecast_5day()
    elif args.sweater_only:
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
