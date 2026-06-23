"""OpenWeatherMap 5-day/3-hour forecast adapter.

API: https://api.openweathermap.org/data/2.5/forecast (standard/free tier)
Key: OPENWEATHER_API_KEY (env var)

normalize_list() is pure and unit-testable offline.
fetch() calls the live API at runtime.
"""
import os
from sources import http_get_json, LAT, LON, derive_type

# mm -> inches conversion factor
_MM_TO_IN = 1.0 / 25.4


def normalize_list(lst):
    """Group 3-hourly OWM entries by date and return one normalized dict per day.

    Args:
        lst: the "list" array from the OWM /data/2.5/forecast JSON response.

    Returns:
        list of normalized daily dicts sorted by date ascending.

    Note: OWM "snow.3h" is liquid-equivalent volume in mm, not snow depth.
    We convert to inches and use it as a snow_in proxy; depth is understated.
    """
    # Accumulate per-day buckets
    days = {}  # date str -> dict of accumulators

    for entry in lst:
        date = entry["dt_txt"][:10]  # "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DD"

        if date not in days:
            days[date] = {
                "temp_max_list": [],
                "temp_min_list": [],
                "wind_list": [],
                "rain_mm": 0.0,
                "snow_mm": 0.0,
            }

        d = days[date]

        main = entry.get("main", {})
        if "temp_max" in main:
            d["temp_max_list"].append(main["temp_max"])
        if "temp_min" in main:
            d["temp_min_list"].append(main["temp_min"])

        wind = entry.get("wind", {})
        if "speed" in wind:
            d["wind_list"].append(wind["speed"])

        rain = entry.get("rain", {})
        d["rain_mm"] += rain.get("3h", 0.0) or 0.0

        snow = entry.get("snow", {})
        d["snow_mm"] += snow.get("3h", 0.0) or 0.0

    result = []
    for date in sorted(days):
        d = days[date]

        high_f = round(max(d["temp_max_list"]), 1) if d["temp_max_list"] else None
        low_f = round(min(d["temp_min_list"]), 1) if d["temp_min_list"] else None
        wind_mph = round(max(d["wind_list"]), 1) if d["wind_list"] else None

        rain_in = round(d["rain_mm"] * _MM_TO_IN, 3) if d["rain_mm"] else None
        snow_in = round(d["snow_mm"] * _MM_TO_IN, 3) if d["snow_mm"] else None

        precip_type = derive_type(rain_in, snow_in)

        # NOTE: OWM snow.3h is liquid-equivalent volume (mm), not snow depth.
        # It cannot be claimed as a scoreable snow depth ("snow_amount"), but we
        # keep snow_in for derive_type() so precip_type is still correct.
        result.append({
            "date": date,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "precip_type": precip_type,
            "rain_in": rain_in,
            "snow_in": snow_in,
            "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount"],
        })

    return result


def fetch(lat=LAT, lon=LON):
    """Fetch the OWM 5-day/3-hour forecast and return normalized daily dicts."""
    key = os.environ.get("OPENWEATHER_API_KEY")
    if not key:
        raise RuntimeError("OPENWEATHER_API_KEY not set")

    url = (
        f"https://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}&lon={lon}&units=imperial&appid={key}"
    )
    data = http_get_json(url)
    return normalize_list(data["list"])
