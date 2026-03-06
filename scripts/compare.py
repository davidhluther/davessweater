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
from pathlib import Path

EST = timezone(timedelta(hours=-5))
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


# ═══════════════════════════════════════════════════════════════════
# SWEATER WEATHER LOGIC
# ═══════════════════════════════════════════════════════════════════

def is_sweater_weather(temp_f, wind_mph=0, humidity=None):
    """
    The sacred algorithm. Is it sweater weather?

    Rules (for Boone, NC — a mountain town):
    - Below 45°F: YES. Obviously.
    - 45-55°F: YES, but you might survive without one.
    - 55-65°F: MAYBE. Depends on wind and your courage.
    - Above 65°F: NO. Put the sweater away, Dave.

    Wind chill adjustment: every 10 mph of wind drops the
    effective "sweater threshold" by ~5°F.
    """
    if temp_f is None:
        return {"answer": "UNKNOWN", "detail": "No temperature data. Wear one just in case.", "layers": "?"}

    # Wind chill adjustment (simplified)
    effective_temp = temp_f
    if wind_mph and wind_mph > 5:
        effective_temp = temp_f - (wind_mph / 10) * 5

    if effective_temp < 32:
        return {
            "answer": "ABSOLUTELY",
            "detail": f"It's {temp_f:.0f}°F. That's not sweater weather, that's SWEATER EMERGENCY.",
            "layers": "3+ (sweater, fleece, AND a coat)",
            "emoji": "🥶🧥",
            "sweater_count": 5,
        }
    elif effective_temp < 45:
        return {
            "answer": "YES",
            "detail": f"It's {temp_f:.0f}°F. Classic sweater weather. This is what we're here for.",
            "layers": "2 (solid sweater + optional layer)",
            "emoji": "🧣✅",
            "sweater_count": 4,
        }
    elif effective_temp < 55:
        return {
            "answer": "YES",
            "detail": f"It's {temp_f:.0f}°F. Still sweater territory. Don't let anyone tell you otherwise.",
            "layers": "1-2 (light to medium sweater)",
            "emoji": "🧶👍",
            "sweater_count": 3,
        }
    elif effective_temp < 65:
        return {
            "answer": "MAYBE",
            "detail": f"It's {temp_f:.0f}°F. You could go either way. Bring it and decide later.",
            "layers": "0-1 (light layer, keep one in the car)",
            "emoji": "🤔",
            "sweater_count": 2,
        }
    elif effective_temp < 75:
        return {
            "answer": "NO",
            "detail": f"It's {temp_f:.0f}°F. No sweater needed unless you're in aggressive AC.",
            "layers": "0 (the sweater rests today)",
            "emoji": "☀️❌",
            "sweater_count": 1,
        }
    else:
        return {
            "answer": "ABSOLUTELY NOT",
            "detail": f"It's {temp_f:.0f}°F. Wearing a sweater would be a cry for help.",
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


def score_prediction(predicted, actual):
    """
    Score a prediction against actuals. Returns 0-100.

    Scoring (fixed 100-point scale, missing predictions score 0):
    - High temp: up to 30 pts (within 2°F = full, scaled down from there)
    - Low temp: up to 30 pts (same scale)
    - Wind speed: up to 20 pts (within 3 mph = full, scaled down from there)
    - Precipitation: up to 20 pts (10 binary + 10 amount accuracy)
    """
    score = 0
    breakdown = {}

    pred_high = _get_high(predicted)
    pred_low = _get_low(predicted)
    actual_high = _get_high(actual)
    actual_low = _get_low(actual)

    # High temp (30 pts — within 2°F = full, lose 3 pts per degree beyond that)
    if pred_high is not None and actual_high is not None:
        high_err = abs(pred_high - actual_high)
        high_pts = max(0, 30 - max(0, high_err - 2) * 3)
        score += high_pts
        breakdown["high_temp"] = {
            "predicted": pred_high,
            "actual": actual_high,
            "error_f": round(high_err, 1),
            "points": round(high_pts, 1),
            "max": 30,
        }
    else:
        breakdown["high_temp"] = {"error": "missing data", "points": 0, "max": 30}

    # Low temp (30 pts — within 2°F = full, lose 3 pts per degree beyond that)
    if pred_low is not None and actual_low is not None:
        low_err = abs(pred_low - actual_low)
        low_pts = max(0, 30 - max(0, low_err - 2) * 3)
        score += low_pts
        breakdown["low_temp"] = {
            "predicted": pred_low,
            "actual": actual_low,
            "error_f": round(low_err, 1),
            "points": round(low_pts, 1),
            "max": 30,
        }
    else:
        breakdown["low_temp"] = {"error": "missing data", "points": 0, "max": 30}

    # Precipitation (20 pts: 10 binary call + 10 amount accuracy)
    pred_precip_in = predicted.get("precip_in")
    actual_precip_in = actual.get("precip_in") or 0
    if pred_precip_in is not None:
        pred_precip_val = pred_precip_in or 0
        pred_precip = pred_precip_val > 0.01
        actual_precip = actual_precip_in > 0.01

        # Binary: did it rain or not? (10 pts)
        binary_pts = 10 if pred_precip == actual_precip else 0

        # Amount accuracy (10 pts) — lose 2 pts per 0.1" difference
        precip_err = abs(pred_precip_val - actual_precip_in)
        amount_pts = max(0, 10 - precip_err * 20)

        precip_pts = binary_pts + amount_pts
        score += precip_pts
        breakdown["precipitation"] = {
            "predicted_in": round(pred_precip_val, 3),
            "actual_in": round(actual_precip_in, 3),
            "binary_correct": pred_precip == actual_precip,
            "error_in": round(precip_err, 3),
            "points": round(precip_pts, 1),
            "max": 20,
        }
    else:
        breakdown["precipitation"] = {"error": "missing data", "points": 0, "max": 20}

    # Wind speed (20 pts — within 3 mph = full, lose 2 pts per mph beyond that)
    pred_wind = predicted.get("wind_mph")
    actual_wind = actual.get("wind_mph")
    if pred_wind is not None and actual_wind is not None:
        wind_err = abs(pred_wind - actual_wind)
        wind_pts = max(0, 20 - max(0, wind_err - 3) * 2)
        score += wind_pts
        breakdown["wind"] = {
            "predicted_mph": round(pred_wind, 1),
            "actual_mph": round(actual_wind, 1),
            "error_mph": round(wind_err, 1),
            "points": round(wind_pts, 1),
            "max": 20,
        }
    else:
        breakdown["wind"] = {"error": "missing data", "points": 0, "max": 20}

    total = round(score, 1)
    return {
        "score": total,
        "grade": _score_grade(total),
        "breakdown": breakdown,
    }


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

    # Try to fill gaps from daily array
    if rays_data.get("daily"):
        for day in rays_data["daily"]:
            if day.get("date") == target_date:
                if pred.get("today_high_f") is None and day.get("high_f") is not None:
                    pred["today_high_f"] = day["high_f"]
                if pred.get("tonight_low_f") is None and day.get("low_f") is not None:
                    pred["tonight_low_f"] = day["low_f"]
                # Carry over other fields
                for k in ("category", "precip_in", "daytime_desc"):
                    if k in day and k not in pred:
                        pred[k] = day[k]
                break

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


def _score_grade(score):
    """Convert score to a grade with ray_count for face icons."""
    if score >= 90:
        return {"verdict": "right", "ray_count": 5}
    elif score >= 75:
        return {"verdict": "right", "ray_count": 4}
    elif score >= 60:
        return {"verdict": "meh", "ray_count": 3}
    elif score >= 40:
        return {"verdict": "wrong", "ray_count": 2}
    else:
        return {"verdict": "wrong", "ray_count": 1}


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
                result = score_prediction(day, actuals)
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
            result = score_prediction(rays_pred, actuals)
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

    # Score Apple Weather prediction (from iPhone Shortcut)
    apple_path = pred_dir / "iphone_forecast_apple.json"
    if apple_path.exists():
        apple_data = _parse_apple_forecast(apple_path)
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
            result = score_prediction(apple_data, actuals)
            comparison["sources"]["apple_weather"] = {
                "prediction": apple_data,
                "score": result,
            }
            print(f"  Apple Weather: {result['score']}/100")
        else:
            print(f"  Apple Weather: No temperature data to score")
    else:
        print(f"  No Apple Weather prediction found for {target_date}")

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
