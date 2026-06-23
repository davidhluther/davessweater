"""Visual Crossing Timeline adapter for Dave's Sweater.

Keyed: reads VISUALCROSSING_KEY from env at runtime.
fetch() -> list of normalized daily dicts (US units).
"""
import os
from sources import http_get_json, LAT, LON, derive_type


def normalize_days(days):
    """Pure function: map Visual Crossing 'days' list -> normalized daily dicts.

    Args:
        days: list of day dicts from the Visual Crossing Timeline response.

    Returns:
        list of normalized daily dicts per the Dave's Sweater contract.
    """
    result = []
    for d in days:
        date = d.get("datetime")  # already "YYYY-MM-DD"

        # Temperatures and wind (all in US units: °F, mph)
        tempmax = d.get("tempmax")
        tempmin = d.get("tempmin")
        windspeed = d.get("windspeed")

        high_f = round(float(tempmax), 1) if tempmax is not None else None
        low_f = round(float(tempmin), 1) if tempmin is not None else None
        wind_mph = round(float(windspeed), 1) if windspeed is not None else None

        # Precip: "precip" is liquid inches; "snow" is snow depth inches
        precip_raw = d.get("precip")
        snow_raw = d.get("snow")

        rain_in = round(float(precip_raw), 3) if precip_raw is not None else None
        snow_in = round(float(snow_raw), 3) if snow_raw is not None else None

        # precip_type: prefer the provider's "preciptype" list when present
        preciptype_list = d.get("preciptype")  # list like ["rain"], ["snow"], or None
        if preciptype_list:
            has_snow = "snow" in preciptype_list
            has_rain = any(t in preciptype_list for t in ("rain", "freezingrain"))
            if has_snow and has_rain:
                precip_type = "mixed"
            elif has_snow:
                precip_type = "snow"
            else:
                precip_type = "rain"
        else:
            precip_type = derive_type(rain_in, snow_in)

        result.append({
            "date": date,
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
    return result


def fetch(lat=LAT, lon=LON):
    """Fetch Visual Crossing Timeline forecast and return normalized daily list."""
    key = os.environ.get("VISUALCROSSING_KEY")
    if not key:
        raise RuntimeError("VISUALCROSSING_KEY not set")

    url = (
        f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services"
        f"/timeline/{lat},{lon}"
        f"?unitGroup=us&include=days&contentType=json&key={key}"
    )
    data = http_get_json(url)
    return normalize_days(data["days"])
