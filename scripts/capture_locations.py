"""Capture daily forecasts for every registry location (M5 P0 — silent accrual).

For each town in data/locations/locations.json, fetches Open-Meteo plus every
available keyed/keyless adapter at the town's own coordinates and writes
data/locations/{slug}/predictions/{today}/{key}_forecast.json in the exact
payload shape the Boone pipeline uses. Boone itself is untouched (legacy
scripts + paths). Failures are per-source and per-town: one town or source
failing never blocks the rest (the workflow step is continue-on-error anyway).
"""
import importlib
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))  # `import sources` when run directly

from capture_openmeteo import WMO_CODES, fetch_json, weather_category
from locations import load_locations, location_dir
from sources import SOURCES, available_sources

EST = ZoneInfo("America/New_York")


def openmeteo_forecast_url(lat, lon):
    return (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,"
        "precipitation_probability_max,weather_code,wind_speed_10m_max"
        "&temperature_unit=fahrenheit&wind_speed_unit=mph"
        "&precipitation_unit=inch&timezone=America/New_York"
        "&forecast_days=7"
    )


def normalize_openmeteo_daily(daily_raw):
    """Open-Meteo daily arrays -> the same normalized rows Boone's capture writes
    (snowfall_sum arrives in cm regardless of precipitation_unit — /2.54)."""
    rows = []
    dates = daily_raw.get("time", [])
    highs = daily_raw.get("temperature_2m_max", [])
    lows = daily_raw.get("temperature_2m_min", [])
    precip = daily_raw.get("precipitation_sum", [])
    snowfall = daily_raw.get("snowfall_sum", [])
    codes = daily_raw.get("weather_code", [])
    wind = daily_raw.get("wind_speed_10m_max", [])
    for i in range(len(dates)):
        code = codes[i] if i < len(codes) else 0
        rain_in = round(precip[i] or 0, 3) if i < len(precip) else 0.0
        snow_in = round((snowfall[i] or 0) / 2.54, 3) if i < len(snowfall) else 0.0
        ptype = ("mixed" if rain_in > 0.005 and snow_in > 0.05
                 else "snow" if snow_in > 0.05
                 else "rain" if rain_in > 0.005 else "none")
        rows.append({
            "date": dates[i],
            "high_f": highs[i] if i < len(highs) else None,
            "low_f": lows[i] if i < len(lows) else None,
            "wind_mph": wind[i] if i < len(wind) else None,
            "precip_type": ptype,
            "rain_in": rain_in,
            "snow_in": snow_in,
            "precip_in": round(rain_in + snow_in, 3),
            "weather_code": code,
            "conditions": WMO_CODES.get(code, "Unknown"),
            "category": weather_category(code),
            "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
        })
    return rows


def capture_location(loc, today=None):
    """Capture all sources for one town. Returns {source_key: ok_bool}."""
    today = today or datetime.now(EST).strftime("%Y-%m-%d")
    out = location_dir(loc["slug"]) / "predictions" / today
    out.mkdir(parents=True, exist_ok=True)
    results = {}

    def write(key, label, daily):
        payload = {"source": key, "label": label,
                   "captured_at": datetime.now(EST).isoformat(),
                   "location": loc["name"], "location_slug": loc["slug"],
                   "daily": daily}
        (out / f"{key}_forecast.json").write_text(json.dumps(payload, indent=2))

    try:
        raw = fetch_json(openmeteo_forecast_url(loc["lat"], loc["lon"]))
        write("openmeteo", "Open-Meteo", normalize_openmeteo_daily(raw.get("daily", {})))
        results["openmeteo"] = True
        print(f"  OK   {loc['slug']}/openmeteo")
    except Exception as e:  # noqa: BLE001
        results["openmeteo"] = False
        print(f"  FAIL {loc['slug']}/openmeteo: {type(e).__name__}: {e}")

    avail = {s["key"] for s in available_sources()}
    for s in SOURCES:
        if s["key"] not in avail:
            print(f"  SKIP {loc['slug']}/{s['key']} (no creds)")
            continue
        try:
            mod = importlib.import_module(s["module"])
            daily = mod.fetch(lat=loc["lat"], lon=loc["lon"])
            write(s["key"], s["label"], daily)
            results[s["key"]] = True
            print(f"  OK   {loc['slug']}/{s['key']} ({len(daily)} days)")
        except Exception as e:  # noqa: BLE001
            results[s["key"]] = False
            print(f"  FAIL {loc['slug']}/{s['key']}: {type(e).__name__}: {e}")
    return results


def main():
    for loc in load_locations():
        print(f"[{loc['slug']}] capturing at ({loc['lat']}, {loc['lon']})")
        capture_location(loc)


if __name__ == "__main__":
    main()
