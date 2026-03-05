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

# Viewport that matches Ray's mobile card layout (matches the screenshot you shared)
VIEWPORT  = {"width": 390, "height": 844}

# How long to wait for the JS-rendered content to appear (ms)
TIMEOUT   = 20_000

# ── helpers ───────────────────────────────────────────────────────────────────

def parse_temp(raw: str) -> float | None:
    """Extract numeric temp from strings like '72', '72°', 'Hi 72', 'Lo 47'."""
    if not raw:
        return None
    m = re.search(r"[-\d.]+", raw.replace("°", "").strip())
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

            # Wait for the Boone card to render — Ray's site uses Next.js so we
            # need to wait for the JS to paint the weather data.
            # We watch for something with "Boone" in a heading AND a temperature.
            await page.wait_for_selector("text=Boone", timeout=TIMEOUT)
            # Give React a beat to fill in the numbers
            await page.wait_for_timeout(3000)

            # ── SCREENSHOT ──────────────────────────────────────────────────
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            # Scroll to top first, screenshot the Boone card area
            await page.evaluate("window.scrollTo(0, 0)")
            await page.screenshot(path=str(OUT_PNG), full_page=False)
            print(f"  screenshot saved → {OUT_PNG}")

            # ── SCRAPE CURRENT CONDITIONS ───────────────────────────────────
            # Ray's page layout (from what we can see in the screenshot):
            # Each location card has:
            #   [location name]  [current temp large]
            #   Feels Like: XX.X°
            #   Wind: DIR @ X mph
            #   Gust: X mph
            #   Humidity: XX %
            #   Rainfall: X.XX "
            #   [forecast strip: Period Lo/Hi ...]

            # Strategy: find the Boone card by locating the h2/h3 with "Boone",
            # then scope all queries within its parent card element.
            boone_card = None
            for selector in [
                "//h2[contains(text(),'Boone')]/ancestor::div[contains(@class,'card') or contains(@class,'Card') or contains(@class,'location')][1]",
                "//h3[contains(text(),'Boone')]/ancestor::div[3]",
                "//strong[contains(text(),'Boone')]/ancestor::div[3]",
            ]:
                els = await page.query_selector_all(f"xpath={selector}")
                if els:
                    boone_card = els[0]
                    break

            if not boone_card:
                # Fallback: grab full page text and parse with regex
                print("  WARNING: couldn't isolate Boone card, falling back to full-page text")
                text = await page.inner_text("body")
                result["current"] = _parse_current_from_text(text)
                result["forecast"] = _parse_forecast_from_text(text)
            else:
                card_text = await boone_card.inner_text()
                print(f"  Boone card text:\n{card_text[:400]}")
                result["current"] = _parse_current_from_text(card_text)
                result["forecast"] = _parse_forecast_from_text(card_text)

        except PWTimeout:
            result["error"] = f"Timeout after {TIMEOUT}ms waiting for page to render"
            print(f"  ERROR: {result['error']}")
            # Still save whatever screenshot we got
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
    Parse current conditions from the raw text of Ray's Boone card.
    Handles patterns like:
      Feels Like: 60.9°
      Wind: S @ 3 mph
      Gust: 5 mph
      Humidity: 75 %
      Rainfall: 0.01 "
      [large temp number like 60.9°]
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
        if "feels like" in ll or "feels like:" in ll:
            current["feels_like_f"] = parse_temp(line.split(":")[-1])
        elif ll.startswith("wind:") or ll.startswith("wind "):
            raw_wind = line.split(":", 1)[-1].strip()
            w = parse_wind(raw_wind)
            current["wind"]     = w["raw"]
            current["wind_dir"] = w["direction"]
            current["wind_mph"] = w["speed_mph"]
        elif ll.startswith("gust:") or ll.startswith("gust "):
            current["gust_mph"] = parse_number(line.split(":", 1)[-1])
        elif ll.startswith("humidity:") or ll.startswith("humidity "):
            current["humidity_pct"] = parse_number(line.split(":", 1)[-1])
        elif ll.startswith("rainfall:") or ll.startswith("rainfall "):
            current["rainfall_in"] = parse_number(line.split(":", 1)[-1])

    # Current temp: look for a standalone large number like "60.9°"
    # It typically appears as a line with just a number + degree sign
    for line in lines:
        m = re.fullmatch(r"([\d.]+)\s*°?", line.strip())
        if m:
            val = float(m.group(1))
            if 0 < val < 120:   # sanity: plausible Fahrenheit
                current["temp_f"] = val
                break

    # Fallback: feels_like → temp if temp still None
    if current["temp_f"] is None and current["feels_like_f"] is not None:
        current["temp_f"] = current["feels_like_f"]

    return current


def _parse_forecast_from_text(text: str) -> dict:
    """
    Parse the forecast strip from Ray's card text.
    Ray's format (from screenshot):
      Wed night  Thu      Thu night  Fri
      Lo 47      Hi 72    Lo 50      Hi 74

    We want the FIRST "Hi" value (= today's or tomorrow's daytime high)
    and the NEXT "Lo" value (= tonight's low).

    The text after JS render looks roughly like:
      "Wed night\nLo 47\nThu\nHi 72\nThu night\nLo 50\nFri\nHi 74"
    """
    forecast = {
        "today_high_f": None,
        "tonight_low_f": None,
        "raw_strip": [],
    }

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Collect all Hi/Lo pairs in order
    hi_lo_pairs = []
    for line in lines:
        m_hi = re.match(r"^Hi\s+([\d.]+)", line, re.I)
        m_lo = re.match(r"^Lo\s+([\d.]+)", line, re.I)
        if m_hi:
            hi_lo_pairs.append(("hi", float(m_hi.group(1))))
        elif m_lo:
            hi_lo_pairs.append(("lo", float(m_lo.group(1))))

    forecast["raw_strip"] = hi_lo_pairs

    if hi_lo_pairs:
        # First Lo = tonight's low (capture runs at 7am so first period is tonight)
        # First Hi = today's daytime high
        # But order varies: if current period is "overnight" the strip starts Lo, Hi, Lo, Hi...
        # If current period is "daytime" the strip starts Hi, Lo, Hi, Lo...
        his = [v for t, v in hi_lo_pairs if t == "hi"]
        los = [v for t, v in hi_lo_pairs if t == "lo"]
        forecast["today_high_f"]  = his[0] if his else None
        forecast["tonight_low_f"] = los[0] if los else None

    return forecast

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


if __name__ == "__main__":
    main()
