"""NWS (api.weather.gov) adapter — keyless.

Two-step fetch:
  1. GET https://api.weather.gov/points/{lat},{lon}  -> properties.forecast URL
  2. GET that URL -> properties.periods[]

periods[] alternates daytime / nighttime.  We pair each daytime period with
the immediately following nighttime period for the low temperature.
"""
import re
from sources import http_get_json, LAT, LON


def _wind_mph(wind_speed_str):
    """Extract the first integer from a string like '6 mph' or '10 to 15 mph'."""
    m = re.search(r"(\d+)", wind_speed_str or "")
    return float(m.group(1)) if m else None


# Prefix matches, deliberately. NWS publishes these words in the plural at
# least as often as the singular ("Showers", "Thunderstorms", "Flurries"), and
# a trailing \b would exclude exactly those forms.
_SNOW_PAT = re.compile(r"\b(snow|flurr|sleet|ic[ey]|wintry|blizzard|freezing)", re.I)
_RAIN_PAT = re.compile(r"\b(rain|thunder|drizzle|sprinkle)", re.I)
# "Shower" names precipitation without naming its form: a snow shower is snow,
# a bare shower is rain.
_SHOWER_PAT = re.compile(r"\bshower", re.I)


def _precip_type(short_forecast, detailed_forecast):
    """Classify precipitation type from NWS text forecasts."""
    text = " ".join(filter(None, [short_forecast, detailed_forecast]))
    has_snow = bool(_SNOW_PAT.search(text))
    has_rain = bool(_RAIN_PAT.search(text))
    if _SHOWER_PAT.search(text) and not has_snow:
        has_rain = True
    if has_snow and has_rain:
        return "mixed"
    if has_snow:
        return "snow"
    if has_rain:
        return "rain"
    return "none"


def normalize_periods(periods):
    """Pure function: convert NWS periods list to normalized daily dicts.

    Args:
        periods: list of period dicts from NWS API (properties.periods).

    Returns:
        list of normalized daily forecast dicts (one per daytime period).
    """
    days = []
    for i, p in enumerate(periods):
        if not p.get("isDaytime"):
            continue  # skip nighttime entries as primaries

        # Pair with the next period (the night) for low_f
        low_f = None
        if i + 1 < len(periods):
            night = periods[i + 1]
            if not night.get("isDaytime"):
                low_f = float(night["temperature"])

        date = p["startTime"][:10]
        high_f = float(p["temperature"])
        wind_mph = _wind_mph(p.get("windSpeed"))
        short = p.get("shortForecast")
        detailed = p.get("detailedForecast")
        ptype = _precip_type(short, detailed)

        days.append({
            "date": date,
            "high_f": round(high_f, 1),
            "low_f": round(low_f, 1) if low_f is not None else None,
            "wind_mph": round(wind_mph, 1) if wind_mph is not None else None,
            "precip_type": ptype,
            "rain_in": None,
            "snow_in": None,
            "fields_provided": ["high", "low", "wind", "precip_type"],
            # Kept verbatim, and deliberately out of fields_provided: precip_type
            # is a lossy read of this text, so storing only the verdict strands
            # history whenever the classifier changes. Replay with _precip_type().
            "short_forecast": short,
            "detailed_forecast": detailed,
        })
    return days


def fetch(lat=LAT, lon=LON):
    """Fetch NWS forecast for the given coordinates.

    Returns a list of normalized daily dicts.
    """
    points = http_get_json(f"https://api.weather.gov/points/{lat},{lon}")
    forecast_url = points["properties"]["forecast"]
    data = http_get_json(forecast_url)
    return normalize_periods(data["properties"]["periods"])
