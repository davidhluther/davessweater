#!/usr/bin/env python3
"""
capture_fireworks_forecast.py — the "Fireworks Forecast" capture for /fireworks.

For each show venue, pulls Open-Meteo HOURLY fields that decide whether a
mountain fireworks show is actually visible — low/mid/high cloud cover, precip
probability + amount, temp + dew point (the valley-fog spread signal), wind
speed + direction (smoke drift), and visibility — and stores the local evening
hours (5 PM–11 PM) for each night from today through July 4.

Writes data/fireworks_forecast.json (one file, overwritten daily; the site
fails closed on staleness via fetched_at). Stdlib only, like the other
capture scripts.

Self-gating: outside the June 25 – July 5 window (America/New_York) it exits 0
without writing, so daily_capture.yml can call it unconditionally year-round.
--force overrides the gate for testing.

Venue ids + coordinates mirror src/lib/fireworksVenues.ts — keep in sync.
"""

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_PATH = BASE_DIR / "data" / "fireworks_forecast.json"

# Keep in sync with src/lib/fireworksVenues.ts (ids must match).
VENUES = {
    "boone": (36.2049, -81.6507),          # Clawson-Burnley Park (Greenway)
    "tweetsie": (36.1708, -81.6485),       # Tweetsie Railroad, US-321
    "beech-mountain": (36.1961, -81.8778), # Beech Mountain Resort
    "west-jefferson": (36.3892, -81.4813), # Ashe County ridgeline show
}

HOURLY_FIELDS = [
    "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
    "precipitation_probability", "precipitation",
    "temperature_2m", "dew_point_2m",
    "wind_speed_10m", "wind_direction_10m",
    "visibility",
]

# Local evening hours to keep per night (5 PM through 11 PM).
EVENING_HOURS = range(17, 24)

# Season gate, month/day so it re-arms every year with zero maintenance.
SEASON_START = (6, 25)
SEASON_END = (7, 5)


def in_season(today: date) -> bool:
    return SEASON_START <= (today.month, today.day) <= SEASON_END


def fetch_venue(lat: float, lon: float, start: date, end: date) -> dict:
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&hourly={','.join(HOURLY_FIELDS)}"
        "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
        "&timezone=America%2FNew_York"
        f"&start_date={start.isoformat()}&end_date={end.isoformat()}"
    )
    last_err = None
    for _ in range(2):
        try:
            with urlopen(url, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (URLError, TimeoutError, json.JSONDecodeError) as e:  # retry once
            last_err = e
    raise RuntimeError(f"Open-Meteo fetch failed: {last_err}")


def evening_hours_by_night(payload: dict) -> dict:
    """Group the hourly arrays into {date: [hour dicts]} keeping 5–11 PM local."""
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    nights: dict[str, list[dict]] = {}
    for i, t in enumerate(times):
        # t is local ISO like "2026-07-04T20:00" (timezone param above).
        day, clock = t.split("T")
        hour = int(clock[:2])
        if hour not in EVENING_HOURS:
            continue

        def val(field):
            arr = hourly.get(field) or []
            return arr[i] if i < len(arr) else None

        nights.setdefault(day, []).append({
            "time": t,
            "cloud_low": val("cloud_cover_low"),
            "cloud_mid": val("cloud_cover_mid"),
            "cloud_high": val("cloud_cover_high"),
            "precip_prob": val("precipitation_probability"),
            "precip_in": val("precipitation"),
            "temp_f": val("temperature_2m"),
            "dewpoint_f": val("dew_point_2m"),
            "wind_mph": val("wind_speed_10m"),
            "wind_dir_deg": val("wind_direction_10m"),
            "visibility_m": val("visibility"),
        })
    return nights


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="fetch even outside the season window")
    args = parser.parse_args()

    now = datetime.now(NY)
    today = now.date()
    if not args.force and not in_season(today):
        print(f"Out of season ({today}); skipping fireworks forecast capture.")
        return 0

    end = date(today.year, 7, 4)
    start = min(today, end)
    if today > end and not args.force:
        print(f"Shows are done for {today.year}; skipping.")
        return 0

    out: dict = {
        "schema_version": 1,
        "fetched_at": now.isoformat(timespec="seconds"),
        "provider": "open-meteo",
        "venues": {},
    }
    failures = []
    for venue_id, (lat, lon) in VENUES.items():
        try:
            payload = fetch_venue(lat, lon, start, end)
            out["venues"][venue_id] = {
                "lat": lat, "lon": lon,
                "nights": evening_hours_by_night(payload),
            }
            print(f"  {venue_id}: ok ({len(out['venues'][venue_id]['nights'])} nights)")
        except RuntimeError as e:
            failures.append(venue_id)
            print(f"  {venue_id}: FAILED — {e}", file=sys.stderr)

    if not out["venues"]:
        print("All venues failed; not writing.", file=sys.stderr)
        return 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=1) + "\n")
    print(f"Wrote {OUT_PATH} ({len(out['venues'])} venues"
          + (f", {len(failures)} failed: {', '.join(failures)}" if failures else "") + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
