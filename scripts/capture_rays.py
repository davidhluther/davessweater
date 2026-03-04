#!/usr/bin/env python3
"""
capture_rays.py — Capture RaysWeather.com forecast for Boone, NC
Takes a screenshot and extracts forecast data from the rendered page.
Runs daily via GitHub Actions at 7:00 AM EST.
"""

import asyncio
import json
import re
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from playwright.async_api import async_playwright

EST = timezone(timedelta(hours=-5))
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

BOONE_FORECAST_URL = "https://raysweather.com/Forecast/Boone"
BOONE_HOME_URL = "https://raysweather.com"

# Map day names to date offsets from today
DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def parse_forecast_from_text(raw_text, base_date):
    """
    Parse structured daily forecasts from Ray's raw page text.
    Looks for patterns like:
        Wednesday
        Daytime
        Hi: 67
        Overnight
        Lo: 46
    """
    days = []
    today = base_date
    today_weekday = today.weekday()  # 0=Monday

    # Split into lines and clean up
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]

    i = 0
    while i < len(lines):
        line_lower = lines[i].lower()

        # Check if this line is a day name
        if line_lower in DAY_NAMES:
            day_name = line_lower
            high_f = None
            low_f = None
            daytime_desc = ""
            overnight_desc = ""

            # Look ahead for Hi/Lo within next 10 lines
            j = i + 1
            while j < min(i + 15, len(lines)):
                hi_match = re.match(r'Hi:\s*(\d+)', lines[j], re.IGNORECASE)
                lo_match = re.match(r'Lo:\s*(\d+)', lines[j], re.IGNORECASE)
                if hi_match:
                    high_f = float(hi_match.group(1))
                if lo_match:
                    low_f = float(lo_match.group(1))
                # Grab description lines
                if lines[j].lower() == 'daytime' or lines[j].lower() == 'overnight':
                    pass  # section header
                elif hi_match or lo_match:
                    pass
                elif high_f is not None and low_f is None and not daytime_desc:
                    daytime_desc = lines[j]
                elif high_f is not None and low_f is not None and not overnight_desc:
                    overnight_desc = lines[j]
                # Stop if we hit another day name
                if lines[j].lower() in DAY_NAMES and j > i + 1:
                    break
                j += 1

            if high_f is not None or low_f is not None:
                # Calculate the date for this day
                target_weekday = DAY_NAMES.index(day_name)
                days_ahead = (target_weekday - today_weekday) % 7
                if days_ahead == 0 and days:
                    days_ahead = 7  # already saw today, this must be next week
                forecast_date = today + timedelta(days=days_ahead)

                days.append({
                    "date": forecast_date.strftime("%Y-%m-%d"),
                    "day_name": day_name.capitalize(),
                    "high_f": high_f,
                    "low_f": low_f,
                    "daytime_desc": daytime_desc,
                    "overnight_desc": overnight_desc,
                    "category": _desc_to_category(daytime_desc),
                    "precip_in": _desc_has_precip(daytime_desc),
                })
            i = j
        else:
            i += 1

    return days


def _desc_to_category(desc):
    desc_lower = desc.lower()
    if any(w in desc_lower for w in ["snow", "flurr", "wintry"]):
        return "snow"
    if any(w in desc_lower for w in ["thunder", "storm"]):
        return "storm"
    if any(w in desc_lower for w in ["rain", "shower", "drizzle"]):
        return "rain"
    if any(w in desc_lower for w in ["fog", "mist"]):
        return "fog"
    if any(w in desc_lower for w in ["cloud", "overcast"]):
        return "cloudy"
    if any(w in desc_lower for w in ["sun", "clear", "fair"]):
        return "clear"
    return "unknown"


def _desc_has_precip(desc):
    """Return small precip estimate if description suggests rain/snow."""
    desc_lower = desc.lower()
    if any(w in desc_lower for w in ["heavy rain", "heavy snow"]):
        return 0.5
    if any(w in desc_lower for w in ["rain", "snow", "shower", "drizzle", "thunder"]):
        return 0.1
    return 0.0


async def capture_forecast():
    today = datetime.now(EST)
    today_str = today.strftime("%Y-%m-%d")
    capture_dir = DATA_DIR / "predictions" / today_str
    capture_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        print(f"[{today_str}] Loading {BOONE_FORECAST_URL} ...")
        try:
            await page.goto(BOONE_FORECAST_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"  WARNING: Page load issue: {e}")

        # Screenshot
        screenshot_path = capture_dir / "rays_forecast.png"
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"  Saved forecast screenshot: {screenshot_path}")

        # Extract text
        forecast_data = {
            "source": "raysweather",
            "captured_at": datetime.now(EST).isoformat(),
            "location": "Boone",
            "forecast_for": today_str,
            "url": BOONE_FORECAST_URL,
            "narrative": "",
            "daily": [],
            "raw_text": "",
        }

        try:
            raw_text = await page.evaluate("""
                () => {
                    const main = document.querySelector('main') || document.body;
                    return main.innerText;
                }
            """)
            forecast_data["raw_text"] = raw_text[:8000]

            # Extract narrative
            structured = await page.evaluate("""
                () => {
                    const data = { narrative: '' };
                    document.querySelectorAll('p').forEach(el => {
                        const text = el.innerText.trim();
                        if (text.length > 50 && text.length < 2000) {
                            data.narrative += text + '\\n';
                        }
                    });
                    return data;
                }
            """)
            if structured.get("narrative"):
                forecast_data["narrative"] = structured["narrative"][:2000]

        except Exception as e:
            print(f"  WARNING: Data extraction issue: {e}")

        # Homepage screenshot
        try:
            await page.goto(BOONE_HOME_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
            home_screenshot = capture_dir / "rays_homepage.png"
            await page.screenshot(path=str(home_screenshot), full_page=True)
            print(f"  Saved homepage screenshot: {home_screenshot}")
        except Exception as e:
            print(f"  WARNING: Homepage capture issue: {e}")

        await browser.close()

    # Parse structured daily forecasts from raw text
    if forecast_data["raw_text"]:
        parsed_days = parse_forecast_from_text(forecast_data["raw_text"], today.date())
        forecast_data["daily"] = parsed_days
        print(f"  Parsed {len(parsed_days)} daily forecasts from Ray's text")
        for d in parsed_days:
            print(f"    {d['day_name']} {d['date']}: Hi {d['high_f']}° / Lo {d['low_f']}° — {d['category']}")

    # Save
    json_path = capture_dir / "rays_boone.json"
    with open(json_path, "w") as f:
        json.dump(forecast_data, f, indent=2)
    print(f"  Saved forecast data: {json_path}")

    # Update meta
    meta_path = capture_dir / "meta.json"
    if meta_path.exists():
        with open(meta_path) as f:
            meta = json.load(f)
    else:
        meta = {"date": today_str, "captured_at": datetime.now(EST).isoformat(),
                "sources_captured": [], "screenshots": []}
    if "raysweather" not in meta["sources_captured"]:
        meta["sources_captured"].append("raysweather")
    meta.setdefault("screenshots", [])
    meta["screenshots"].append(str(screenshot_path.relative_to(BASE_DIR)))
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  Done! Captured Ray's forecast for {today_str}")
    return forecast_data


if __name__ == "__main__":
    asyncio.run(capture_forecast())
