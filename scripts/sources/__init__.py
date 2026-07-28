"""Source registry + shared stdlib helpers for the forecaster adapters.

Each adapter module exposes `fetch(lat=LAT, lon=LON) -> list[normalized-daily]`,
where a normalized daily dict is:
  {date, high_f, low_f, wind_mph, precip_type, rain_in, snow_in, precip_prob,
   fields_provided}
`fields_provided` is a subset of:
  "high","low","wind","precip_type","rain_amount","snow_amount"
and is authoritative for scoring (forfeit anything absent) and the coverage index.

`precip_prob` is an int percent 0-100, or None where the provider publishes no
probability. It is a DISPLAY field, not a scored one — it deliberately does not
appear in `fields_provided`, because nothing grades it and adding it would
change every source's coverage denominator.
"""
import json
import os
import urllib.request

LAT, LON = 36.2168, -81.6746
UA = "DavesSweater/1.0 (+https://davessweater.com)"


def http_get_json(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def to_percent(value, scale=1):
    """A provider's raw probability -> an int percent 0-100, or None.

    `scale` converts a provider's native range (OpenWeatherMap ships a 0-1
    fraction, so scale=100). Strings are accepted because some providers have
    historically shipped their percentages quoted.

    None / non-numeric / NaN -> None. The house rule is honest forfeit: a source
    that publishes no probability says nothing, and nothing here ever
    manufactures one from an amount. Out-of-range values are CLAMPED rather than
    dropped — a provider handing back 101 or -0.0001 is a rounding artifact of a
    real forecast, not a missing one.
    """
    if value is None or isinstance(value, bool):
        return None
    try:
        pct = float(value) * scale
    except (TypeError, ValueError):
        return None
    if pct != pct:  # NaN
        return None
    return int(round(min(100.0, max(0.0, pct))))


def max_percent(values, scale=1):
    """The daily probability from a provider's sub-daily parts (or None).

    Providers publish probability at different resolutions: NWS splits a day
    into day/night periods, OpenWeatherMap into 3-hour blocks, Google into
    daytime/nighttime. Each adapter reduces those to ONE number per calendar day
    with the max, which is the same statistic Open-Meteo's
    `precipitation_probability_max` already gives us — so the per-source numbers
    the site compares are like for like rather than a mix of maxima and averages.

    Returns None when no part carries a usable value: no parts is a forfeit, not
    a zero.
    """
    pcts = [p for p in (to_percent(v, scale) for v in values) if p is not None]
    return max(pcts) if pcts else None


def derive_type(rain_in, snow_in, has_precip=None):
    r = (rain_in or 0) > 0.005
    s = (snow_in or 0) > 0.05
    if r and s:
        return "mixed"
    if s:
        return "snow"
    if r:
        return "rain"
    if has_precip:
        return "rain"  # provider signals precip but gives no split -> assume rain
    return "none"


# key -> {label, env_key (None = keyless), module import path}
SOURCES = [
    {"key": "nws",            "label": "NWS",             "env_key": None,                     "module": "sources.nws"},
    {"key": "metno",          "label": "Met.no",          "env_key": None,                     "module": "sources.metno"},
    {"key": "openweathermap", "label": "OpenWeatherMap",  "env_key": "OPENWEATHER_API_KEY",    "module": "sources.openweathermap"},
    {"key": "weatherapi",     "label": "WeatherAPI",      "env_key": "WEATHERAPI_KEY",         "module": "sources.weatherapi"},
    {"key": "visualcrossing", "label": "Visual Crossing", "env_key": "VISUALCROSSING_KEY",     "module": "sources.visualcrossing"},
    {"key": "tomorrowio",     "label": "Tomorrow.io",     "env_key": "TOMORROW_API_KEY",       "module": "sources.tomorrowio"},
    {"key": "googleweather",  "label": "Google Weather",  "env_key": "GOOGLE_WEATHER_API_KEY", "module": "sources.googleweather"},
]


def available_sources():
    """Sources whose creds are present (keyless always; keyed only if env set)."""
    return [s for s in SOURCES if s["env_key"] is None or os.environ.get(s["env_key"])]
