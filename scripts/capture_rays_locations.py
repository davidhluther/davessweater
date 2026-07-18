"""Capture Ray's Weather per-town forecasts for the registry locations (M5 P0.5).

ONE unauthenticated call/day (owner-approved 2026-07-18) to the public
weather.station.blurbs endpoint returns all 66 stations; we keep only the
stations mapped in data/locations/locations.json (rays_station_id) and write
each town's raysweather_forecast.json beside the other adapters' captures.

Honesty contract: blurbs carries genuinely per-town NUMBERS (7-day high/low +
Ray's own per-day "golfballs" confidence self-rating, stored but unscored).
It has no wind, no precip type, no amounts — those live only in his regional
narrative — so fields_provided is ["high","low"] and everything else is an
honest forfeit, exactly like any source that doesn't publish a field. (A
possible later upgrade: derive precip type from his per-day icon filenames,
e.g. "02_Sct_Thundershowers_PM.png" — needs a vetted icon vocabulary first.)

Boone's Ray capture (capture_rays.py, screenshot + narrative parse) is
untouched.
"""
import json
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from locations import load_locations, location_dir
from sources import http_get_json

EST = ZoneInfo("America/New_York")
BLURBS_URL = "https://raysweather.com/api/trpc/weather.station.blurbs?input="


def blurbs_url(date_yy):
    return BLURBS_URL + urllib.parse.quote(json.dumps({"json": {"date": date_yy}}))


def _find_station_rows(obj):
    """The station array, wherever tRPC nests it."""
    if isinstance(obj, list) and obj and isinstance(obj[0], dict) and "stationId" in obj[0]:
        return obj
    if isinstance(obj, dict):
        for v in obj.values():
            r = _find_station_rows(v)
            if r is not None:
                return r
    return None


def normalize_station(station):
    """One blurbs station -> normalized daily rows (dates YY-MM-DD -> YYYY-MM-DD)."""
    rows = []
    fc = station.get("forecastContent") or {}
    for key in sorted(fc):
        day = fc[key] or {}
        date = f"20{day.get('date') or key}"
        rows.append({
            "date": date,
            "high_f": day.get("high"),
            "low_f": day.get("low"),
            "golfballs": day.get("golfballs"),
            "fields_provided": ["high", "low"],
        })
    return rows


def capture(today=None):
    now = datetime.now(EST)
    today = today or now.strftime("%Y-%m-%d")
    date_yy = today[2:]
    locs = [l for l in load_locations() if l.get("rays_station_id")]
    if not locs:
        print("no registry locations carry a rays_station_id — nothing to do")
        return {}
    raw = http_get_json(blurbs_url(date_yy), timeout=30)
    stations = _find_station_rows(raw)
    if stations is None:
        raise ValueError("blurbs response shape changed — no station array found")
    by_id = {str(s.get("stationId")): s for s in stations}
    results = {}
    for loc in locs:
        sid = str(loc["rays_station_id"])
        st = by_id.get(sid)
        if st is None:
            print(f"  MISS {loc['slug']}: station id {sid} absent from blurbs")
            results[loc["slug"]] = False
            continue
        daily = normalize_station(st)
        out = location_dir(loc["slug"]) / "predictions" / today
        out.mkdir(parents=True, exist_ok=True)
        payload = {"source": "raysweather", "label": "Ray's Weather",
                   "captured_at": now.isoformat(),
                   "location": loc["name"], "location_slug": loc["slug"],
                   "rays_station_id": sid, "rays_station_name": st.get("stationName"),
                   "daily": daily}
        (out / "raysweather_forecast.json").write_text(json.dumps(payload, indent=2))
        results[loc["slug"]] = True
        print(f"  OK   {loc['slug']}/raysweather (station {sid} '{st.get('stationName')}', {len(daily)} days)")
    return results


if __name__ == "__main__":
    capture()
