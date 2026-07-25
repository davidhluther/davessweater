#!/usr/bin/env python3
"""
capture_river_gauges.py — USGS river gauges for the High Country watersheds.

Official USGS instantaneous-values API (free, keyless, public domain —
verified 2026-07-25). River level is a summer-recreation demand axis (rafting,
tubing, fly fishing viability on the Watauga and New) and a road-risk signal
(flood stage vs the low-water crossings) the pipeline didn't cover.

Writes data/rivers/{date}.json — one file per day, each run appends a sample
(same merge pattern as the traffic actuals). Runs with the daily capture, so
one sample/day; the API also serves history if the models ever want more.

Fail-closed, stdlib only, always exits 0.
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
OUT_DIR = BASE_DIR / "data" / "rivers"

# USGS site codes, verified live 2026-07-25.
SITES = {
    "03479000": "Watauga River near Sugar Grove",
    "03161000": "South Fork New River near Jefferson",
    "02140991": "Wilson Creek gorge (Adako)",
}
API = ("https://waterservices.usgs.gov/nwis/iv/?format=json"
       f"&sites={','.join(SITES)}&parameterCd=00060,00065&siteStatus=all")
TIMEOUT_S = 25

PARAM_KEYS = {"00060": "streamflow_cfs", "00065": "gage_height_ft"}


def slim_series(timeseries: list[dict]) -> dict:
    """{site_code: {name, streamflow_cfs, gage_height_ft, observed_at}}."""
    out: dict[str, dict] = {}
    for t in timeseries:
        src = t.get("sourceInfo") or {}
        codes = src.get("siteCode") or [{}]
        site = codes[0].get("value")
        param = ((t.get("variable") or {}).get("variableCode") or [{}])[0].get("value")
        vals = ((t.get("values") or [{}])[0]).get("value") or []
        if not site or param not in PARAM_KEYS or not vals:
            continue
        last = vals[-1]
        entry = out.setdefault(site, {"name": SITES.get(site, site)})
        try:
            entry[PARAM_KEYS[param]] = float(last.get("value"))
        except (TypeError, ValueError):
            entry[PARAM_KEYS[param]] = None
        entry["observed_at"] = last.get("dateTime")
    return out


def merge_day(existing: dict | None, sample: dict, today_iso: str) -> dict:
    day = existing if existing and existing.get("date") == today_iso else {
        "date": today_iso,
        "source": "USGS instantaneous values API (public domain)",
        "sites": SITES,
        "samples": [],
    }
    day["samples"].append(sample)
    return day


def main() -> int:
    now = datetime.now(NY)
    readings = {}
    try:
        req = Request(API, headers={"User-Agent": "davessweater.com data pipeline"})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        readings = slim_series((payload.get("value") or {}).get("timeSeries") or [])
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN river gauges fetch failed: {exc}", file=sys.stderr)

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
    out_path.write_text(json.dumps(merge_day(existing, sample, today_iso), indent=2) + "\n")
    print(f"Wrote {out_path} ({len(readings)}/{len(SITES)} sites reporting)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
