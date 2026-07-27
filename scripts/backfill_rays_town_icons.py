#!/usr/bin/env python3
"""One-shot: backfill Ray's per-town sky-icon precip type into existing captures.

The town Ray capture (capture_rays_locations.py) used to drop the per-day sky
icon, so Ray forfeited the entire 20-pt precip field in every town, every day —
under-crediting him (he earns the implied-zero 20 on dry-icon days and the 10-pt
form identification on wet-icon days under the same rule Boone's pipeline gives
him). This script repairs the history in place.

For each capture-era date it re-fetches raysweather.com's weather.station.blurbs
archive — which serves the forecast AS ISSUED that day (Ray's own Archives
feature) — and patches each town's raysweather_forecast.json daily rows with the
raw iconDay/iconNight and the derived precip_type (extending fields_provided with
"precip_type" when the icon maps). It also syncs the stored raysweather prediction
inside every already-scored comparison file so scripts/rescore_history.py re-scores
Ray with fair precip credit.

Idempotent: re-running recomputes the same fields from the same archive.

Gap-fill: if a town has a predictions/{date} directory (a genuine captured
town-day) but no raysweather_forecast.json inside it, and the fetch returns that
town's station, the file is created from the archived as-issued forecast. Whole
town-days that were never captured at all are NOT invented (no existing capture ->
no fabricated day), which keeps the boards' before/after honest.

Usage:
    python3 scripts/backfill_rays_town_icons.py [--start YYYY-MM-DD] [--end YYYY-MM-DD]
    python3 scripts/rescore_history.py     # then re-score + rebuild every board
"""
import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

import capture_rays_locations as crl
from locations import load_locations, location_dir
from sources import http_get_json

EST = ZoneInfo("America/New_York")
DEFAULT_START = date(2026, 7, 18)  # first town capture (blowing-rock / deep-gap)
SLEEP_S = 1.0  # be polite: one request per date


def _daterange(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _fetch_stations(date_yy):
    """{stationId: station} for one blurbs date, or None on any failure."""
    raw = http_get_json(crl.blurbs_url(date_yy), timeout=30)
    stations = crl._find_station_rows(raw)
    if stations is None:
        return None
    return {str(s.get("stationId")): s for s in stations}


def _merge_icons(existing_row, fetched_row):
    """Overlay the icon-derived fields from a freshly-normalized row onto an
    existing stored daily row, preserving its high/low/golfballs. Idempotent:
    fields_provided is rebuilt to ['high','low'] (+ 'precip_type' when mapped),
    so re-running never accumulates duplicates or stale precip flags."""
    existing_row["icon_day"] = fetched_row.get("icon_day")
    existing_row["icon_night"] = fetched_row.get("icon_night")
    fields = ["high", "low"]
    ptype = fetched_row.get("precip_type")
    if ptype is not None:
        existing_row["precip_type"] = ptype
        fields.append("precip_type")
    else:
        existing_row.pop("precip_type", None)
    existing_row["fields_provided"] = fields
    return existing_row


def _patch_prediction_file(fpath, fetched_by_date):
    """Patch an existing raysweather_forecast.json in place. Returns True if
    the file changed."""
    data = json.loads(fpath.read_text())
    before = json.dumps(data.get("daily"), sort_keys=True)
    for row in data.get("daily", []):
        fr = fetched_by_date.get(row.get("date"))
        if fr is not None:
            _merge_icons(row, fr)
    after = json.dumps(data.get("daily"), sort_keys=True)
    if before != after:
        fpath.write_text(json.dumps(data, indent=2))
        return True
    return False


def _create_prediction_file(fpath, loc, station, normalized, now_iso):
    """Create a Ray town file for a genuine gap day (predictions dir present,
    Ray file absent) from the archived as-issued forecast."""
    payload = {
        "source": "raysweather", "label": "Ray's Weather",
        "captured_at": now_iso, "backfilled": True,
        "location": loc["name"], "location_slug": loc["slug"],
        "rays_station_id": str(loc["rays_station_id"]),
        "rays_station_name": station.get("stationName"),
        "daily": normalized,
    }
    fpath.parent.mkdir(parents=True, exist_ok=True)
    fpath.write_text(json.dumps(payload, indent=2))


def _patch_comparison_file(fpath, date_str, fetched_by_date):
    """Sync the stored raysweather prediction row inside a comparison so
    rescore_history.py re-scores it. Returns True if it changed."""
    data = json.loads(fpath.read_text())
    src = data.get("sources", {}).get("raysweather")
    if not src or not isinstance(src.get("prediction"), dict):
        return False
    pred = src["prediction"]
    fr = fetched_by_date.get(pred.get("date") or date_str)
    if fr is None:
        return False
    before = json.dumps(pred, sort_keys=True)
    _merge_icons(pred, fr)
    if json.dumps(pred, sort_keys=True) != before:
        fpath.write_text(json.dumps(data, indent=2))
        return True
    return False


def backfill(start=DEFAULT_START, end=None):
    end = end or datetime.now(EST).date()
    ray_locs = [l for l in load_locations() if l.get("rays_station_id")]
    now_iso = datetime.now(EST).isoformat()
    stats = {"pred_patched": 0, "pred_created": 0, "comp_patched": 0,
             "station_miss": 0, "fetch_fail": 0, "unmapped": 0}
    for d in _daterange(start, end):
        date_str = d.strftime("%Y-%m-%d")
        date_yy = date_str[2:]
        by_id = _fetch_stations(date_yy)
        if by_id is None:
            print(f"{date_str}: FETCH FAILED (skipped)")
            stats["fetch_fail"] += 1
            time.sleep(SLEEP_S)
            continue
        for loc in ray_locs:
            sid = str(loc["rays_station_id"])
            station = by_id.get(sid)
            if station is None:
                continue  # station simply absent that day — nothing to patch
            normalized = crl.normalize_station(station)
            stats["unmapped"] += sum(
                1 for r in normalized
                if r.get("icon_day") and "precip_type" not in r)
            fetched_by_date = {r["date"]: r for r in normalized}
            loc_dir = location_dir(loc["slug"])
            pred_dir = loc_dir / "predictions" / date_str
            pred_file = pred_dir / "raysweather_forecast.json"
            if pred_file.exists():
                if _patch_prediction_file(pred_file, fetched_by_date):
                    stats["pred_patched"] += 1
            elif pred_dir.exists():
                # genuine gap: the town-day exists but Ray's file is missing
                _create_prediction_file(pred_file, loc, station, normalized, now_iso)
                stats["pred_created"] += 1
                print(f"  GAP-FILL {loc['slug']}/{date_str}: created from archive")
            # else: no town-day at all -> do not invent one
            comp_file = loc_dir / "comparisons" / f"{date_str}.json"
            if comp_file.exists():
                if _patch_comparison_file(comp_file, date_str, fetched_by_date):
                    stats["comp_patched"] += 1
        print(f"{date_str}: patched preds so far={stats['pred_patched']} "
              f"comps={stats['comp_patched']}")
        time.sleep(SLEEP_S)
    print("\n=== backfill summary ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")
    print("Next: python3 scripts/rescore_history.py")
    return stats


def main():
    ap = argparse.ArgumentParser(description="Backfill Ray town sky-icon precip type")
    ap.add_argument("--start", help="YYYY-MM-DD (default 2026-07-18)")
    ap.add_argument("--end", help="YYYY-MM-DD (default today EST)")
    args = ap.parse_args()
    start = datetime.strptime(args.start, "%Y-%m-%d").date() if args.start else DEFAULT_START
    end = datetime.strptime(args.end, "%Y-%m-%d").date() if args.end else None
    backfill(start, end)


if __name__ == "__main__":
    main()
