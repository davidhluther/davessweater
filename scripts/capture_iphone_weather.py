#!/usr/bin/env python3
"""
capture_iphone_weather.py — fetch current conditions + forecast for Boone, NC
from wttr.in (same underlying model as Apple Weather / iPhone Weather app).

Captures:
- Current temp, feels like, wind, gust, humidity, rainfall
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
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ── config ─────────────────────────────────────────────────────────────────────

LOCATION  = "Boone,NC"
ROOT      = Path(__file__).resolve().parent.parent
EST       = timezone(timedelta(hours=-5))
TODAY     = datetime.now(EST).strftime("%Y-%m-%d")
OUT_DIR   = ROOT / "data" / "predictions" / TODAY
OUT_JSON  = OUT_DIR / "iphone_forecast.json"
OUT_PNG   = OUT_DIR / "iphone_screenshot.png"

# wttr.in JSON v1 endpoint — returns rich current + 3-day forecast
WTTR_URL  = f"https://wttr.in/{urllib.parse.quote(LOCATION)}?format=j1"

# ── helpers ────────────────────────────────────────────────────────────────────

def safe_float(val, default=None):
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def mm_to_inches(mm):
    """Convert millimeters to inches, rounded to 2 decimal places."""
    if mm is None:
        return None
    return round(float(mm) / 25.4, 2)


def compass_to_abbr(degrees: float | None) -> str | None:
    """Convert compass degrees to 16-point abbreviation (N, NNE, etc.)."""
    if degrees is None:
        return None
    dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
            "S","SSW","SW","WSW","W","WNW","NW","NNW"]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]


# Map wttr.in weatherDesc text to our scoring categories
WTTR_CATEGORY_MAP = {
    "sunny": "clear", "clear": "clear",
    "partly cloudy": "cloudy", "cloudy": "cloudy", "overcast": "cloudy",
    "fog": "fog", "mist": "fog", "freezing fog": "fog",
    "patchy rain possible": "drizzle", "light drizzle": "drizzle",
    "patchy light drizzle": "drizzle", "light rain": "drizzle",
    "patchy light rain": "drizzle",
    "moderate rain": "rain", "heavy rain": "rain",
    "moderate rain at times": "rain", "heavy rain at times": "rain",
    "moderate or heavy rain shower": "rain", "light rain shower": "drizzle",
    "torrential rain shower": "rain",
    "patchy snow possible": "snow", "light snow": "snow",
    "patchy light snow": "snow", "moderate snow": "snow",
    "heavy snow": "snow", "blizzard": "snow",
    "light snow showers": "snow", "moderate or heavy snow showers": "snow",
    "patchy moderate snow": "snow", "patchy heavy snow": "snow",
    "thundery outbreaks possible": "storm",
    "moderate or heavy rain with thunder": "storm",
    "patchy light rain with thunder": "storm",
    "light sleet": "sleet", "moderate or heavy sleet": "sleet",
    "light sleet showers": "sleet", "moderate or heavy sleet showers": "sleet",
    "ice pellets": "sleet", "light showers of ice pellets": "sleet",
    "freezing drizzle": "drizzle", "heavy freezing drizzle": "rain",
}


def wttr_desc_to_category(desc: str) -> str:
    """Convert wttr.in weather description to scoring category."""
    if not desc:
        return "unknown"
    return WTTR_CATEGORY_MAP.get(desc.lower().strip(), "unknown")


# ── fetch ──────────────────────────────────────────────────────────────────────

def fetch_wttr() -> dict:
    """Fetch wttr.in JSON and return the raw parsed dict."""
    req = urllib.request.Request(
        WTTR_URL,
        headers={
            "User-Agent": "DavesSweater/1.0 (weather accuracy tracker; davessweater.com)",
            "Accept":     "application/json",
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def parse_wttr(raw: dict) -> dict:
    """
    Extract weather data from wttr.in JSON response.

    Current: temp, feels_like, wind, gust, humidity, rainfall
    Forecast: high, low, wind, precip, conditions (for scoring)
    """
    captured_at = datetime.now(EST).isoformat()
    result = {
        "date":         TODAY,
        "captured_at":  captured_at,
        "source":       "wttr.in (iPhone-equivalent / Apple Weather model)",
        "location":     LOCATION,
        "current":      {},
        "forecast":     {},
        "daily":        [],
        "error":        None,
    }

    try:
        cur_raw  = raw["current_condition"][0]
        day_raw  = raw["weather"][0]           # today's forecast block

        # ── current conditions ─────────────────────────────────────────────
        temp_f      = safe_float(cur_raw.get("temp_F"))
        feels_f     = safe_float(cur_raw.get("FeelsLikeF"))
        wind_mph    = safe_float(cur_raw.get("windspeedMiles"))
        wind_deg    = safe_float(cur_raw.get("winddirDegree"))
        wind_dir    = cur_raw.get("winddir16Point") or compass_to_abbr(wind_deg)
        gust_mph    = safe_float(cur_raw.get("windGustMiles"))
        humidity    = safe_float(cur_raw.get("humidity"))
        precip_mm   = safe_float(cur_raw.get("precipMM"))
        rainfall_in = mm_to_inches(precip_mm)

        # Weather description from current conditions
        cur_desc_list = cur_raw.get("weatherDesc", [])
        cur_desc = cur_desc_list[0].get("value", "") if cur_desc_list else ""

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
            "wind":         wind_str,          # "S @ 3 mph"
            "wind_dir":     wind_dir,
            "wind_mph":     wind_mph,
            "gust_mph":     gust_mph,
            "humidity_pct": humidity,
            "rainfall_in":  rainfall_in,
            "conditions":   cur_desc,
        }

        # ── forecast hi / lo ───────────────────────────────────────────────
        high_f = safe_float(day_raw.get("maxtempF"))
        low_f  = safe_float(day_raw.get("mintempF"))

        # Extract wind and precip from hourly data for scoring
        tonight_low = None
        max_wind = None
        total_precip_mm = 0.0
        for hour in day_raw.get("hourly", []):
            t = int(hour.get("time", 0))
            # Tonight low: min temp from 6pm onward
            if t >= 1800:
                h_temp = safe_float(hour.get("tempF"))
                if h_temp is not None:
                    if tonight_low is None or h_temp < tonight_low:
                        tonight_low = h_temp
            # Max wind across all hours
            h_wind = safe_float(hour.get("windspeedMiles"))
            if h_wind is not None and (max_wind is None or h_wind > max_wind):
                max_wind = h_wind
            # Total precip across all hours
            h_precip = safe_float(hour.get("precipMM"))
            if h_precip is not None:
                total_precip_mm += h_precip

        # Weather description for today
        desc_list = day_raw.get("hourly", [{}])[len(day_raw.get("hourly", [])) // 2].get("weatherDesc", [])
        day_desc = desc_list[0].get("value", "") if desc_list else cur_desc
        category = wttr_desc_to_category(day_desc)

        result["forecast"] = {
            "today_high_f":  high_f,
            "tonight_low_f": tonight_low if tonight_low is not None else low_f,
            "day_low_f":     low_f,
            "wind_mph":      max_wind,
            "precip_in":     mm_to_inches(total_precip_mm),
            "conditions":    day_desc,
            "category":      category,
        }

        # ── multi-day forecast (for screenshot) ───────────────────────────
        for weather_day in raw.get("weather", []):
            date_str = weather_day.get("date", "")
            d_high = safe_float(weather_day.get("maxtempF"))
            d_low = safe_float(weather_day.get("mintempF"))
            # Get midday weather description
            hourly = weather_day.get("hourly", [])
            mid_hour = hourly[len(hourly) // 2] if hourly else {}
            d_desc_list = mid_hour.get("weatherDesc", [])
            d_desc = d_desc_list[0].get("value", "") if d_desc_list else ""
            # Get max wind and total precip for the day
            d_max_wind = None
            d_total_precip = 0.0
            for h in hourly:
                hw = safe_float(h.get("windspeedMiles"))
                if hw is not None and (d_max_wind is None or hw > d_max_wind):
                    d_max_wind = hw
                hp = safe_float(h.get("precipMM"))
                if hp is not None:
                    d_total_precip += hp

            result["daily"].append({
                "date":       date_str,
                "high_f":     d_high,
                "low_f":      d_low,
                "wind_mph":   d_max_wind,
                "precip_in":  mm_to_inches(d_total_precip),
                "conditions": d_desc,
                "category":   wttr_desc_to_category(d_desc),
            })

    except (KeyError, IndexError, TypeError) as e:
        result["error"] = f"Parse error: {e}"
        print(f"  ERROR parsing wttr.in response: {e}", file=sys.stderr)

    return result


# ── screenshot ─────────────────────────────────────────────────────────────────

# iOS Weather icon mapping for wttr.in descriptions
WEATHER_ICONS = {
    "clear": "☀️", "sunny": "☀️",
    "cloudy": "☁️", "overcast": "☁️",
    "partly cloudy": "⛅",
    "fog": "🌫️", "mist": "🌫️",
    "drizzle": "🌦️", "light drizzle": "🌦️",
    "rain": "🌧️", "heavy rain": "🌧️",
    "snow": "🌨️", "light snow": "🌨️",
    "storm": "⛈️", "thunderstorm": "⛈️",
    "sleet": "🌨️",
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

    print(f"📱 Capturing iPhone (wttr.in) weather for {TODAY}…")

    try:
        raw  = fetch_wttr()
        data = parse_wttr(raw)
    except Exception as e:
        data = {
            "date":        TODAY,
            "captured_at": datetime.now(EST).isoformat(),
            "source":      "wttr.in",
            "location":    LOCATION,
            "current":     {},
            "forecast":    {},
            "daily":       [],
            "error":       str(e),
        }
        print(f"  ERROR fetching wttr.in: {e}", file=sys.stderr)

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
    print(f"   Humidity: {c.get('humidity_pct')}%  Rainfall: {c.get('rainfall_in')}\"")
    print(f"   Forecast: Hi {f.get('today_high_f')}° / Lo {f.get('tonight_low_f')}°")
    print(f"   Conditions: {f.get('conditions')} ({f.get('category')})")


if __name__ == "__main__":
    main()
