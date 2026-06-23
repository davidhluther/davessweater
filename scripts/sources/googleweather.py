"""Google Weather API (Maps Platform) adapter.

Env: GOOGLE_WEATHER_API_KEY
Endpoint: https://weather.googleapis.com/v1/forecast/days:lookup
"""
import os
from sources import http_get_json, LAT, LON, derive_type

_ENDPOINT = "https://weather.googleapis.com/v1/forecast/days:lookup"


def normalize_days(forecast_days):
    """Pure function: map Google Weather forecastDays[] -> normalized daily list.

    Args:
        forecast_days: list of forecastDay dicts from the API response.

    Returns:
        List of normalized daily dicts.
    """
    results = []
    for fd in forecast_days:
        # Date: displayDate = {year, month, day} — zero-pad month and day.
        dd = fd.get("displayDate", {})
        year = dd.get("year", 0)
        month = dd.get("month", 0)
        day = dd.get("day", 0)
        date_str = f"{year:04d}-{month:02d}-{day:02d}"

        # Temperatures (IMPERIAL — degrees Fahrenheit).
        high_raw = (fd.get("maxTemperature") or {}).get("degrees")
        low_raw = (fd.get("minTemperature") or {}).get("degrees")
        high_f = round(float(high_raw), 1) if high_raw is not None else None
        low_f = round(float(low_raw), 1) if low_raw is not None else None

        # Daytime forecast sub-object.
        dtf = fd.get("daytimeForecast") or {}

        # Wind speed (mph in IMPERIAL mode).
        wind_raw = ((dtf.get("wind") or {}).get("speed") or {}).get("value")
        wind_mph = round(float(wind_raw), 1) if wind_raw is not None else None

        # Precipitation.
        precip = dtf.get("precipitation") or {}

        qpf = precip.get("qpf") or {}
        rain_raw = qpf.get("quantity")
        rain_in = round(float(rain_raw), 3) if rain_raw is not None else 0.0

        snow_qpf = precip.get("snowQpf") or {}
        snow_raw = snow_qpf.get("quantity")
        snow_in = round(float(snow_raw), 3) if snow_raw is not None else 0.0

        # Precip type: use probability.type if the provider sets one, else derive.
        prob = precip.get("probability") or {}
        prob_type = (prob.get("type") or "").upper()
        if prob_type == "SNOW":
            precip_type = "snow"
        elif prob_type == "RAIN":
            precip_type = "rain"
        elif prob_type == "MIXED":
            precip_type = "mixed"
        elif prob_type == "NONE":
            precip_type = "none"
        else:
            precip_type = derive_type(rain_in, snow_in)

        results.append({
            "date": date_str,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "precip_type": precip_type,
            "rain_in": rain_in,
            "snow_in": snow_in,
            "fields_provided": [
                "high", "low", "wind", "precip_type", "rain_amount", "snow_amount"
            ],
        })

    return results


def fetch(lat=LAT, lon=LON):
    """Fetch 3-day Google Weather forecast and return normalized daily list."""
    key = os.environ.get("GOOGLE_WEATHER_API_KEY")
    if not key:
        raise RuntimeError("GOOGLE_WEATHER_API_KEY not set")

    url = (
        f"{_ENDPOINT}"
        f"?key={key}"
        f"&location.latitude={lat}"
        f"&location.longitude={lon}"
        f"&days=3"
        f"&unitsSystem=IMPERIAL"
    )
    data = http_get_json(url)
    return normalize_days(data.get("forecastDays", []))
