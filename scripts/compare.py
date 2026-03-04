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

def score_prediction(predicted, actual):
    """
    Score a prediction against actuals. Returns 0-100.

    Scoring:
    - High temp: up to 30 pts (lose 3 pts per degree off)
    - Low temp: up to 30 pts (lose 3 pts per degree off)
    - Precipitation call: up to 20 pts (binary: did it rain/snow or not?)
    - Conditions category: up to 20 pts (clear/cloudy/rain/snow match)
    """
    score = 0
    breakdown = {}

    # High temp (30 pts)
    if predicted.get("high_f") is not None and actual.get("high_f") is not None:
        high_err = abs(predicted["high_f"] - actual["high_f"])
        high_pts = max(0, 30 - high_err * 3)
        score += high_pts
        breakdown["high_temp"] = {
            "predicted": predicted["high_f"],
            "actual": actual["high_f"],
            "error_f": round(high_err, 1),
            "points": round(high_pts, 1),
            "max": 30,
        }
    else:
        breakdown["high_temp"] = {"error": "missing data", "points": 0, "max": 30}

    # Low temp (30 pts)
    if predicted.get("low_f") is not None and actual.get("low_f") is not None:
        low_err = abs(predicted["low_f"] - actual["low_f"])
        low_pts = max(0, 30 - low_err * 3)
        score += low_pts
        breakdown["low_temp"] = {
            "predicted": predicted["low_f"],
            "actual": actual["low_f"],
            "error_f": round(low_err, 1),
            "points": round(low_pts, 1),
            "max": 30,
        }
    else:
        breakdown["low_temp"] = {"error": "missing data", "points": 0, "max": 30}

    # Precipitation (20 pts)
    pred_precip = (predicted.get("precip_in") or 0) > 0.01
    actual_precip = (actual.get("precip_in") or 0) > 0.01
    if pred_precip == actual_precip:
        precip_pts = 20
    else:
        precip_pts = 0
    score += precip_pts
    breakdown["precipitation"] = {
        "predicted_any": pred_precip,
        "actual_any": actual_precip,
        "correct": pred_precip == actual_precip,
        "points": precip_pts,
        "max": 20,
    }

    # Conditions category (20 pts)
    pred_cat = predicted.get("category", "unknown")
    actual_cat = actual.get("category", "unknown")
    if pred_cat == actual_cat:
        cat_pts = 20
    elif _categories_close(pred_cat, actual_cat):
        cat_pts = 10
    else:
        cat_pts = 0
    score += cat_pts
    breakdown["conditions"] = {
        "predicted": pred_cat,
        "actual": actual_cat,
        "match": "exact" if pred_cat == actual_cat else ("close" if cat_pts == 10 else "wrong"),
        "points": cat_pts,
        "max": 20,
    }

    total = round(score, 1)
    return {
        "score": total,
        "grade": _score_grade(total),
        "breakdown": breakdown,
    }


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
    """Convert score to a sweater-themed grade."""
    if score >= 90:
        return {"label": "RIGHT RAY ✅", "detail": "Nailed it. Even a broken clock, etc.",
                "verdict": "right", "ray_count": 5}
    elif score >= 75:
        return {"label": "MOSTLY RIGHT RAY", "detail": "Close enough. We'll give him this one.",
                "verdict": "right", "ray_count": 4}
    elif score >= 60:
        return {"label": "EH RAY 🤷", "detail": "Not great, not terrible. Like a 3.6 roentgen forecast.",
                "verdict": "meh", "ray_count": 3}
    elif score >= 40:
        return {"label": "WRONG RAY ❌", "detail": "Missed it. Should've checked Dave's Sweater.",
                "verdict": "wrong", "ray_count": 2}
    else:
        return {"label": "VERY WRONG RAY ❌❌", "detail": "Spectacularly wrong. Impressive, honestly.",
                "verdict": "wrong", "ray_count": 1}


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
                print(f"  Open-Meteo: {result['score']}/100 — {result['grade']['label']}")
                break
    else:
        print(f"  No Open-Meteo prediction found for {target_date}")

    # Score Ray's prediction (from extracted data — may be sparse)
    rays_path = pred_dir / "rays_boone.json"
    if rays_path.exists():
        with open(rays_path) as f:
            rays_data = json.load(f)
        # Ray's data may not have structured daily forecasts yet
        # We'll score what we have and note what's missing
        if rays_data.get("daily"):
            for day in rays_data["daily"]:
                if day.get("date") == target_date:
                    result = score_prediction(day, actuals)
                    comparison["sources"]["raysweather"] = {
                        "prediction": day,
                        "score": result,
                    }
                    print(f"  Ray's Weather: {result['score']}/100 — {result['grade']['label']}")
                    break
        else:
            comparison["sources"]["raysweather"] = {
                "note": "Screenshot captured but structured data extraction pending",
                "screenshot": f"predictions/{target_date}/rays_forecast.png",
            }
            print(f"  Ray's Weather: Screenshot only (no structured data to score yet)")
    else:
        print(f"  No Ray's Weather prediction found for {target_date}")

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
    """Append today's scores to the running tally."""
    scores_path = DATA_DIR / "scores.json"
    if scores_path.exists():
        with open(scores_path) as f:
            scores = json.load(f)
    else:
        scores = {"entries": [], "totals": {}}

    entry = {"date": date}
    for source, data in comparison.get("sources", {}).items():
        if "score" in data:
            entry[source] = data["score"]["score"]
            # Update running totals
            if source not in scores["totals"]:
                scores["totals"][source] = {"right": 0, "wrong": 0, "meh": 0, "total_score": 0, "days": 0}
            verdict = data["score"]["grade"]["verdict"]
            scores["totals"][source][verdict] += 1
            scores["totals"][source]["total_score"] += data["score"]["score"]
            scores["totals"][source]["days"] += 1

    entry["sweater_weather"] = comparison["sweater_weather"]["answer"]
    scores["entries"].append(entry)

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
