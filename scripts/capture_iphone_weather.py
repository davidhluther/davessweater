#!/usr/bin/env python3
"""
capture_iphone_weather.py — fetch current conditions + forecast for Boone, NC
from Open-Meteo (same source as the live widget on the site).

Captures:
- Current temp, feels like, wind, humidity
- Forecast Hi / Lo + wind, precip, conditions (for scoring)
- iPhone Weather app screenshot (rendered via Playwright)

Saves:
  data/predictions/YYYY-MM-DD/iphone_forecast.json
  data/predictions/YYYY-MM-DD/iphone_screenshot.png

Run as part of daily_capture.yml at 7:00 AM EST (same time as capture_rays.py).
"""

import json
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path


# ── config ─────────────────────────────────────────────────────────────────────

LOCATION  = "Boone, NC"
ROOT      = Path(__file__).resolve().parent.parent
EST       = ZoneInfo("America/New_York")
TODAY     = datetime.now(EST).strftime("%Y-%m-%d")
OUT_DIR   = ROOT / "data" / "predictions" / TODAY
OUT_JSON  = OUT_DIR / "iphone_forecast.json"
OUT_PNG   = OUT_DIR / "iphone_screenshot.png"

# Boone, NC coordinates — same as build_site.py live widget
BOONE_LAT = 36.2168
BOONE_LON = -81.6746

OPENMETEO_URL = (
    f"https://api.open-meteo.com/v1/forecast?"
    f"latitude={BOONE_LAT}&longitude={BOONE_LON}"
    f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
    f"weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
    f"weather_code,wind_speed_10m_max"
    f"&temperature_unit=fahrenheit&wind_speed_unit=mph"
    f"&precipitation_unit=inch&timezone=America/New_York"
    f"&forecast_days=3"
)

# ── helpers ────────────────────────────────────────────────────────────────────

def safe_float(val, default=None):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def compass_to_abbr(degrees: float | None) -> str | None:
    """Convert compass degrees to 16-point abbreviation (N, NNE, etc.)."""
    if degrees is None:
        return None
    dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
            "S","SSW","SW","WSW","W","WNW","NW","NNW"]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]


# WMO weather code descriptions (same as capture_openmeteo.py)
WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ slight hail", 99: "Thunderstorm w/ heavy hail",
}


def weather_category(code):
    """Simplified category for scoring (same as capture_openmeteo.py)."""
    if code is None:
        return "unknown"
    if code <= 1:
        return "clear"
    elif code <= 3:
        return "cloudy"
    elif code <= 48:
        return "fog"
    elif code <= 57:
        return "drizzle"
    elif code <= 67:
        return "rain"
    elif code <= 77:
        return "snow"
    elif code <= 82:
        return "rain"
    elif code <= 86:
        return "snow"
    else:
        return "storm"


# ── fetch ──────────────────────────────────────────────────────────────────────

def fetch_openmeteo() -> dict:
    """Fetch Open-Meteo JSON and return the raw parsed dict."""
    req = urllib.request.Request(
        OPENMETEO_URL,
        headers={
            "User-Agent": "DavesSweater/1.0 (weather accuracy tracker; davessweater.com)",
            "Accept":     "application/json",
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def parse_openmeteo(raw: dict) -> dict:
    """
    Extract weather data from Open-Meteo JSON response.

    Current: temp, feels_like, wind, humidity
    Forecast: high, low, wind, precip, conditions (for scoring)
    """
    captured_at = datetime.now(EST).isoformat()
    result = {
        "date":         TODAY,
        "captured_at":  captured_at,
        "source":       "Open-Meteo (same as live widget)",
        "location":     LOCATION,
        "current":      {},
        "forecast":     {},
        "daily":        [],
        "error":        None,
    }

    try:
        cur = raw.get("current", {})
        daily_raw = raw.get("daily", {})

        # ── current conditions ─────────────────────────────────────────────
        temp_f      = safe_float(cur.get("temperature_2m"))
        feels_f     = safe_float(cur.get("apparent_temperature"))
        wind_mph    = safe_float(cur.get("wind_speed_10m"))
        wind_deg    = safe_float(cur.get("wind_direction_10m"))
        wind_dir    = compass_to_abbr(wind_deg)
        gust_mph    = safe_float(cur.get("wind_gusts_10m"))
        humidity    = safe_float(cur.get("relative_humidity_2m"))
        cur_code    = cur.get("weather_code")
        cur_desc    = WMO_CODES.get(cur_code, "Unknown")

        # Format wind the same way Ray does: "S @ 3 mph"
        if wind_dir and wind_mph is not None:
            wind_str = f"{wind_dir} @ {int(wind_mph)} mph"
        elif wind_mph is not None:
            wind_str = f"{int(wind_mph)} mph"
        else:
            wind_str = None

        result["current"] = {
            "temp_f":       temp_f,
            "feels_like_f": feels_f,
            "wind":         wind_str,
            "wind_dir":     wind_dir,
            "wind_mph":     wind_mph,
            "gust_mph":     gust_mph,
            "humidity_pct": humidity,
            "conditions":   cur_desc,
        }

        # ── daily forecast arrays ─────────────────────────────────────────
        dates   = daily_raw.get("time", [])
        highs   = daily_raw.get("temperature_2m_max", [])
        lows    = daily_raw.get("temperature_2m_min", [])
        precips = daily_raw.get("precipitation_sum", [])
        codes   = daily_raw.get("weather_code", [])
        winds   = daily_raw.get("wind_speed_10m_max", [])

        # ── today's forecast (for scoring) ────────────────────────────────
        if dates:
            today_code = codes[0] if codes else None
            today_desc = WMO_CODES.get(today_code, "Unknown")
            result["forecast"] = {
                "today_high_f":  highs[0] if highs else None,
                "tonight_low_f": lows[0] if lows else None,
                "day_low_f":     lows[0] if lows else None,
                "wind_mph":      winds[0] if winds else None,
                "precip_in":     precips[0] if precips else None,
                "conditions":    today_desc,
                "category":      weather_category(today_code),
            }

        # ── multi-day forecast (for screenshot) ───────────────────────────
        for i in range(len(dates)):
            code = codes[i] if i < len(codes) else None
            result["daily"].append({
                "date":       dates[i],
                "high_f":     highs[i] if i < len(highs) else None,
                "low_f":      lows[i] if i < len(lows) else None,
                "wind_mph":   winds[i] if i < len(winds) else None,
                "precip_in":  precips[i] if i < len(precips) else None,
                "conditions": WMO_CODES.get(code, "Unknown"),
                "category":   weather_category(code),
            })

    except (KeyError, IndexError, TypeError) as e:
        result["error"] = f"Parse error: {e}"
        print(f"  ERROR parsing Open-Meteo response: {e}", file=sys.stderr)

    return result


# ── screenshot ─────────────────────────────────────────────────────────────────

# iOS Weather icon mapping for WMO descriptions
WEATHER_ICONS = {
    "clear": "☀️", "mainly clear": "☀️",
    "partly cloudy": "⛅",
    "overcast": "☁️",
    "fog": "🌫️",
    "drizzle": "🌦️", "light drizzle": "🌦️", "slight": "🌦️",
    "rain": "🌧️", "heavy rain": "🌧️", "moderate rain": "🌧️",
    "snow": "🌨️", "light snow": "🌨️",
    "storm": "⛈️", "thunderstorm": "⛈️",
    "sleet": "🌨️", "freezing": "🌨️",
    "shower": "🌧️",
}


def _get_icon(conditions: str) -> str:
    """Get weather icon for a conditions string."""
    c = conditions.lower().strip()
    for key, icon in WEATHER_ICONS.items():
        if key in c:
            return icon
    return "🌡️"


def _build_screenshot_html(data: dict) -> str:
    """Build HTML that looks like the iOS Weather app."""
    current = data.get("current", {})
    forecast = data.get("forecast", {})
    daily = data.get("daily", [])

    temp = current.get("temp_f", "--")
    temp_s = f"{temp:.0f}" if isinstance(temp, (int, float)) else str(temp)
    high = forecast.get("today_high_f", "--")
    low = forecast.get("tonight_low_f", forecast.get("day_low_f", "--"))
    high_s = f"{high:.0f}" if isinstance(high, (int, float)) else str(high)
    low_s = f"{low:.0f}" if isinstance(low, (int, float)) else str(low)
    conditions = current.get("conditions", forecast.get("conditions", ""))

    # Build forecast rows
    rows_html = ""
    from datetime import datetime as dt
    for i, day in enumerate(daily):
        date_str = day.get("date", "")
        try:
            d = dt.strptime(date_str, "%Y-%m-%d")
            day_name = "Today" if i == 0 else d.strftime("%A")
        except ValueError:
            day_name = "?"
        icon = _get_icon(day.get("conditions", ""))
        dh = day.get("high_f")
        dl = day.get("low_f")
        dh_s = f"{dh:.0f}°" if isinstance(dh, (int, float)) else "--"
        dl_s = f"{dl:.0f}°" if isinstance(dl, (int, float)) else "--"

        rows_html += f"""
        <div class="forecast-row">
          <span class="day-name">{day_name}</span>
          <span class="day-icon">{icon}</span>
          <span class="day-lo">{dl_s}</span>
          <div class="temp-bar-wrap">
            <div class="temp-bar"></div>
          </div>
          <span class="day-hi">{dh_s}</span>
        </div>"""

    # Calculate temp bar positions via JS after render
    all_lows = [d.get("low_f", 50) for d in daily if d.get("low_f") is not None]
    all_highs = [d.get("high_f", 70) for d in daily if d.get("high_f") is not None]
    week_min = min(all_lows) if all_lows else 30
    week_max = max(all_highs) if all_highs else 80

    bar_js = "const wMin=%s,wMax=%s,range=Math.max(wMax-wMin,1);" % (week_min, week_max)
    for i, day in enumerate(daily):
        lo = day.get("low_f", week_min)
        hi = day.get("high_f", week_max)
        lo_pct = max(0, (lo - week_min) / max(week_max - week_min, 1) * 100)
        hi_pct = min(100, (hi - week_min) / max(week_max - week_min, 1) * 100)
        bar_js += f"document.querySelectorAll('.temp-bar')[{i}].style.left='{lo_pct:.0f}%';document.querySelectorAll('.temp-bar')[{i}].style.width='{max(hi_pct-lo_pct,5):.0f}%';"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    background: linear-gradient(180deg, #1c1c2e 0%, #2d2d44 30%, #3a3a5c 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    width: 390px;
    min-height: 600px;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }}
  .header {{
    text-align: center;
    padding: 50px 20px 10px;
  }}
  .location {{
    font-size: 28px;
    font-weight: 400;
    letter-spacing: 0.5px;
  }}
  .current-temp {{
    font-size: 86px;
    font-weight: 200;
    line-height: 1;
    margin: -2px 0 2px;
  }}
  .conditions {{
    font-size: 18px;
    font-weight: 400;
    opacity: 0.9;
  }}
  .hi-lo {{
    font-size: 18px;
    font-weight: 400;
    opacity: 0.9;
    margin-top: 2px;
  }}
  .forecast-section {{
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(20px);
    border-radius: 15px;
    margin: 16px 16px;
    padding: 12px 16px;
  }}
  .forecast-label {{
    font-size: 13px;
    text-transform: uppercase;
    opacity: 0.6;
    letter-spacing: 0.5px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
    margin-bottom: 4px;
  }}
  .forecast-row {{
    display: flex;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    font-size: 18px;
  }}
  .forecast-row:last-child {{ border-bottom: none; }}
  .day-name {{
    width: 80px;
    font-weight: 500;
  }}
  .day-icon {{
    width: 36px;
    text-align: center;
    font-size: 22px;
  }}
  .day-lo {{
    width: 36px;
    text-align: right;
    opacity: 0.5;
    font-size: 17px;
  }}
  .temp-bar-wrap {{
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
    margin: 0 10px;
    position: relative;
  }}
  .temp-bar {{
    position: absolute;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #5ac8fa, #ffd60a, #ff9500);
  }}
  .day-hi {{
    width: 36px;
    text-align: left;
    font-size: 17px;
  }}
  .status-bar {{
    display: flex;
    justify-content: space-between;
    padding: 14px 24px 0;
    font-size: 15px;
    font-weight: 600;
  }}
  .home-indicator {{
    width: 134px;
    height: 5px;
    background: rgba(255,255,255,0.3);
    border-radius: 3px;
    margin: 16px auto 8px;
  }}
</style>
</head>
<body>
  <div class="status-bar">
    <span>9:41</span>
    <span style="display:flex;gap:6px;align-items:center;">
      <span style="font-size:12px;">&#9679;&#9679;&#9679;&#9679;</span>
      <span style="font-size:12px;">5G</span>
      <span style="font-size:14px;">&#128267;</span>
    </span>
  </div>
  <div class="header">
    <div class="location">Boone, NC</div>
    <div class="current-temp">{temp_s}°</div>
    <div class="conditions">{conditions}</div>
    <div class="hi-lo">H:{high_s}°  L:{low_s}°</div>
  </div>
  <div class="forecast-section">
    <div class="forecast-label">&#128197; 3-DAY FORECAST</div>
    {rows_html}
  </div>
  <div class="home-indicator"></div>
  <script>{bar_js}</script>
</body>
</html>"""


async def take_screenshot(data: dict, output_path: Path):
    """Render iPhone Weather HTML and take a screenshot with Playwright."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("  Playwright not installed, skipping screenshot", file=sys.stderr)
        return False

    html = _build_screenshot_html(data)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": 390, "height": 700},
            device_scale_factor=2,
        )
        await page.set_content(html, wait_until="networkidle")
        await page.screenshot(path=str(output_path), type="png")
        await browser.close()

    return True


# ── main ───────────────────────────────────────────────────────────────────────

def main():
    import asyncio

    print(f"📱 Capturing iPhone (Open-Meteo) weather for {TODAY}…")

    try:
        raw  = fetch_openmeteo()
        data = parse_openmeteo(raw)
    except Exception as e:
        data = {
            "date":        TODAY,
            "captured_at": datetime.now(EST).isoformat(),
            "source":      "Open-Meteo",
            "location":    LOCATION,
            "current":     {},
            "forecast":    {},
            "daily":       [],
            "error":       str(e),
        }
        print(f"  ERROR fetching Open-Meteo: {e}", file=sys.stderr)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, indent=2))
    print(f"✅ Saved → {OUT_JSON}")

    # Take screenshot if we have data
    if not data.get("error"):
        try:
            ok = asyncio.run(take_screenshot(data, OUT_PNG))
            if ok:
                print(f"📸 Screenshot → {OUT_PNG}")
        except Exception as e:
            print(f"  WARNING: Screenshot failed: {e}", file=sys.stderr)

    if data.get("error"):
        print(f"⚠️  Completed with error: {data['error']}")
        sys.exit(1)

    c = data.get("current", {})
    f = data.get("forecast", {})
    print(f"   Temp: {c.get('temp_f')}°F  (feels like {c.get('feels_like_f')}°F)")
    print(f"   Wind: {c.get('wind')}  Gust: {c.get('gust_mph')} mph")
    print(f"   Humidity: {c.get('humidity_pct')}%")
    print(f"   Forecast: Hi {f.get('today_high_f')}° / Lo {f.get('tonight_low_f')}°")
    print(f"   Conditions: {f.get('conditions')} ({f.get('category')})")


if __name__ == "__main__":
    main()
