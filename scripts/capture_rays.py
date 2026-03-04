#!/usr/bin/env python3
"""
capture_rays.py — Capture RaysWeather.com forecast for Boone, NC
Takes a screenshot and extracts forecast data from the rendered page.
Runs daily via GitHub Actions at 7:00 AM EST.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Playwright is async-only for best compatibility with GitHub Actions
from playwright.async_api import async_playwright

EST = timezone(timedelta(hours=-5))
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

BOONE_FORECAST_URL = "https://raysweather.com/Forecast/Boone"
BOONE_HOME_URL = "https://raysweather.com"


async def capture_forecast():
    today = datetime.now(EST).strftime("%Y-%m-%d")
    capture_dir = DATA_DIR / "predictions" / today
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

        # ── 1. Capture the forecast page ──────────────────────────────
        print(f"[{today}] Loading {BOONE_FORECAST_URL} ...")
        try:
            await page.goto(BOONE_FORECAST_URL, wait_until="networkidle", timeout=30000)
            # Wait for forecast content to render (Next.js client-side)
            await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"  WARNING: Page load issue: {e}")
            # Try anyway — partial render is better than nothing

        # Full-page screenshot of forecast
        screenshot_path = capture_dir / "rays_forecast.png"
        await page.screenshot(path=str(screenshot_path), full_page=True)
        print(f"  Saved forecast screenshot: {screenshot_path}")

        # ── 2. Extract text data from the page ────────────────────────
        forecast_data = {
            "source": "raysweather",
            "captured_at": datetime.now(EST).isoformat(),
            "location": "Boone",
            "forecast_for": today,
            "url": BOONE_FORECAST_URL,
            "narrative": "",
            "daily": [],
            "raw_text": "",
        }

        try:
            # Grab all visible text from the main content area
            raw_text = await page.evaluate("""
                () => {
                    // Try to get the main forecast content
                    const main = document.querySelector('main') || document.body;
                    return main.innerText;
                }
            """)
            forecast_data["raw_text"] = raw_text[:5000]  # Cap at 5k chars

            # Try to extract structured forecast data from the DOM
            # These selectors may need updating if Ray changes his site
            structured = await page.evaluate("""
                () => {
                    const data = { temps: [], conditions: [], narrative: '' };

                    // Look for temperature elements (common patterns)
                    document.querySelectorAll('[class*="temp"], [class*="Temp"]').forEach(el => {
                        data.temps.push(el.innerText.trim());
                    });

                    // Look for forecast narrative text
                    document.querySelectorAll('[class*="forecast"], [class*="Forecast"], p').forEach(el => {
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

        # ── 3. Also capture the homepage for the overview cards ───────
        try:
            await page.goto(BOONE_HOME_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
            home_screenshot = capture_dir / "rays_homepage.png"
            await page.screenshot(path=str(home_screenshot), full_page=True)
            print(f"  Saved homepage screenshot: {home_screenshot}")
        except Exception as e:
            print(f"  WARNING: Homepage capture issue: {e}")

        await browser.close()

    # ── 4. Save structured data ───────────────────────────────────
    json_path = capture_dir / "rays_boone.json"
    with open(json_path, "w") as f:
        json.dump(forecast_data, f, indent=2)
    print(f"  Saved forecast data: {json_path}")

    # ── 5. Save capture metadata ──────────────────────────────────
    meta = {
        "date": today,
        "captured_at": datetime.now(EST).isoformat(),
        "sources_captured": ["raysweather"],
        "screenshots": [
            str(screenshot_path.relative_to(BASE_DIR)),
        ],
    }
    meta_path = capture_dir / "meta.json"
    # Merge with existing meta if other scripts ran first
    if meta_path.exists():
        with open(meta_path) as f:
            existing = json.load(f)
        existing["sources_captured"].extend(meta["sources_captured"])
        existing["screenshots"].extend(meta["screenshots"])
        meta = existing
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  Done! Captured Ray's forecast for {today}")
    return forecast_data


if __name__ == "__main__":
    asyncio.run(capture_forecast())
