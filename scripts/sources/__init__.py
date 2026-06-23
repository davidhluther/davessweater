"""Source registry + shared stdlib helpers for the forecaster adapters.

Each adapter module exposes `fetch(lat=LAT, lon=LON) -> list[normalized-daily]`,
where a normalized daily dict is:
  {date, high_f, low_f, wind_mph, precip_type, rain_in, snow_in, fields_provided}
`fields_provided` is a subset of:
  "high","low","wind","precip_type","rain_amount","snow_amount"
and is authoritative for scoring (forfeit anything absent) and the coverage index.
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
