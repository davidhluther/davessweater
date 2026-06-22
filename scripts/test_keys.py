"""Throwaway: validate the keyed weather-API secrets actually work for Boone, NC.
Runs in CI (keys come from repo secrets via env). Prints OK/FAIL per provider;
never prints the key or the request URL. Exits 0 so the log is always readable.
Deleted after the Source Expansion keys are confirmed.
"""
import json
import os
import urllib.error
import urllib.request

LAT, LON = 36.2168, -81.6746


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DavesSweater/0.1 (+https://davessweater.com)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {e}"


def sample(name, body):
    try:
        d = json.loads(body)
        if name == "OpenWeatherMap":
            return f"first-3h temp={d['list'][0]['main']['temp']}F, slots={len(d['list'])}"
        if name == "WeatherAPI":
            day = d["forecast"]["forecastday"][0]["day"]
            return f"max={day['maxtemp_f']}F min={day['mintemp_f']}F"
        if name == "VisualCrossing":
            day = d["days"][0]
            return f"max={day['tempmax']}F min={day['tempmin']}F"
        if name == "Tomorrow.io":
            v = d["timelines"]["daily"][0]["values"]
            return f"max={v.get('temperatureMax')} min={v.get('temperatureMin')}"
        if name == "GoogleWeather":
            return f"forecastDays={len(d.get('forecastDays', []))}, keys={list(d.keys())[:4]}"
    except Exception as e:  # noqa: BLE001
        return f"(HTTP 200 but couldn't parse a sample: {e})"
    return ""


def check(name, env_name, build_url):
    key = os.environ.get(env_name, "").strip()
    if not key:
        print(f"  SKIP {name:14s} secret {env_name} not set")
        return
    status, body = get(build_url(key))
    if status == 200:
        print(f"  OK   {name:14s} HTTP 200  {sample(name, body)}")
    elif status in (401, 403):
        print(f"  FAIL {name:14s} HTTP {status} (key rejected / not authorized / API not enabled)")
        print(f"        -> {body[:240].strip()}")
    else:
        print(f"  ??   {name:14s} HTTP {status}")
        print(f"        -> {str(body)[:240].strip()}")


print("Testing keyed weather-API secrets for Boone, NC (lat 36.2168, lon -81.6746)\n")

check("OpenWeatherMap", "OPENWEATHER_API_KEY",
      lambda k: f"https://api.openweathermap.org/data/2.5/forecast?lat={LAT}&lon={LON}&units=imperial&appid={k}")
check("WeatherAPI", "WEATHERAPI_KEY",
      lambda k: f"https://api.weatherapi.com/v1/forecast.json?key={k}&q={LAT},{LON}&days=3")
check("VisualCrossing", "VISUALCROSSING_KEY",
      lambda k: f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{LAT},{LON}?unitGroup=us&include=days&contentType=json&key={k}")
check("Tomorrow.io", "TOMORROW_API_KEY",
      lambda k: f"https://api.tomorrow.io/v4/weather/forecast?location={LAT},{LON}&timesteps=1d&units=imperial&apikey={k}")
check("GoogleWeather", "GOOGLE_WEATHER_API_KEY",
      lambda k: f"https://weather.googleapis.com/v1/forecast/days:lookup?key={k}&location.latitude={LAT}&location.longitude={LON}&days=3")

print("\nDone.")
