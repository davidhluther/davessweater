#!/usr/bin/env python3
"""
capture_rays.py — scrape current conditions + forecast Hi/Lo from raysweather.com/Forecast/Boone
Saves:
  data/predictions/YYYY-MM-DD/rays_boone.json
  data/predictions/YYYY-MM-DD/rays_forecast.png   (full-page screenshot)

Run at 7:00 AM EST via GitHub Actions.
"""

import asyncio
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from playwright.async_api import async_playwright, TimeoutError as PWTimeout
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

# ── config ─────────────────────────────────────────────────────────────────────

URL       = "https://raysweather.com/Forecast/Boone"
ROOT      = Path(__file__).resolve().parent.parent
EST       = timezone(timedelta(hours=-5))
TODAY     = datetime.now(EST).strftime("%Y-%m-%d")
OUT_DIR   = ROOT / "data" / "predictions" / TODAY
OUT_JSON  = OUT_DIR / "rays_boone.json"
OUT_PNG   = OUT_DIR / "rays_forecast.png"

# Viewport that matches Ray's mobile card layout
VIEWPORT  = {"width": 390, "height": 844}

# How long to wait for the JS-rendered content to appear (ms)
TIMEOUT   = 20_000

# ── helpers ───────────────────────────────────────────────────────────────────

def parse_temp(raw: str) -> float | None:
    """Extract numeric temp from strings like '72', '72°', '72°F', 'Hi 72', 'Lo 47'."""
    if not raw:
        return None
    m = re.search(r"[-\d.]+", raw.replace("°", "").replace("F", "").strip())
    return float(m.group()) if m else None


def parse_wind(raw: str) -> dict:
    """
    Parse strings like 'S @ 3 mph' or 'NW @ 12 mph'.
    Returns {'direction': 'S', 'speed_mph': 3.0, 'raw': 'S @ 3 mph'}
    """
    out = {"direction": None, "speed_mph": None, "raw": raw.strip()}
    m = re.match(r"([A-Z]{1,3})\s*@\s*([\d.]+)\s*mph", raw.strip(), re.I)
    if m:
        out["direction"] = m.group(1).upper()
        out["speed_mph"] = float(m.group(2))
    return out


def parse_number(raw: str) -> float | None:
    """Extract first number from a string like '75 %' or '0.01 "'."""
    m = re.search(r"[-\d.]+", raw or "")
    return float(m.group()) if m else None

# ── main scrape ───────────────────────────────────────────────────────────────

async def scrape() -> dict:
    captured_at = datetime.now(EST).isoformat()
    result = {
        "date":         TODAY,
        "captured_at":  captured_at,
        "url":          URL,
        "current":      {},
        "forecast":     {},
        "narrative":    "",
        "raw_text":     "",
        "daily":        [],
        "error":        None,
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport=VIEWPORT,
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            ),
        )
        page = await ctx.new_page()

        try:
            await page.goto(URL, wait_until="domcontentloaded", timeout=TIMEOUT)

            # Wait for the page to render
            await page.wait_for_selector("text=Boone", timeout=TIMEOUT)
            await page.wait_for_timeout(4000)

            # ── SCREENSHOT (Forecast tab) ────────────────────────────────
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            await page.evaluate("window.scrollTo(0, 0)")
            await page.screenshot(path=str(OUT_PNG), full_page=False)
            print(f"  screenshot saved → {OUT_PNG}")

            # ── GRAB FULL PAGE TEXT (Forecast tab) ────────────────────────
            forecast_text = await page.inner_text("body")
            result["raw_text"] = forecast_text
            print(f"  raw text length: {len(forecast_text)} chars")

            # Parse current temp from "Right Now" section: "XX.X°F"
            result["current"] = _parse_current_from_text(forecast_text)

            # Parse forecast Hi/Lo from the forecast strip
            result["forecast"] = _parse_forecast_from_text(forecast_text)

            # Parse the daily forecast entries
            result["daily"] = _parse_daily_forecast(forecast_text)

            # Extract narrative
            result["narrative"] = _extract_narrative(forecast_text)

            # Also try to get high from "Today's forecast" narrative line
            # e.g. "Today's forecast: ...High 71°"
            if result["forecast"]["today_high_f"] is None:
                m = re.search(r"(?:Today'?s? forecast|Tonight'?s? forecast)[^.]*?High\s+([\d.]+)", forecast_text, re.I)
                if m:
                    result["forecast"]["today_high_f"] = float(m.group(1))
                    print(f"  got high from narrative: {m.group(1)}")

            # ── CLICK "Current" TAB for detailed conditions ───────────────
            try:
                current_tab = await page.query_selector("text=Current")
                if current_tab:
                    await current_tab.click()
                    await page.wait_for_timeout(2000)
                    current_text = await page.inner_text("body")
                    current_conditions = _parse_current_conditions(current_text)
                    # Merge into current — don't overwrite temp if we already have it
                    for k, v in current_conditions.items():
                        if v is not None and (result["current"].get(k) is None):
                            result["current"][k] = v
                    print(f"  current conditions from tab: {current_conditions}")
            except Exception as e:
                print(f"  WARNING: couldn't click Current tab: {e}")

        except PWTimeout:
            result["error"] = f"Timeout after {TIMEOUT}ms waiting for page to render"
            print(f"  ERROR: {result['error']}")
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            try:
                await page.screenshot(path=str(OUT_PNG), full_page=False)
            except Exception:
                pass
        except Exception as e:
            result["error"] = str(e)
            print(f"  ERROR: {e}")
        finally:
            await browser.close()

    return result


def _parse_current_from_text(text: str) -> dict:
    """
    Parse current temp from the Forecast tab text.
    Looks for the "Right Now" section with temp like "45.4°F" or "67.9°F".
    """
    current = {
        "temp_f":       None,
        "feels_like_f": None,
        "wind":         None,
        "wind_dir":     None,
        "wind_mph":     None,
        "gust_mph":     None,
        "humidity_pct": None,
        "rainfall_in":  None,
    }

    # Current temp: look for "XX.X°F" pattern (Ray's format)
    # The temp appears near "Right Now" as a standalone line like "45.4°F"
    m = re.search(r"Right Now\s*\n\s*([\d.]+)\s*°\s*F", text, re.I)
    if m:
        current["temp_f"] = float(m.group(1))
    else:
        # Fallback: look for standalone "XX.X°F" lines
        for line in text.splitlines():
            line = line.strip()
            m = re.fullmatch(r"([\d.]+)\s*°\s*F?", line)
            if m:
                val = float(m.group(1))
                if 0 < val < 120:
                    current["temp_f"] = val
                    break

    return current


def _parse_current_conditions(text: str) -> dict:
    """
    Parse detailed current conditions from the 'Current' tab text.
    Ray's format:
      Feels Like: 46.1°
      Wind: WNW @ 0 mph
      Gust: 0 mph
      Humidity: 95 %
      Rainfall: 0 "
    """
    current = {
        "temp_f":       None,
        "feels_like_f": None,
        "wind":         None,
        "wind_dir":     None,
        "wind_mph":     None,
        "gust_mph":     None,
        "humidity_pct": None,
        "rainfall_in":  None,
    }

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    for line in lines:
        ll = line.lower()
        if "feels like" in ll:
            current["feels_like_f"] = parse_temp(line.split(":")[-1])
        elif re.match(r"^wind\s*:", ll):
            raw_wind = line.split(":", 1)[-1].strip()
            w = parse_wind(raw_wind)
            current["wind"]     = w["raw"]
            current["wind_dir"] = w["direction"]
            current["wind_mph"] = w["speed_mph"]
        elif re.match(r"^gust\s*:", ll):
            current["gust_mph"] = parse_number(line.split(":", 1)[-1])
        elif re.match(r"^humidity\s*:", ll):
            current["humidity_pct"] = parse_number(line.split(":", 1)[-1])
        elif re.match(r"^rainfall\s*:", ll):
            current["rainfall_in"] = parse_number(line.split(":", 1)[-1])

    # Also try to get temp from "XX.X°F" pattern
    m = re.search(r"Right Now\s*\n\s*([\d.]+)\s*°\s*F", text, re.I)
    if m:
        current["temp_f"] = float(m.group(1))

    return current


def _parse_forecast_from_text(text: str) -> dict:
    """
    Parse forecast Hi/Lo from Ray's forecast strip.
    Ray's actual format (from raw_text):
      Thursday
      Daytime
      Hi: 72
      Overnight
      Lo: 50
    Also handles "Hi 72" without colon.
    """
    forecast = {
        "today_high_f": None,
        "tonight_low_f": None,
        "raw_strip": [],
    }

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Collect all Hi/Lo values in order — handle both "Hi: 72" and "Hi 72"
    hi_lo_pairs = []
    for line in lines:
        m_hi = re.match(r"^Hi:?\s+([\d.]+)", line, re.I)
        m_lo = re.match(r"^Lo:?\s+([\d.]+)", line, re.I)
        if m_hi:
            hi_lo_pairs.append(("hi", float(m_hi.group(1))))
        elif m_lo:
            hi_lo_pairs.append(("lo", float(m_lo.group(1))))

    forecast["raw_strip"] = hi_lo_pairs

    if hi_lo_pairs:
        his = [v for t, v in hi_lo_pairs if t == "hi"]
        los = [v for t, v in hi_lo_pairs if t == "lo"]
        forecast["today_high_f"]  = his[0] if his else None
        forecast["tonight_low_f"] = los[0] if los else None

    # Fallback: try to extract from narrative "High XX°" or "Low XX°"
    if forecast["today_high_f"] is None:
        m = re.search(r"\bHigh\s+([\d.]+)\s*°", text)
        if m:
            forecast["today_high_f"] = float(m.group(1))
    if forecast["tonight_low_f"] is None:
        m = re.search(r"\bLow\s+([\d.]+)\s*°", text)
        if m:
            forecast["tonight_low_f"] = float(m.group(1))

    return forecast


def _parse_wind_from_desc(desc: str) -> float | None:
    """
    Extract wind speed from a forecast description string.
    Handles patterns like:
      "SSW wind 5-15 mph"  → 10.0  (midpoint)
      "West wind 5-15 mph" → 10.0
      "NW 5-15"            → 10.0
      "Light SW wind becoming NW 5-15 & breezy" → 10.0
    Returns the midpoint of the range, or the single value if no range.
    """
    # Match "wind 5-15 mph" or "wind 5-15" or direction + "5-15"
    m = re.search(r"(?:wind\s+|[NSEW]{1,3}\s+)([\d]+)\s*[-–&]\s*([\d]+)", desc, re.I)
    if m:
        lo, hi = float(m.group(1)), float(m.group(2))
        return round((lo + hi) / 2, 1)
    # Single value: "wind 10 mph"
    m = re.search(r"wind\s+([\d]+)\s*mph", desc, re.I)
    if m:
        return float(m.group(1))
    return None


def _parse_daily_forecast(text: str) -> list:
    """
    Parse multi-day forecast from Ray's text.
    Ray's actual format in raw_text:
      Hi: 72
      Saturday
      Partly to mostly cloudy; SSW wind 5-15 mph, breezy at times
      Lo: 53
      Saturday night
      Mostly cloudy; SW wind 5-15 mph, breezy
      Hi: 65
      Sunday
      ...
    Description lines sit between day-name and next Hi:/Lo: line (no prefix).
    """
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    night_names = {f"{d} night" for d in days_of_week}
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Find day-name boundaries (exclude "Saturday night" etc.)
    day_indices = []
    for i, line in enumerate(lines):
        if line in days_of_week:
            day_indices.append((i, line))

    daily = []
    today_dt = datetime.now(EST)

    for idx, (start_i, day_name) in enumerate(day_indices):
        end_i = day_indices[idx + 1][0] if idx + 1 < len(day_indices) else min(start_i + 20, len(lines))
        chunk = lines[start_i:end_i]

        high_f = None
        low_f = None
        daytime_desc = ""
        overnight_desc = ""

        # Walk through the chunk and assign description lines based on position
        in_night = False
        for line in chunk:
            m_hi = re.match(r"^Hi:?\s+([\d.]+)", line, re.I)
            m_lo = re.match(r"^Lo:?\s+([\d.]+)", line, re.I)
            if m_hi:
                high_f = float(m_hi.group(1))
            elif m_lo:
                low_f = float(m_lo.group(1))
            elif line.lower() in {n.lower() for n in night_names}:
                in_night = True
            elif line in days_of_week:
                continue  # skip the day-name header itself
            elif line.lower().startswith("daytime:"):
                daytime_desc = line.split(":", 1)[-1].strip()
            elif line.lower().startswith("overnight:"):
                overnight_desc = line.split(":", 1)[-1].strip()
                in_night = True
            elif line.lower().startswith(("daytime", "overnight", "extended", "subscribe", "station")):
                continue
            else:
                # Plain description line — assign to daytime or overnight
                if in_night:
                    if overnight_desc:
                        overnight_desc += "; " + line
                    else:
                        overnight_desc = line
                else:
                    if daytime_desc:
                        daytime_desc += "; " + line
                    else:
                        daytime_desc = line

        # Extract wind from descriptions (use daytime wind as primary)
        wind_mph = _parse_wind_from_desc(daytime_desc)
        if wind_mph is None:
            wind_mph = _parse_wind_from_desc(overnight_desc)

        # Calculate date from day name
        days_ahead = (days_of_week.index(day_name) - today_dt.weekday()) % 7
        if days_ahead == 0 and len(daily) > 0:
            days_ahead = 7  # avoid duplicate today
        forecast_date = (today_dt + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

        daily.append({
            "date": forecast_date,
            "day_name": day_name,
            "high_f": high_f,
            "low_f": low_f,
            "wind_mph": wind_mph,
            "daytime_desc": daytime_desc,
            "overnight_desc": overnight_desc,
            "category": "unknown",
            "precip_in": 0.0,
        })

    return daily


def _extract_narrative(text: str) -> str:
    """Extract the main forecast narrative text."""
    # Look for text between the forecast title and the daily strip
    m = re.search(r"Last Updated.*?by\s+\w+\s+\w+\s*\n(.+?)(?=\n(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\n)", text, re.S)
    if m:
        return m.group(1).strip()
    return ""

# ── entry point ───────────────────────────────────────────────────────────────

def main():
    print(f"🌤  Capturing Ray's Weather for {TODAY}…")
    data = asyncio.run(scrape())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, indent=2))
    print(f"✅ Saved → {OUT_JSON}")

    if data.get("error"):
        print(f"⚠️  Completed with error: {data['error']}")
        sys.exit(1)

    c = data.get("current", {})
    f = data.get("forecast", {})
    print(f"   Current: {c.get('temp_f')}°F  (feels like {c.get('feels_like_f')}°F)")
    print(f"   Wind: {c.get('wind')}  Gust: {c.get('gust_mph')} mph")
    print(f"   Humidity: {c.get('humidity_pct')}%  Rainfall: {c.get('rainfall_in')}\"")
    print(f"   Forecast: Hi {f.get('today_high_f')}° / Lo {f.get('tonight_low_f')}°")
    if data.get("daily"):
        print(f"   Daily entries: {len(data['daily'])}")
        for d in data["daily"]:
            print(f"     {d['day_name']}: Hi {d['high_f']}° / Lo {d['low_f']}°")


if __name__ == "__main__":
    main()
