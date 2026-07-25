#!/usr/bin/env python3
"""
capture_traffic_actuals.py — TomTom live-flow samples for the Boone corridors.

The traffic forecast's "actuals" layer (v2): current vs free-flow speed per
corridor, sampled a few times a day at the demand peaks. These samples grade
the traffic forecast the same way Open-Meteo archive days grade the weather
forecasts (camera-CV becomes the independent ground truth later — the Ecowitt
arc).

Corridor pins are PROVENANCE-VERIFIED (standing rule: no eyeballed pins).
Every coordinate below was reverse-geocoded against OSM/Nominatim on
2026-07-25 and returned the intended roadway; TomTom road-class (FRC) was
sanity-checked the same day. If a pin moves, re-verify the same way.

TomTom notes: flowSegmentData snaps the query point to the nearest covered
segment; unit=mph is requested EXPLICITLY (the API defaults to km/h — caught
in live verification 2026-07-25). Free tier 2,500 req/day; this job uses
6 pins x 4 runs = 24/day.

Output: data/traffic/actuals/{date}.json — one file per day, each run APPENDS
a sample block (read-modify-write), so all of a day's samples live together.

Fail-closed, stdlib only: always exits 0; consumers gate on sample timestamps.
Key from TOMTOM_API_KEY env (GitHub secret).
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "traffic" / "actuals"

API = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
TIMEOUT_S = 20
CALL_SPACING_S = 0.8

# slug, lat, lon, human name | provenance: Nominatim reverse-geocode 2026-07-25
CORRIDORS = [
    ("bypass-321", 36.2053, -81.6691, "US-321 Blowing Rock Rd (Boone bypass)"),
    ("king-st", 36.2166, -81.6717, "King St / US-421 downtown Boone"),
    ("nc105-split", 36.2010, -81.6870, "NC-105 at the US-321 split"),
    ("nc105-foscoe", 36.16179, -81.76566, "NC-105 South at Foscoe (ski approach)"),
    ("us321-blowing-rock", 36.1299, -81.6716, "US-321 Valley Blvd, Blowing Rock"),
    ("us421-deep-gap", 36.2360, -81.5100, "US-421 Doc & Merle Watson Hwy, Deep Gap"),
]


def congestion_ratio(current: float | None, free_flow: float | None) -> float | None:
    """current/free-flow speed — 1.0 = free flow, lower = slower. None-safe."""
    if not current or not free_flow:
        return None
    return round(current / free_flow, 3)


def merge_day(existing: dict | None, sample: dict, today_iso: str) -> dict:
    """Append this run's sample to the day file (creating it if new)."""
    day = existing if existing and existing.get("date") == today_iso else {
        "date": today_iso,
        "source": "TomTom flowSegmentData (unit=mph requested; free tier)",
        "corridors": {slug: name for slug, _, _, name in CORRIDORS},
        "samples": [],
    }
    day["samples"].append(sample)
    return day


def fetch_pin(lat: float, lon: float, key: str) -> dict | None:
    url = f"{API}?point={lat},{lon}&unit=mph&key={key}"
    try:
        req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN {lat},{lon}: {exc}", file=sys.stderr)
        return None
    return payload.get("flowSegmentData")


def main() -> int:
    key = os.environ.get("TOMTOM_API_KEY", "").strip()
    if not key:
        print("TOMTOM_API_KEY not set; skipping traffic actuals (exit 0).")
        return 0

    now = datetime.now(NY)
    readings = {}
    for slug, lat, lon, _name in CORRIDORS:
        d = fetch_pin(lat, lon, key)
        if d:
            readings[slug] = {
                "current_mph": d.get("currentSpeed"),
                "free_flow_mph": d.get("freeFlowSpeed"),
                "ratio": congestion_ratio(d.get("currentSpeed"), d.get("freeFlowSpeed")),
                "current_travel_time_s": d.get("currentTravelTime"),
                "free_flow_travel_time_s": d.get("freeFlowTravelTime"),
                "road_closure": d.get("roadClosure"),
                "confidence": d.get("confidence"),
            }
        else:
            readings[slug] = None
        time.sleep(CALL_SPACING_S)

    sample = {"at": now.isoformat(), "readings": readings}
    today_iso = now.date().isoformat()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{today_iso}.json"
    existing = None
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text())
        except ValueError:
            existing = None
    day = merge_day(existing, sample, today_iso)
    out_path.write_text(json.dumps(day, indent=2) + "\n")
    ok = sum(1 for v in readings.values() if v)
    print(f"Wrote sample {now:%H:%M} to {out_path} ({ok}/{len(CORRIDORS)} corridors)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
