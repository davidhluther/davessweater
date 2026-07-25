#!/usr/bin/env python3
"""
capture_str_pacing.py — STR (Airbnb/Vrbo) booking-pace capture for the tourism forecast.

Pulls AirROI's market-level future-pacing metrics for the Boone and Blowing Rock
STR markets: for each future date, how many listings are booked vs. available and
at what average rates (fill_rate = the market's forward booking pace). STRs are
the DOMINANT lodging segment here, so this is the primary demand signal beside
the hotel-price capture (capture_lodging_demand.py).

Licensing (owner-approved arrangement with AirROI, 2026-07-25): this repo is
public, so everything committed stays within the redistribution terms — these
are market-level aggregated statistics, carried with the required
"Data source: AirROI" attribution in every file, and any page publishing them
must show the same attribution. Do not add per-listing data to this capture.

Cost control (owner directive 2026-07-25): pulls are gated to Mon/Wed/Fri (NY),
2 markets x 3 pulls/week on a pay-as-you-go key (~$1.30-2.60/mo at the quoted
$0.05-0.10/call) — enough resolution to watch a weekend fill without daily
spend. --force overrides the gate for testing. The key comes from the
AIRROI_API_KEY env var (GitHub Actions secret).

Sharing rule: this capture is the ONLY thing that calls AirROI. Every consumer
(tourism page, feeds, traffic forecast, any future project) reads the committed
JSON under data/demand/str/ — the repo is the API; vendor pulls never multiply
with consumers.

Fail-closed, stdlib only: no key or an API failure records nulls / skips, and
the script ALWAYS exits 0 so a third-party outage can never fail the workflow.
Consumers gate on fetched_at.
"""

import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "demand" / "str"

API_URL = "https://api.airroi.com/markets/metrics/future/pacing"
MARKETS = [
    {"country": "United States", "region": "North Carolina", "locality": "Boone"},
    {"country": "United States", "region": "North Carolina", "locality": "Blowing Rock"},
]
NUM_MONTHS = 3
CALL_SPACING_S = 1.0
TIMEOUT_S = 30
ATTRIBUTION = "Data source: AirROI"
SAMPLE_WEEKDAYS = (0, 2, 4)  # Mon/Wed/Fri — the paid-pull cadence


def is_sample_day(today: date) -> bool:
    """Paid AirROI pulls run Mon/Wed/Fri only (owner cost directive)."""
    return today.weekday() in SAMPLE_WEEKDAYS


def upcoming_weekend_dates(today: date, weekends: int = 4) -> list[str]:
    """The next N Fridays and Saturdays (the index's target nights), ISO strings."""
    out = []
    d = today + timedelta(days=1)
    while len(out) < weekends * 2:
        if d.weekday() in (4, 5):
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def weekend_pacing(rows: list[dict], weekend_dates: list[str]) -> dict[str, dict]:
    """Pull the weekend nights out of the daily pacing rows."""
    by_date = {r["date"]: r for r in rows if r.get("date")}
    out = {}
    for day in weekend_dates:
        r = by_date.get(day)
        out[day] = {
            "fill_rate": r.get("fill_rate") if r else None,
            "booked_rate_avg": r.get("booked_rate_avg") if r else None,
        }
    return out


def fetch_market(market: dict, api_key: str) -> list[dict] | None:
    body = json.dumps({"market": market, "num_months": NUM_MONTHS, "currency": "usd"})
    req = Request(
        API_URL,
        data=body.encode("utf-8"),
        headers={"x-api-key": api_key, "Content-Type": "application/json",
                 "User-Agent": "davessweater.com data pipeline"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN {market['locality']}: {exc}", file=sys.stderr)
        return None
    if payload.get("error"):
        print(f"  WARN {market['locality']}: {payload['error']}", file=sys.stderr)
        return None
    return payload.get("results")


def main() -> int:
    force = "--force" in sys.argv
    api_key = os.environ.get("AIRROI_API_KEY", "").strip()
    if not api_key:
        print("AIRROI_API_KEY not set; skipping STR pacing capture (exit 0).")
        return 0

    now = datetime.now(NY)
    today = now.date()
    if not is_sample_day(today) and not force:
        print(f"{today} is not a sample day (Mon/Wed/Fri); skipping paid pull (exit 0).")
        return 0
    weekend_dates = upcoming_weekend_dates(today)

    markets_out = {}
    for market in MARKETS:
        slug = market["locality"].lower().replace(" ", "-")
        rows = fetch_market(market, api_key)
        markets_out[slug] = {
            "market": market,
            "daily": rows,
            "weekend_pacing": weekend_pacing(rows or [], weekend_dates),
        }
        time.sleep(CALL_SPACING_S)

    ok = sum(1 for m in markets_out.values() if m["daily"])
    out = {
        "fetched_at": now.isoformat(),
        "attribution": ATTRIBUTION,
        "notes": [
            "market-level aggregated statistics only; publication surfaces must carry the attribution line",
            "fill_rate = booked / available listing-nights per the source's methodology (can exceed 1.0)",
        ],
        "weekend_dates": weekend_dates,
        "markets": markets_out,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{today.isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {out_path} ({ok}/{len(MARKETS)} markets returned data)")
    if not ok:
        print("WARN: zero markets returned data (still exit 0).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
