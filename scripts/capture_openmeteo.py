#!/usr/bin/env python3
"""
capture_openmeteo.py — Capture Open-Meteo forecast + fetch actuals for Boone, NC
Two modes:
  --forecast  : Grab today's prediction (run at 7 AM)
  --actuals   : Fetch verified actuals for yesterday (run at 8 AM next day)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

EST = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Boone, NC coordinates
LAT = 36.2168
LON = -81.6746

FORECAST_URL = (
    f"https://api.open-meteo.com/v1/forecast?"
    f"latitude={LAT}&longitude={LON}"
    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
    f"precipitation_probability_max,weather_code,wind_speed_10m_max"
    f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
    f"weather_code,wind_speed_10m"
    f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
    f"&precipitation_unit=inch&timezone=America/New_York"
    f"&forecast_days=7"
)

ARCHIVE_URL_TEMPLATE = (
    f"https://archive-api.open-meteo.com/v1/archive?"
    f"latitude={LAT}&longitude={LON}"
    f"&start_date={{date}}&end_date={{date}}"
    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,"
    f"wind_speed_10m_max,wind_gusts_10m_max"
    f"&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
    f"&timezone=America/New_York"
)

# WMO weather code descriptions
WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ slight hail", 99: "Thunderstorm w/ heavy hail",
}

# Simplified category for scoring
def weather_category(code):
    if code <= 1:
        return "clear"
    elif code <= 3:
        return "cloudy"
    elif code <= 48:
        return "fog"
    elif code <= 57:
        return "drizzle"
    elif code <= 67:
        return "rain"
    elif code <= 77:
        return "snow"
    elif code <= 82:
        return "rain"
    elif code <= 86:
        return "snow"
    else:
        return "storm"


def fetch_json(url):
    """Simple URL fetch that works without requests library."""
    req = Request(url, headers={"User-Agent": "DavesSweater/1.0"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except URLError as e:
        print(f"  ERROR fetching {url}: {e}")
        sys.exit(1)


def capture_forecast():
    """Grab today's Open-Meteo forecast and save it."""
    today = datetime.now(EST).strftime("%Y-%m-%d")
    capture_dir = DATA_DIR / "predictions" / today
    capture_dir.mkdir(parents=True, exist_ok=True)

    print(f"[{today}] Fetching Open-Meteo forecast for Boone...")
    raw = fetch_json(FORECAST_URL)

    # Current conditions
    current = raw.get("current", {})
    # Daily forecast array
    daily_raw = raw.get("daily", {})

    forecast = {
        "source": "openmeteo",
        "captured_at": datetime.now(EST).isoformat(),
        "location": "Boone",
        "forecast_for": today,
        "current": {
            "temp_f": current.get("temperature_2m"),
            "feels_like_f": current.get("apparent_temperature"),
            "humidity": current.get("relative_humidity_2m"),
            "wind_mph": current.get("wind_speed_10m"),
            "weather_code": current.get("weather_code"),
            "conditions": WMO_CODES.get(current.get("weather_code", 0), "Unknown"),
        },
        "daily": [],
    }

    # Build daily forecast entries
    dates = daily_raw.get("time", [])
    highs = daily_raw.get("temperature_2m_max", [])
    lows = daily_raw.get("temperature_2m_min", [])
    precip = daily_raw.get("precipitation_sum", [])
    precip_prob = daily_raw.get("precipitation_probability_max", [])
    codes = daily_raw.get("weather_code", [])
    wind = daily_raw.get("wind_speed_10m_max", [])

    for i in range(len(dates)):
        code = codes[i] if i < len(codes) else 0
        forecast["daily"].append({
            "date": dates[i],
            "high_f": highs[i] if i < len(highs) else None,
            "low_f": lows[i] if i < len(lows) else None,
            "precip_in": precip[i] if i < len(precip) else None,
            "precip_prob": precip_prob[i] if i < len(precip_prob) else None,
            "weather_code": code,
            "conditions": WMO_CODES.get(code, "Unknown"),
            "category": weather_category(code),
            "wind_mph": wind[i] if i < len(wind) else None,
        })

    # Save
    json_path = capture_dir / "openmeteo_forecast.json"
    with open(json_path, "w") as f:
        json.dump(forecast, f, indent=2)
    print(f"  Saved: {json_path}")

    # Update meta
    meta_path = capture_dir / "meta.json"
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
    else:
        meta = {"date": today, "captured_at": datetime.now(EST).isoformat(),
                "sources_captured": [], "screenshots": []}
    if "openmeteo" not in meta["sources_captured"]:
        meta["sources_captured"].append("openmeteo")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Done! Forecast captured for {today}")
    return forecast


def fetch_actuals(target_date=None):
    """Fetch verified actual weather for a given date (default: yesterday)."""
    if target_date is None:
        yesterday = datetime.now(EST) - timedelta(days=1)
        target_date = yesterday.strftime("%Y-%m-%d")

    actuals_dir = DATA_DIR / "actuals"
    actuals_dir.mkdir(parents=True, exist_ok=True)

    print(f"[{target_date}] Fetching Open-Meteo actuals for Boone...")
    url = ARCHIVE_URL_TEMPLATE.format(date=target_date)
    raw = fetch_json(url)

    daily = raw.get("daily", {})
    dates = daily.get("time", [])
    if not dates:
        print(f"  WARNING: No actuals available yet for {target_date}")
        print("  (Historical data may take 1-5 days to appear)")
        return None

    code = daily.get("weather_code", [0])[0]
    actuals = {
        "date": target_date,
        "fetched_at": datetime.now(EST).isoformat(),
        "location": "Boone",
        "high_f": daily.get("temperature_2m_max", [None])[0],
        "low_f": daily.get("temperature_2m_min", [None])[0],
        "precip_in": daily.get("precipitation_sum", [None])[0],
        "wind_mph": daily.get("wind_speed_10m_max", [None])[0],
        "gust_mph": daily.get("wind_gusts_10m_max", [None])[0],
        "weather_code": code,
        "conditions": WMO_CODES.get(code, "Unknown"),
        "category": weather_category(code),
    }

    json_path = actuals_dir / f"{target_date}.json"
    with open(json_path, "w") as f:
        json.dump(actuals, f, indent=2)
    print(f"  Saved: {json_path}")
    return actuals


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Open-Meteo data for DavesSweater")
    parser.add_argument("--forecast", action="store_true", help="Capture today's forecast")
    parser.add_argument("--actuals", action="store_true", help="Fetch yesterday's actuals")
    parser.add_argument("--date", type=str, help="Specific date for actuals (YYYY-MM-DD)")
    args = parser.parse_args()

    if not args.forecast and not args.actuals:
        print("Usage: python capture_openmeteo.py --forecast | --actuals [--date YYYY-MM-DD]")
        sys.exit(1)

    if args.forecast:
        capture_forecast()
    if args.actuals:
        fetch_actuals(args.date)
