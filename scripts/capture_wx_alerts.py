#!/usr/bin/env python3
"""
capture_wx_alerts.py — NWS watches/warnings/advisories for the High Country.

Pulls active alerts from the National Weather Service API (free, keyless) and
keeps the ones touching our six counties (the 18-town registry footprint):
Watauga, Ashe, Avery, Mitchell, Wilkes, Yancey. Alerts are first-class "weather
events" for the tourism + traffic forecasts — a winter storm warning is both a
road story and a demand story (trip cancellations); a flood watch is a corridor
story on its own.

One API call per day (area=NC, filtered locally by county UGC codes), written
to data/alerts/{date}.json. Consumers read the committed JSON — the repo is
the API (house sharing rule; see capture_str_pacing.py).

Fail-closed, stdlib only: always exits 0; consumers gate on fetched_at.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "alerts"

API_URL = "https://api.weather.gov/alerts/active?area=NC"
TIMEOUT_S = 30

# County UGC codes (NCC + FIPS) for the tracked footprint. NWS alert geocodes
# carry these alongside forecast-zone codes; county codes are the stable filter.
COUNTY_UGC = {
    "NCC009": "Ashe",
    "NCC011": "Avery",
    "NCC121": "Mitchell",
    "NCC189": "Watauga",
    "NCC193": "Wilkes",
    "NCC199": "Yancey",
}


def our_counties(alert_properties: dict) -> list[str]:
    """County names from COUNTY_UGC touched by this alert (empty = not ours)."""
    ugc = (alert_properties.get("geocode") or {}).get("UGC") or []
    return sorted({COUNTY_UGC[c] for c in ugc if c in COUNTY_UGC})


def slim(alert_properties: dict, counties: list[str]) -> dict:
    """The fields the reports need — not the whole CAP payload."""
    p = alert_properties
    return {
        "event": p.get("event"),
        "severity": p.get("severity"),
        "urgency": p.get("urgency"),
        "counties": counties,
        "onset": p.get("onset"),
        "ends": p.get("ends") or p.get("expires"),
        "headline": p.get("headline"),
        "nws_id": p.get("id"),
    }


def main() -> int:
    now = datetime.now(NY)
    alerts = []
    ok = False
    try:
        req = Request(API_URL, headers={"User-Agent": "davessweater.com data pipeline"})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        for feature in payload.get("features", []):
            props = feature.get("properties") or {}
            counties = our_counties(props)
            if counties:
                alerts.append(slim(props, counties))
        ok = True
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN alerts fetch failed: {exc}", file=sys.stderr)

    out = {
        "fetched_at": now.isoformat(),
        "source": "api.weather.gov/alerts/active (NWS, keyless)",
        "fetch_ok": ok,
        "counties_tracked": sorted(COUNTY_UGC.values()),
        "alerts": alerts,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{now.date().isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {out_path} ({len(alerts)} alerts touching tracked counties; fetch_ok={ok})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
