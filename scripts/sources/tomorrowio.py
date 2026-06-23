"""Tomorrow.io daily forecast adapter (imperial units).

Endpoint:
  GET https://api.tomorrow.io/v4/weather/forecast
  ?location={lat},{lon}&timesteps=1d&units=imperial&apikey={key}

Response shape (relevant excerpt):
  {
    "timelines": {
      "daily": [
        {
          "time": "2026-06-22T06:00:00Z",
          "values": {
            "temperatureMax": 78.5,
            "temperatureMin": 55.2,
            "windSpeedMax": 12.3,
            "windSpeedAvg": 8.1,
            "rainAccumulationSum": 0.04,   // preferred; "rainAccumulation" is the fallback
            "snowAccumulationSum": 0.0     // preferred; "snowAccumulation" is the fallback
          }
        },
        ...
      ]
    }
  }

Rain/snow keys: Tomorrow.io uses "rainAccumulationSum"/"snowAccumulationSum" for the
1d timestep aggregates.  Earlier API versions and some plan tiers expose
"rainAccumulation"/"snowAccumulation" without the "Sum" suffix.  We read
whichever is present (Sum preferred) and claim the field in fields_provided ONLY
when the key actually exists in the payload — value 0.0 counts as present, a
missing key does not.

snowAccumulation(/Sum) in imperial mode is snow DEPTH in inches.

Env var: TOMORROW_API_KEY
"""

import os
from sources import http_get_json, LAT, LON, derive_type

_BASE = "https://api.tomorrow.io/v4/weather/forecast"
_BASE_FIELDS = ["high", "low", "wind", "precip_type"]


def normalize_daily(daily: list) -> list:
    """Pure function: convert Tomorrow.io timelines.daily list to normalized dicts.

    Args:
        daily: list of day objects from response["timelines"]["daily"]

    Returns:
        List of normalized daily dicts (one per forecast day).
    """
    result = []
    for day in daily:
        date = (day.get("time") or "")[:10]
        v = day.get("values") or {}

        # Temperatures (already Fahrenheit in imperial mode)
        raw_high = v.get("temperatureMax")
        raw_low = v.get("temperatureMin")
        high_f = round(float(raw_high), 1) if raw_high is not None else None
        low_f = round(float(raw_low), 1) if raw_low is not None else None

        # Wind: prefer windSpeedMax, fall back to windSpeedAvg
        raw_wind = v.get("windSpeedMax") if v.get("windSpeedMax") is not None else v.get("windSpeedAvg")
        wind_mph = round(float(raw_wind), 1) if raw_wind is not None else None

        # Precipitation amounts (inches) — read Sum variant first, fall back to non-Sum.
        # Track key PRESENCE separately: value 0.0 is present, missing key is not.
        rain_present = "rainAccumulationSum" in v or "rainAccumulation" in v
        snow_present = "snowAccumulationSum" in v or "snowAccumulation" in v

        raw_rain = v.get("rainAccumulationSum", v.get("rainAccumulation"))
        raw_snow = v.get("snowAccumulationSum", v.get("snowAccumulation"))
        rain_in = round(float(raw_rain), 3) if raw_rain is not None else None
        snow_in = round(float(raw_snow), 3) if raw_snow is not None else None

        precip_type = derive_type(rain_in, snow_in)

        # fields_provided: only claim amounts the payload actually contained.
        fields = list(_BASE_FIELDS)
        if rain_present:
            fields.append("rain_amount")
        if snow_present:
            fields.append("snow_amount")

        result.append({
            "date": date,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "precip_type": precip_type,
            "rain_in": rain_in,
            "snow_in": snow_in,
            "fields_provided": fields,
        })
    return result


def fetch(lat: float = LAT, lon: float = LON) -> list:
    """Fetch Tomorrow.io daily forecast and return normalized daily dicts."""
    key = os.environ.get("TOMORROW_API_KEY")
    if not key:
        raise RuntimeError("TOMORROW_API_KEY not set")

    url = f"{_BASE}?location={lat},{lon}&timesteps=1d&units=imperial&apikey={key}"
    data = http_get_json(url)
    daily = data["timelines"]["daily"]
    return normalize_daily(daily)
