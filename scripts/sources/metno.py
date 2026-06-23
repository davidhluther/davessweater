"""Met.no Locationforecast 2.0 compact adapter (keyless).

API docs: https://api.met.no/weatherapi/locationforecast/2.0/
No API key required; the shared http_get_json helper sets a proper User-Agent
which is the only requirement from Met.no.
"""
from sources import http_get_json, LAT, LON, derive_type


def normalize_timeseries(timeseries):
    """Pure function: group hourly timeseries entries by date, return daily dicts.

    Each entry in timeseries is expected to have:
      e["time"]                                          ISO-8601 string ([:10] = date)
      e["data"]["instant"]["details"]["air_temperature"] Celsius
      e["data"]["instant"]["details"]["wind_speed"]      m/s
      e["data"]["next_1_hours"]["details"]["precipitation_amount"]  mm  (preferred)
      e["data"]["next_6_hours"]["details"]["precipitation_amount"]  mm  (fallback)
    """
    # Accumulate per-date buckets
    days = {}  # date_str -> {"temps": [], "winds": [], "precip_mm": 0.0, "any_cold_precip": bool}

    for entry in timeseries:
        date = entry["time"][:10]
        instant = entry["data"]["instant"]["details"]
        temp_c = instant.get("air_temperature")
        wind_ms = instant.get("wind_speed")

        # Precipitation: prefer next_1_hours, fall back to next_6_hours
        precip_mm = 0.0
        if "next_1_hours" in entry["data"]:
            precip_mm = entry["data"]["next_1_hours"]["details"].get("precipitation_amount", 0.0)
        elif "next_6_hours" in entry["data"]:
            precip_mm = entry["data"]["next_6_hours"]["details"].get("precipitation_amount", 0.0)

        if date not in days:
            days[date] = {
                "temps_c": [],
                "winds_ms": [],
                "precip_mm": 0.0,
                "any_cold_precip": False,
            }

        bucket = days[date]
        if temp_c is not None:
            bucket["temps_c"].append(temp_c)
        if wind_ms is not None:
            bucket["winds_ms"].append(wind_ms)
        bucket["precip_mm"] += precip_mm

        # Mark if precipitation fell while temperature was at or below freezing
        if precip_mm > 0 and temp_c is not None and temp_c <= 0:
            bucket["any_cold_precip"] = True

    result = []
    for date in sorted(days):
        b = days[date]

        temps = b["temps_c"]
        winds = b["winds_ms"]
        precip_mm = b["precip_mm"]

        high_f = round(max(temps) * 9 / 5 + 32, 1) if temps else None
        low_f = round(min(temps) * 9 / 5 + 32, 1) if temps else None
        wind_mph = round(max(winds) * 2.23694, 1) if winds else None

        rain_in = round(precip_mm / 25.4, 3) if precip_mm > 0 else 0.0

        # Precip type: if any hour had temp<=0C with precip => snow; elif precip>0 => rain
        if precip_mm > 0:
            if b["any_cold_precip"]:
                precip_type = "snow"
            else:
                precip_type = "rain"
        else:
            precip_type = "none"

        result.append({
            "date": date,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "precip_type": precip_type,
            "rain_in": rain_in,
            "snow_in": None,  # compact endpoint gives liquid mm, not snow depth
            "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount"],
        })

    return result


def fetch(lat=LAT, lon=LON):
    """Fetch Met.no Locationforecast 2.0 compact and return normalized daily dicts."""
    url = f"https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat}&lon={lon}"
    data = http_get_json(url)
    return normalize_timeseries(data["properties"]["timeseries"])
