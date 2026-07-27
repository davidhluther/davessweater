"""Capture Ray's Weather per-town forecasts for the registry locations (M5 P0.5).

ONE unauthenticated call/day (owner-approved 2026-07-18) to the public
weather.station.blurbs endpoint returns all 66 stations; we keep only the
stations mapped in data/locations/locations.json (rays_station_id) and write
each town's raysweather_forecast.json beside the other adapters' captures.

Honesty contract: blurbs carries genuinely per-town data — 7-day high/low, Ray's
own per-day "golfballs" confidence self-rating (stored but unscored), AND a
per-day sky icon (iconDay/iconNight) that IS a real per-town precipitation-type
claim (verified: North Wilkesboro drew an overcast-thunderstorms icon while the
mountain towns drew scattered-thundershowers for the same day). We map the icon's
precipitation family to a precip type (see ICON_FAMILY_TO_TYPE) and add
"precip_type" to fields_provided when it maps, so Ray earns the same precip credit
Boone's pipeline gives him — the whole 20 on a dry-icon day (implied-zero) and the
10-pt form identification on a wet-icon day. He still has NO per-town wind (the
wind text on every town page is one identical regional string) and NO numeric
precip amount, so wind stays an honest forfeit and the amount is forfeited on
wet-icon days exactly as in Boone. Raw iconDay/iconNight are stored on every row
even when the family is unrecognized (future-proofing); an unrecognized family
maps to NO type and is logged, never guessed.

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

# ── Ray's per-town sky-icon vocabulary → precip type ─────────────────────────
# Provenance: the same weather.station.blurbs endpoint. Each forecastContent day
# carries iconDay / iconNight like "Day/03_Lightning/02_Sct_Thundershowers_PM.png".
# The precipitation FAMILY is the path segment before the leaf filename
# ("01_Dry" / "02_Rain" / "03_Lightning" / "04_Snow"); the leaf only encodes
# sky-cover and AM/PM timing, so keying on the family is stable across the dozens
# of leaf variants. Enumerated 2026-07-27 by fetching the endpoint across the
# capture era (2026-07-18..27) plus winter probe dates (2025-12-20, 2026-01-15,
# 2026-02-10, 2026-03-05): 22 distinct iconDay values, every one in these four
# families. Lightning is a rain-family claim (thundershowers / thunderstorms).
# No genuinely-mixed family (sleet / wintry mix) appeared in the enumeration; if
# Ray ever introduces one it will hit the None branch below and be LOGGED for
# vetting rather than guessed at — a source-blind, honest forfeit until reviewed.
ICON_FAMILY_TO_TYPE = {
    "01_Dry": "none",
    "02_Rain": "rain",
    "03_Lightning": "rain",
    "04_Snow": "snow",
}


def icon_precip_type(icon):
    """Ray sky-icon filename -> 'none' / 'rain' / 'snow' / 'mixed', or None.

    Keys on the precipitation-family path segment (see ICON_FAMILY_TO_TYPE).
    None means the family was unrecognized: an HONEST forfeit, never a guess.
    Callers must log the raw icon loudly so a new family gets vetted, not dropped.
    """
    if not icon or not isinstance(icon, str):
        return None
    parts = icon.replace("\\", "/").rstrip("/").split("/")
    family = parts[-2] if len(parts) >= 2 else None
    return ICON_FAMILY_TO_TYPE.get(family)


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
    """One blurbs station -> normalized daily rows (dates YY-MM-DD -> YYYY-MM-DD).

    Each row carries the per-town numbers (high/low + golfballs), the raw
    iconDay/iconNight (kept even when unmapped, for future review), and — when
    the icon's family is recognized — a derived precip_type plus "precip_type"
    in fields_provided so the scoring contract credits it. Wind and numeric
    precip amounts remain honest forfeits (Ray publishes neither per town)."""
    rows = []
    fc = station.get("forecastContent") or {}
    sid, sname = station.get("stationId"), station.get("stationName")
    for key in sorted(fc):
        day = fc[key] or {}
        date = f"20{day.get('date') or key}"
        icon_day = day.get("iconDay")
        icon_night = day.get("iconNight")
        ptype = icon_precip_type(icon_day)
        fields = ["high", "low"]
        row = {
            "date": date,
            "high_f": day.get("high"),
            "low_f": day.get("low"),
            "golfballs": day.get("golfballs"),
            "icon_day": icon_day,
            "icon_night": icon_night,
        }
        if ptype is not None:
            row["precip_type"] = ptype
            fields.append("precip_type")
        elif icon_day:
            print(f"    UNMAPPED Ray icon (station {sid} '{sname}' {date}): "
                  f"{icon_day!r} — precip forfeited, add its family to "
                  f"ICON_FAMILY_TO_TYPE after vetting")
        row["fields_provided"] = fields
        rows.append(row)
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
