#!/usr/bin/env python3
"""roads.py — winter road-condition forecast rubric + scorer (pure logic).

Turns the pipeline's existing Open-Meteo forecast (low/high/snow/rain/precip_type)
into a road-surface verdict. Thresholds live in RUBRIC so /methodology can render
the exact numbers the code runs (same transparent pattern as the weather scoring).

The __main__ writer reads the newest committed Open-Meteo prediction and emits
data/roads_forecast.json. Stdlib only; fail-closed (a missing input skips cleanly
and always exits 0 so the daily workflow can never fail on it).
"""
from __future__ import annotations

# Ordinal severity, best -> worst. The index IS the severity (used by the scorer).
LEVELS = ["Clear", "Wet", "Slushy", "Icy", "Hazardous"]

RUBRIC = {
    "hazard_snow_in": 2.0,   # >= this much forecast snow -> Hazardous
    "refreeze_low_f": 30.0,  # any precip with a low at/below this -> Icy (refreeze)
    "slushy_snow_in": 0.1,   # any real snow above the refreeze low -> Slushy
    "wet_rain_in": 0.1,      # >= this much rain (no freeze) -> Wet
}

# Open-Meteo WMO weather codes that mean freezing drizzle / freezing rain — the
# worst surface case. Detected from the forecast row when present so real
# freezing-rain days reach Hazardous without a hand-set flag.
FREEZING_WX_CODES = {56, 57, 66, 67}


def road_condition_forecast(day: dict) -> dict:
    """day: {low_f, high_f, snow_in, rain_in, precip_type, weather_code?, freezing?} -> verdict.

    Returns {level, reason, risk}. Robust to missing/None fields (absent precip is
    treated as zero; an absent low is treated as "unknown — not cold enough to
    refreeze"). Freezing rain is signalled either explicitly (`freezing`) or by a
    freezing-precip WMO `weather_code`; plain rain into cold air is Icy (refreeze /
    black-ice risk), not automatically Hazardous.
    """
    low = day.get("low_f")
    snow = day.get("snow_in") or 0.0
    rain = day.get("rain_in") or 0.0
    R = RUBRIC
    freezing_rain = bool(day.get("freezing")) or (day.get("weather_code") in FREEZING_WX_CODES)

    if freezing_rain or snow >= R["hazard_snow_in"]:
        level, reason = "Hazardous", _reason_hazard(snow, freezing_rain, low)
    elif low is not None and low <= R["refreeze_low_f"] and (rain > 0 or snow > 0):
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
        lowtxt = f" (low ~{low:.0f}°F)" if low is not None else ""
        return f"Rain into sub-freezing air{lowtxt}: freezing rain / black-ice risk."
    return f"Heavy snow (~{snow:.1f} in) forecast; expect covered, hazardous roads."


def _reason_icy(snow, rain, low):
    lowtxt = f"{low:.0f}°F" if low is not None else "freezing"
    if snow:
        return f"About {snow:.1f} in of snow with a low near {lowtxt}; icy patches likely."
    return f"Wet roads with a low near {lowtxt}; refreeze / black-ice risk overnight."


def score_road_forecast(forecast_level: str, actual_level: str) -> dict:
    """Ordinal accuracy: exact = 100, each level of distance costs 25 pts (floor 0)."""
    fi, ai = LEVELS.index(forecast_level), LEVELS.index(actual_level)
    distance = abs(fi - ai)
    score = max(0, 100 - 25 * distance)
    return {"score": score, "distance": distance,
            "forecast": forecast_level, "actual": actual_level}


# --- daily writer (I/O; verified by running, not a unit test) -----------------

import json  # noqa: E402
import sys  # noqa: E402
from datetime import datetime  # noqa: E402
from pathlib import Path  # noqa: E402
from zoneinfo import ZoneInfo  # noqa: E402

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def _latest_openmeteo():
    """Newest data/predictions/{date}/openmeteo_forecast.json, or None."""
    pred = DATA_DIR / "predictions"
    if not pred.exists():
        return None
    days = sorted(d for d in pred.iterdir() if d.is_dir())
    for d in reversed(days):
        f = d / "openmeteo_forecast.json"
        if f.exists():
            try:
                return json.loads(f.read_text())
            except ValueError:
                continue
    return None


def write_forecast() -> int:
    om = _latest_openmeteo()
    if not om:
        print("no openmeteo forecast found; skipping roads_forecast.json", file=sys.stderr)
        return 0
    out = {
        "generated_at": datetime.now(NY).isoformat(),
        "source": "Open-Meteo forecast (pipeline-committed) + road-condition rubric",
        "location": om.get("location", "Boone"),
        "rubric": RUBRIC,
        "levels": LEVELS,
        "days": [
            {"date": row.get("date"), **road_condition_forecast(row)}
            for row in om.get("daily", [])
        ],
    }
    (DATA_DIR / "roads_forecast.json").write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote data/roads_forecast.json ({len(out['days'])} days)")
    return 0


if __name__ == "__main__":
    sys.exit(write_forecast())
