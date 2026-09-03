#!/usr/bin/env python3
"""
capture_roads.py — NCDOT DriveNC road conditions + incidents + NPS Blue Ridge
Parkway alerts for the High Country -> data/road_conditions/{date}.json.

Serves two jobs from one committed file (house sharing rule — the repo is the
API): the live "current conditions" display on /roads, and the scoring "actual"
(worst_actual_level) that compare_roads.py grades the forecast against.

Sources (all free; DriveNC + NPS keyed):
  - DriveNC v2 `roadconditions` — per-Division/County winter road-surface report
    (Watauga, Avery, Ashe are all NCDOT Division 11; each has its own County row).
    Fields: "Overall for Public Display", Interstates, "US/NC Routes",
    "Secondary Roads", County/AreaName, LocationDescription, LastUpdated.
    Off-season every field reads "No Report"; winter fills them in.
  - DriveNC v2 `event` — incidents/closures/road work statewide, filtered to our
    counties. Fields: RoadwayName, Description, EventType, EventSubType,
    IsFullClosure, Severity, County.
  - NPS `alerts?parkCode=blri` — Blue Ridge Parkway closures/alerts (the BRP
    closes in winter). Fields: data[].{title, category, description, url}.

Keys come from env (DRIVENC_API_KEY / NPS_API_KEY), mirroring the GitHub secrets;
never hardcoded. Throttle: DriveNC allows 10 calls/60s — we make two, spaced.

Fail-closed, stdlib only: always exits 0; a missing key or dead API writes a
valid empty-but-dated file rather than crashing the daily workflow. Consumers
gate on fetched_at.
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
OUT_DIR = BASE_DIR / "data" / "road_conditions"

COUNTIES = {"WATAUGA", "AVERY", "ASHE"}  # the High Country footprint (NCDOT Div. 11)
UA = "davessweater.com data pipeline"
TIMEOUT_S = 30

DRIVENC_API_KEY = os.environ.get("DRIVENC_API_KEY", "")
NPS_API_KEY = os.environ.get("NPS_API_KEY", "")

DRIVENC_BASE = "https://www.drivenc.gov/api/v2/get"
NPS_ALERTS = "https://developer.nps.gov/api/v1/alerts?parkCode=blri"

# The four road-surface fields DriveNC exposes per county row.
_COND_FIELDS = ("Overall for Public Display", "Interstates", "US/NC Routes", "Secondary Roads")


def _get(url: str):
    """Fetch + parse JSON. Returns (data, ok). Never raises."""
    try:
        req = Request(url, headers={"User-Agent": UA})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8")), True
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN fetch failed ({url.split('?')[0]}): {exc}", file=sys.stderr)
        return None, False


def _as_list(payload) -> list:
    """DriveNC v2 returns a bare JSON array; tolerate a {data:[...]} wrapper too."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("data") or []
    return []


def norm_event(e: dict) -> dict:
    return {
        "road": e.get("RoadwayName"),
        "description": e.get("Description"),
        "type": e.get("EventType"),
        "subtype": e.get("EventSubType"),
        "closed": bool(e.get("IsFullClosure")),
        "severity": e.get("Severity"),
        "county": e.get("County"),
    }


def norm_condition(r: dict) -> dict:
    return {
        "county": r.get("County") or r.get("AreaName"),
        "division": r.get("LocationDescription"),
        "overall": r.get("Overall for Public Display"),
        "interstates": r.get("Interstates"),
        "us_nc_routes": r.get("US/NC Routes"),
        "secondary": r.get("Secondary Roads"),
    }


def norm_alert(a: dict) -> dict:
    return {
        "title": a.get("title"),
        "category": a.get("category"),
        "description": a.get("description"),
        "url": a.get("url"),
    }


def worst_level(conditions: list[dict]) -> str:
    """Map DriveNC road-surface condition text -> our LEVELS (worst wins).

    Keyword match on the concatenated surface fields across our county rows.
    'No Report'/'Clear'/'Dry' all fall through to Clear (the off-season default).
    """
    text = " ".join(
        str(c.get(k, "")).lower()
        for c in conditions
        for k in ("overall", "interstates", "us_nc_routes", "secondary")
    )
    if any(w in text for w in ("closed", "impassable", "severe")):
        return "Hazardous"
    if "ice" in text or "icy" in text or "freez" in text:
        return "Icy"
    if "snow" in text or "slush" in text:
        return "Slushy"
    if "wet" in text:
        return "Wet"
    return "Clear"


def main() -> int:
    now = datetime.now(NY)
    incidents: list[dict] = []
    conditions: list[dict] = []
    alerts: list[dict] = []
    fetch_ok = False
    nps_fetch_ok = False

    if DRIVENC_API_KEY:
        conds, ok_c = _get(f"{DRIVENC_BASE}/roadconditions?key={DRIVENC_API_KEY}")
        conditions = [
            norm_condition(r) for r in _as_list(conds)
            if str(r.get("County") or r.get("AreaName") or "").upper() in COUNTIES
        ]
        time.sleep(6)  # respect DriveNC's 10-calls/60s throttle
        evs, ok_e = _get(f"{DRIVENC_BASE}/event?key={DRIVENC_API_KEY}")
        incidents = [
            norm_event(e) for e in _as_list(evs)
            if str(e.get("County", "")).upper() in COUNTIES
        ]
        fetch_ok = ok_c and ok_e
    else:
        print("NOTE: DRIVENC_API_KEY unset — writing empty DriveNC sections", file=sys.stderr)

    if NPS_API_KEY:
        nps, nps_fetch_ok = _get(f"{NPS_ALERTS}&api_key={NPS_API_KEY}")
        alerts = [norm_alert(a) for a in _as_list(nps)]
    else:
        print("NOTE: NPS_API_KEY unset — writing empty Parkway section", file=sys.stderr)

    out = {
        "fetched_at": now.isoformat(),
        "date": now.date().isoformat(),
        "source": "DriveNC v2 roadconditions + event (NCDOT Div. 11) + NPS blri alerts",
        "fetch_ok": fetch_ok,
        "nps_fetch_ok": nps_fetch_ok,
        "counties_tracked": sorted(COUNTIES),
        "incidents": incidents,
        "road_conditions": conditions,
        "parkway_alerts": alerts,
        "worst_actual_level": worst_level(conditions),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{now.date().isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(
        f"Wrote {out_path} ({len(incidents)} incidents, {len(conditions)} county rows, "
        f"{len(alerts)} Parkway alerts, worst={out['worst_actual_level']}, "
        f"fetch_ok={fetch_ok}, nps_fetch_ok={nps_fetch_ok})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
