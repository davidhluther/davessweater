#!/usr/bin/env python3
"""
capture_lodging_demand.py — lodging-price demand capture for the tourism forecast.

For each hotel in data/demand/roster.json (TripAdvisor hotel_key, harvested once
from public URL slugs and live-verified), pulls from the free keyless Xotelo API:

  - /api/heatmap — every upcoming day (~30 out) classified cheap/average/high,
    a per-hotel read on which dates are filling up;
  - /api/rates — the bookable OTA rates for the target weekend stays
    (next Friday, next Saturday, and the Saturday after, one night each).

Writes data/demand/{date}.json: raw per-hotel captures plus a derived summary
(per-town median min-rate per stay, and the "high-share" — the fraction of
rostered hotels calling each upcoming date high-priced). The published tourism
index is computed from OUR observed series, not reprinted from any vendor.

Honesty notes carried in the output: hotels are the minority of Boone lodging
(STR is the dominant segment); the min OTA rate is a bookability floor, not ADR.

Fail-closed, stdlib only, like the other capture scripts: per-hotel/API errors
are recorded as nulls, and the script ALWAYS exits 0 so a flaky third-party API
can never fail the daily workflow. The site side must gate on fetched_at.
"""

import json
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import median
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
ROSTER_PATH = BASE_DIR / "data" / "demand" / "roster.json"
OUT_DIR = BASE_DIR / "data" / "demand"

API_BASE = "https://data.xotelo.com/api"
CALL_SPACING_S = 1.2  # polite pacing; the API publishes no rate limits
TIMEOUT_S = 20
HEATMAP_HORIZON_DAYS = 30


def target_stays(today: date) -> list[dict]:
    """One-night weekend stays: next Friday, next Saturday, Saturday after.

    "Next" means strictly after today, so on a Friday the first stay is a week
    out — today's own night is no longer a leading indicator.
    """
    days_to_fri = (4 - today.weekday()) % 7 or 7
    days_to_sat = (5 - today.weekday()) % 7 or 7
    fri = today + timedelta(days=days_to_fri)
    sat = today + timedelta(days=days_to_sat)
    stays = [fri, sat, sat + timedelta(days=7)]
    return [
        {"chk_in": d.isoformat(), "chk_out": (d + timedelta(days=1)).isoformat()}
        for d in sorted(stays)
    ]


def min_rate(rates: list[dict] | None) -> float | None:
    """The cheapest bookable OTA rate — the price floor a visitor actually sees."""
    if not rates:
        return None
    values = [r["rate"] for r in rates if isinstance(r.get("rate"), (int, float))]
    return min(values) if values else None


def high_share(hotel_captures: list[dict]) -> dict[str, float]:
    """Fraction of hotels (with a heatmap) calling each upcoming date high-priced."""
    counts: dict[str, int] = {}
    total = 0
    for cap in hotel_captures:
        hm = cap.get("heatmap")
        if not hm:
            continue
        total += 1
        for day in hm.get("high_price_days", []):
            counts[day] = counts.get(day, 0) + 1
    if not total:
        return {}
    return {day: round(n / total, 3) for day, n in sorted(counts.items())}


def summarize(hotel_captures: list[dict], stays: list[dict]) -> dict:
    """Per-town, per-stay median min-rate + hotel counts, and the high-share map."""
    towns: dict[str, dict] = {}
    for stay in stays:
        chk_in = stay["chk_in"]
        for cap in hotel_captures:
            town = cap["town"]
            rate = (cap.get("stays") or {}).get(chk_in, {}).get("min_rate")
            bucket = towns.setdefault(town, {}).setdefault(
                chk_in, {"rates": [], "hotels_reporting": 0}
            )
            if rate is not None:
                bucket["rates"].append(rate)
                bucket["hotels_reporting"] += 1
    summary_towns = {}
    for town, by_stay in towns.items():
        summary_towns[town] = {
            chk_in: {
                "median_min_rate": round(median(b["rates"]), 2) if b["rates"] else None,
                "hotels_reporting": b["hotels_reporting"],
            }
            for chk_in, b in by_stay.items()
        }
    return {"towns": summary_towns, "high_share": high_share(hotel_captures)}


def _get(endpoint: str, params: dict) -> dict | None:
    url = f"{API_BASE}/{endpoint}?{urlencode(params)}"
    try:
        req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN {endpoint} {params.get('hotel_key')}: {exc}", file=sys.stderr)
        return None
    if payload.get("error"):
        print(f"  WARN {endpoint} {params.get('hotel_key')}: {payload['error']}", file=sys.stderr)
        return None
    return payload.get("result")


def capture_hotel(hotel: dict, stays: list[dict], horizon_chk_out: str) -> dict:
    cap = {
        "name": hotel["name"],
        "town": hotel["town"],
        "hotel_key": hotel["hotel_key"],
        "heatmap": None,
        "stays": {},
    }
    result = _get("heatmap", {"hotel_key": hotel["hotel_key"], "chk_out": horizon_chk_out})
    if result:
        cap["heatmap"] = result.get("heatmap")
    time.sleep(CALL_SPACING_S)
    for stay in stays:
        result = _get("rates", {"hotel_key": hotel["hotel_key"], **stay})
        rates = (result or {}).get("rates")
        cap["stays"][stay["chk_in"]] = {
            "chk_out": stay["chk_out"],
            "min_rate": min_rate(rates),
            "rates": rates,
        }
        time.sleep(CALL_SPACING_S)
    return cap


def main() -> int:
    if not ROSTER_PATH.exists():
        print(f"No roster at {ROSTER_PATH}; nothing to capture (exit 0).")
        return 0
    roster = json.loads(ROSTER_PATH.read_text())
    hotels = roster.get("hotels", [])
    if not hotels:
        print("Roster is empty; nothing to capture (exit 0).")
        return 0

    now = datetime.now(NY)
    today = now.date()
    stays = target_stays(today)
    horizon_chk_out = (today + timedelta(days=HEATMAP_HORIZON_DAYS)).isoformat()

    print(f"Capturing lodging demand for {len(hotels)} hotels; stays "
          f"{[s['chk_in'] for s in stays]}")
    captures = [capture_hotel(h, stays, horizon_chk_out) for h in hotels]

    ok = sum(1 for c in captures if c["heatmap"] or any(
        s["min_rate"] is not None for s in c["stays"].values()))
    out = {
        "fetched_at": now.isoformat(),
        "source": "xotelo (TripAdvisor OTA rates; free keyless API)",
        "notes": [
            "hotels are the minority of Boone-area lodging (STR is the dominant segment)",
            "min_rate is the cheapest OTA nightly rate (a bookability floor, not ADR)",
        ],
        "target_stays": stays,
        "hotels": captures,
        "summary": summarize(captures, stays),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{today.isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {out_path} ({ok}/{len(hotels)} hotels returned data)")
    if not ok:
        print("WARN: zero hotels returned data — API may be down (still exit 0).",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
