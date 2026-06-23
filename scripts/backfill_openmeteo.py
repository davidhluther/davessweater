#!/usr/bin/env python3
"""Backfill Open-Meteo's record using the Historical Forecast API (its ARCHIVED past
forecasts — distinct from the actuals archive), plus matching actuals, so the normal
compare can score them. Open-Meteo only: the other forecasters publish no forecast
archive, so they can't be backdated honestly. Skips any date we already track.

Fetches in ~monthly chunks (a year-long single request times out). Re-run compare.py
for each backfilled date afterwards to score it.

Usage: python scripts/backfill_openmeteo.py --start 2025-03-03 --end 2026-03-02
"""
import argparse
import json
import urllib.request
from datetime import date as Date, timedelta

from capture_openmeteo import WMO_CODES, weather_category, LAT, LON, DATA_DIR

HIST_FORECAST = (
    "https://historical-forecast-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
    "&start_date={s}&end_date={e}"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,"
    "precipitation_probability_max,weather_code,wind_speed_10m_max"
    "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America/New_York"
)
ARCHIVE = (
    "https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}"
    "&start_date={s}&end_date={e}"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,"
    "weather_code,wind_speed_10m_max,wind_gusts_10m_max"
    "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America/New_York"
)


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DavesSweater/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def _ptype(rain, snow):
    return "mixed" if rain > 0.005 and snow > 0.05 else ("snow" if snow > 0.05 else ("rain" if rain > 0.005 else "none"))


def _col(daily, key, i, default=None):
    arr = daily.get(key) or []
    return arr[i] if i < len(arr) else default


def _process(fc, ac):
    ac_idx = {t: j for j, t in enumerate(ac.get("time", []))}
    n_fc = n_ac = 0
    for i, date in enumerate(fc.get("time", [])):
        pred_path = DATA_DIR / "predictions" / date / "openmeteo_forecast.json"
        if not pred_path.exists():
            rain = round(_col(fc, "precipitation_sum", i) or 0, 3)
            snow = round((_col(fc, "snowfall_sum", i) or 0) / 2.54, 3)
            code = _col(fc, "weather_code", i) or 0
            entry = {
                "date": date,
                "high_f": _col(fc, "temperature_2m_max", i), "low_f": _col(fc, "temperature_2m_min", i),
                "wind_mph": _col(fc, "wind_speed_10m_max", i),
                "precip_type": _ptype(rain, snow), "rain_in": rain, "snow_in": snow, "precip_in": round(rain + snow, 3),
                "precip_prob": _col(fc, "precipitation_probability_max", i),
                "weather_code": code, "conditions": WMO_CODES.get(code, "Unknown"), "category": weather_category(code),
                "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
            }
            pred_path.parent.mkdir(parents=True, exist_ok=True)
            pred_path.write_text(json.dumps(
                {"source": "openmeteo", "backfilled": True, "forecast_for": date, "daily": [entry]}, indent=2))
            n_fc += 1
        ac_path = DATA_DIR / "actuals" / f"{date}.json"
        if not ac_path.exists() and date in ac_idx:
            j = ac_idx[date]
            rain = round(_col(ac, "precipitation_sum", j) or 0, 3)
            snow = round((_col(ac, "snowfall_sum", j) or 0) / 2.54, 3)
            code = _col(ac, "weather_code", j) or 0
            ac_path.parent.mkdir(parents=True, exist_ok=True)
            ac_path.write_text(json.dumps({
                "date": date, "location": "Boone",
                "high_f": _col(ac, "temperature_2m_max", j), "low_f": _col(ac, "temperature_2m_min", j),
                "wind_mph": _col(ac, "wind_speed_10m_max", j), "gust_mph": _col(ac, "wind_gusts_10m_max", j),
                "rain_in": rain, "snow_in": snow, "precip_type": _ptype(rain, snow), "precip_in": round(rain + snow, 3),
                "weather_code": code, "conditions": WMO_CODES.get(code, "Unknown"), "category": weather_category(code),
            }, indent=2))
            n_ac += 1
    return n_fc, n_ac


def backfill(start, end, chunk_days=30):
    s, e = Date.fromisoformat(start), Date.fromisoformat(end)
    total_fc = total_ac = 0
    cur = s
    while cur <= e:
        ce = min(cur + timedelta(days=chunk_days - 1), e)
        fc = _get(HIST_FORECAST.format(lat=LAT, lon=LON, s=cur.isoformat(), e=ce.isoformat()))["daily"]
        ac = _get(ARCHIVE.format(lat=LAT, lon=LON, s=cur.isoformat(), e=ce.isoformat()))["daily"]
        nfc, nac = _process(fc, ac)
        total_fc += nfc
        total_ac += nac
        print(f"  {cur}..{ce}: +{nfc} forecasts +{nac} actuals")
        cur = ce + timedelta(days=1)
    print(f"backfill {start}..{end}: wrote {total_fc} forecasts, {total_ac} actuals (existing dates skipped)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Backfill Open-Meteo's archived forecasts + actuals")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    args = ap.parse_args()
    backfill(args.start, args.end)
