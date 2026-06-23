"""WeatherAPI.com adapter for Dave's Sweater.

fetch() requires WEATHERAPI_KEY in the environment.
normalize_forecastdays() is pure and unit-testable offline.
"""
import os
from sources import http_get_json, LAT, LON, derive_type


def normalize_forecastdays(forecastday):
    """Convert WeatherAPI forecastday list to the normalized daily contract.

    Args:
        forecastday: list of day dicts from forecast.forecastday[]

    Returns:
        list of normalized daily dicts
    """
    results = []
    for fd in forecastday:
        date = fd["date"]
        day = fd["day"]

        high_f = round(float(day["maxtemp_f"]), 1) if day.get("maxtemp_f") is not None else None
        low_f = round(float(day["mintemp_f"]), 1) if day.get("mintemp_f") is not None else None
        wind_mph = round(float(day["maxwind_mph"]), 1) if day.get("maxwind_mph") is not None else None

        # totalprecip_in is liquid inches; totalsnow_cm is snow depth in cm -> convert to inches
        rain_in_raw = day.get("totalprecip_in")
        snow_cm_raw = day.get("totalsnow_cm")

        rain_in = round(float(rain_in_raw), 3) if rain_in_raw is not None else None
        snow_in = round(float(snow_cm_raw) / 2.54, 3) if snow_cm_raw is not None else None

        # Determine precip_type using provider flags + amount thresholds
        will_snow = bool(day.get("daily_will_it_snow", 0))
        will_rain = bool(day.get("daily_will_it_rain", 0))

        has_snow = will_snow or (snow_in is not None and snow_in > 0.05)
        has_rain = will_rain or (rain_in is not None and rain_in > 0.005)

        if has_snow and has_rain:
            precip_type = "mixed"
        elif has_snow:
            precip_type = "snow"
        elif has_rain:
            precip_type = "rain"
        else:
            precip_type = "none"

        results.append({
            "date": date,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "precip_type": precip_type,
            "rain_in": rain_in,
            "snow_in": snow_in,
            "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
        })

    return results


def fetch(lat=LAT, lon=LON):
    """Fetch 3-day forecast from WeatherAPI.com and return normalized daily list."""
    key = os.environ.get("WEATHERAPI_KEY")
    if not key:
        raise RuntimeError("WEATHERAPI_KEY not set")

    url = f"https://api.weatherapi.com/v1/forecast.json?key={key}&q={lat},{lon}&days=3"
    data = http_get_json(url)
    return normalize_forecastdays(data["forecast"]["forecastday"])
