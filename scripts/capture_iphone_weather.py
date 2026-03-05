#!/usr/bin/env python3
"""
capture_iphone_weather.py — fetch current conditions + forecast for Boone, NC
from wttr.in (same underlying model as Apple Weather / iPhone Weather app).

Captures the same fields Ray's Weather displays:

- Current temp
- Feels like
- Wind (direction + speed)
- Gust
- Humidity
- Rainfall (today)
- Forecast Hi / Lo

Saves:
  data/predictions/YYYY-MM-DD/iphone_forecast.json

Run as part of daily_capture.yml at 7:00 AM EST (same time as capture_rays.py).
"""

import json
import sys
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ── config ─────────────────────────────────────────────────────────────────────

LOCATION  = "Boone,NC"
ROOT      = Path(__file__).resolve().parent.parent
EST       = timezone(timedelta(hours=-5))
TODAY     = datetime.now(EST).strftime("%Y-%m-%d")
OUT_DIR   = ROOT / "data" / "predictions" / TODAY
OUT_JSON  = OUT_DIR / "iphone_forecast.json"

# wttr.in JSON v1 endpoint — returns rich current + 3-day forecast
WTTR_URL  = f"https://wttr.in/{urllib.parse.quote(LOCATION)}?format=j1"

# ── helpers ────────────────────────────────────────────────────────────────────

def safe_float(val, default=None):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def mm_to_inches(mm):
    """Convert millimeters to inches, rounded to 2 decimal places."""
    if mm is None:
        return None
    return round(float(mm) / 25.4, 2)


def compass_to_abbr(degrees: float | None) -> str | None:
    """Convert compass degrees to 16-point abbreviation (N, NNE, etc.)."""
    if degrees is None:
        return None
    dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
            "S","SSW","SW","WSW","W","WNW","NW","NNW"]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]

# ── fetch ──────────────────────────────────────────────────────────────────────

def fetch_wttr() -> dict:
    """Fetch wttr.in JSON and return the raw parsed dict."""
    req = urllib.request.Request(
        WTTR_URL,
        headers={
            "User-Agent": "DavesSweater/1.0 (weather accuracy tracker; davessweater.com)",
            "Accept":     "application/json",
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def parse_wttr(raw: dict) -> dict:
    """
    Extract the same fields Ray's Weather page shows:
      Current: temp, feels_like, wind, gust, humidity, rainfall
      Forecast: today_high, tonight_low (from today's weather[0])

    wttr.in field reference:
      current_condition[0]:
        temp_F           current temperature °F
        FeelsLikeF       feels-like °F
        windspeedMiles   wind speed mph
        winddirDegree    wind direction degrees
        winddir16Point   wind direction abbreviation (N, S, SW, etc.)
        windGustMiles    gust mph (may be absent on calm days)
        humidity         relative humidity %
        precipMM         precipitation so far today (mm)

      weather[0] (today):
        maxtempF         forecast high °F
        mintempF         forecast low °F
    """
    captured_at = datetime.now(EST).isoformat()
    result = {
        "date":         TODAY,
        "captured_at":  captured_at,
        "source":       "wttr.in (iPhone-equivalent / Apple Weather model)",
        "location":     LOCATION,
        "current":      {},
        "forecast":     {},
        "error":        None,
    }

    try:
        cur_raw  = raw["current_condition"][0]
        day_raw  = raw["weather"][0]           # today's forecast block

        # ── current conditions ─────────────────────────────────────────────
        temp_f      = safe_float(cur_raw.get("temp_F"))
        feels_f     = safe_float(cur_raw.get("FeelsLikeF"))
        wind_mph    = safe_float(cur_raw.get("windspeedMiles"))
        wind_deg    = safe_float(cur_raw.get("winddirDegree"))
        wind_dir    = cur_raw.get("winddir16Point") or compass_to_abbr(wind_deg)
        gust_mph    = safe_float(cur_raw.get("windGustMiles"))
        humidity    = safe_float(cur_raw.get("humidity"))
        precip_mm   = safe_float(cur_raw.get("precipMM"))
        rainfall_in = mm_to_inches(precip_mm)

        # Format wind the same way Ray does: "S @ 3 mph"
        if wind_dir and wind_mph is not None:
            wind_str = f"{wind_dir} @ {int(wind_mph)} mph"
        elif wind_mph is not None:
            wind_str = f"{int(wind_mph)} mph"
        else:
            wind_str = None

        result["current"] = {
            "temp_f":       temp_f,
            "feels_like_f": feels_f,
            "wind":         wind_str,          # "S @ 3 mph"
            "wind_dir":     wind_dir,
            "wind_mph":     wind_mph,
            "gust_mph":     gust_mph,
            "humidity_pct": humidity,
            "rainfall_in":  rainfall_in,
        }

        # ── forecast hi / lo ───────────────────────────────────────────────
        high_f = safe_float(day_raw.get("maxtempF"))
        low_f  = safe_float(day_raw.get("mintempF"))

        # wttr.in also gives hourly breakdown — pull the actual overnight low
        # (min temp in hours 18:00–06:00) for a more accurate "tonight low"
        tonight_low = None
        for hour in day_raw.get("hourly", []):
            # hourly time is "0","100","200",...,"2300" (no colon)
            t = int(hour.get("time", 0))
            if t >= 1800:   # 6pm onward = overnight period
                h_temp = safe_float(hour.get("tempF"))
                if h_temp is not None:
                    if tonight_low is None or h_temp < tonight_low:
                        tonight_low = h_temp

        result["forecast"] = {
            "today_high_f":  high_f,
            "tonight_low_f": tonight_low if tonight_low is not None else low_f,
            "day_low_f":     low_f,       # overall 24h low (may differ from overnight)
        }

    except (KeyError, IndexError, TypeError) as e:
        result["error"] = f"Parse error: {e}"
        print(f"  ERROR parsing wttr.in response: {e}", file=sys.stderr)

    return result

# ── main ───────────────────────────────────────────────────────────────────────

def main():
    print(f"📱 Capturing iPhone (wttr.in) weather for {TODAY}…")

    try:
        raw  = fetch_wttr()
        data = parse_wttr(raw)
    except Exception as e:
        data = {
            "date":        TODAY,
            "captured_at": datetime.now(EST).isoformat(),
            "source":      "wttr.in",
            "location":    LOCATION,
            "current":     {},
            "forecast":    {},
            "error":       str(e),
        }
        print(f"  ERROR fetching wttr.in: {e}", file=sys.stderr)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, indent=2))
    print(f"✅ Saved → {OUT_JSON}")

    if data.get("error"):
        print(f"⚠️  Completed with error: {data['error']}")
        sys.exit(1)

    c = data.get("current", {})
    f = data.get("forecast", {})
    print(f"   Temp: {c.get('temp_f')}°F  (feels like {c.get('feels_like_f')}°F)")
    print(f"   Wind: {c.get('wind')}  Gust: {c.get('gust_mph')} mph")
    print(f"   Humidity: {c.get('humidity_pct')}%  Rainfall: {c.get('rainfall_in')}\"")
    print(f"   Forecast: Hi {f.get('today_high_f')}° / Lo {f.get('tonight_low_f')}°")


if __name__ == "__main__":
    main()
