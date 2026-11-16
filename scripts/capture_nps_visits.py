#!/usr/bin/env python3
"""
capture_nps_visits.py — Blue Ridge Parkway monthly visitation (NPS Stats API).

The NPS Stats system (irma.nps.gov) exposes a public REST service for monthly
park visitation. This pulls Blue Ridge Parkway (unit code BLRI) monthly
recreation-visit counts — the single biggest calibration series we have for High
Country demand: BLRI is the most-visited unit in the whole National Park System,
its overlooks and access roads thread every town in the registry, and its
monthly rhythm (leaf-season October spike, winter trough) is exactly the demand
curve the tourism + traffic forecasts are trying to anticipate. Monthly actuals
let us check the models against a real, official visitation number.

Endpoint (verified live 2026-07-25):
  https://irmaservices.nps.gov/v3/rest/stats/visitation
      ?unitCodes=BLRI&startMonth=1&startYear=1979&endMonth=12&endYear={year}
Returns a JSON array of {Month, Year, RecreationVisitors, NonRecreationVisitors,
UnitCode, UnitName} — but only when the request carries Accept: application/json
(the service defaults to XML otherwise). History reaches back to 1979.

Cadence: monthly. NPS publishes the prior month partway into the next month, so
one pull early each month is plenty. The slot is the 3rd, but the gate is
catch-up, not a single day: the pull is DUE on any day on or after this month's
3rd until a successful pull lands (fetched_at on or after the 3rd). A skipped
daily run or a failed fetch on the 3rd retries the next day instead of losing
the month (Argon D9, 2026-11-16). --force overrides for testing.

Idempotent rolling merge: each run re-fetches the full history and rewrites
data/calibration/nps_blri_visits.json keyed by year-month, so NPS's routine
back-revisions of older months are picked up and the file converges to the
service's current truth no matter when it last ran.

Fail-closed and loud, stdlib only: a fetch failure leaves the existing file
untouched (so the pull stays due and retries tomorrow) and exits 1. The daily
workflow runs this step with continue-on-error so the other captures still
commit, then a final step turns the run red. Consumers gate on fetched_at.
"""

import json
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "calibration"
OUT_PATH = OUT_DIR / "nps_blri_visits.json"

UNIT_CODE = "BLRI"
UNIT_NAME = "Blue Ridge Parkway"
HISTORY_START_YEAR = 1979  # earliest year the service returns for BLRI
CAPTURE_DAY = 3            # day-of-month the monthly pull runs (NY)
TIMEOUT_S = 40


def api_url(end_year: int) -> str:
    return (
        "https://irmaservices.nps.gov/v3/rest/stats/visitation"
        f"?unitCodes={UNIT_CODE}"
        f"&startMonth=1&startYear={HISTORY_START_YEAR}"
        f"&endMonth=12&endYear={end_year}"
    )


def is_capture_day(today: date) -> bool:
    """The monthly slot is the 3rd (owner cadence directive)."""
    return today.day == CAPTURE_DAY


def last_success_date(path: Path = None) -> date | None:
    """Date (NY) of the last successful pull, read from the file's fetched_at.
    The file is only ever written on success, so its fetched_at is the last
    success. None when the file is missing or unreadable."""
    path = path or OUT_PATH
    try:
        stamp = json.loads(path.read_text()).get("fetched_at")
        return datetime.fromisoformat(stamp).astimezone(NY).date()
    except (OSError, ValueError, TypeError, AttributeError):
        return None


def is_due(today: date, last_success: date | None) -> bool:
    """Catch-up gate: due on/after this month's slot (the 3rd) until a pull
    succeeds on/after that slot. Before the 3rd nothing new is due this month;
    a missed prior month was already caught up by its own later days."""
    slot = today.replace(day=CAPTURE_DAY)
    if today < slot:
        return False
    return last_success is None or last_success < slot


def month_key(year: int, month: int) -> str:
    """Stable sort/merge key, e.g. (2026, 6) -> '2026-06'."""
    return f"{year:04d}-{month:02d}"


def slim(record: dict) -> dict | None:
    """One API record -> {month_key, year, month, recreation_visitors,
    nonrecreation_visitors}, or None if it can't be read as a month row."""
    try:
        year = int(record["Year"])
        month = int(record["Month"])
    except (KeyError, TypeError, ValueError):
        return None
    if not 1 <= month <= 12:
        return None

    def as_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    return {
        "month_key": month_key(year, month),
        "year": year,
        "month": month,
        "recreation_visitors": as_int(record.get("RecreationVisitors")),
        "nonrecreation_visitors": as_int(record.get("NonRecreationVisitors")),
    }


def merge_months(existing: list[dict], fetched: list[dict]) -> list[dict]:
    """Idempotent rolling merge: fetched rows overwrite existing rows with the
    same month_key (so NPS revisions win); everything else is preserved.
    Returns the union sorted chronologically by month_key."""
    by_key = {m["month_key"]: m for m in existing if m.get("month_key")}
    for m in fetched:
        if m.get("month_key"):
            by_key[m["month_key"]] = m
    return [by_key[k] for k in sorted(by_key)]


def fetch_history(end_year: int) -> list[dict] | None:
    req = Request(
        api_url(end_year),
        headers={
            "User-Agent": "davessweater.com data pipeline",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8-sig"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN NPS visitation fetch failed: {exc}", file=sys.stderr)
        return None
    if not isinstance(payload, list):
        print(f"WARN NPS visitation returned non-list payload: {type(payload)}",
              file=sys.stderr)
        return None
    return [s for s in (slim(r) for r in payload) if s]


def load_existing() -> list[dict]:
    if not OUT_PATH.exists():
        return []
    try:
        return json.loads(OUT_PATH.read_text()).get("months", [])
    except (OSError, ValueError):
        return []


def main() -> int:
    force = "--force" in sys.argv
    now = datetime.now(NY)
    today = now.date()
    last = last_success_date()
    if not force and not is_due(today, last):
        print(f"NPS pull not due on {today} (last success {last}; monthly slot "
              f"is the {CAPTURE_DAY}rd); skipping (exit 0).")
        return 0
    if not is_capture_day(today) and not force:
        print(f"Catch-up NPS pull on {today}: last success {last} predates this "
              f"month's slot.")

    existing = load_existing()
    fetched = fetch_history(today.year)
    if fetched is None:
        print("ERROR: NPS fetch failed; kept the existing file unchanged. The pull "
              "stays due and retries on the next daily run (exit 1).", file=sys.stderr)
        return 1

    months = merge_months(existing, fetched)
    out = {
        "fetched_at": now.isoformat(),
        "source": "NPS Stats visitation API (irmaservices.nps.gov, public, keyless)",
        "unit_code": UNIT_CODE,
        "unit_name": UNIT_NAME,
        "notes": [
            "recreation_visitors = the National Park Service's monthly recreation-visit count for the Blue Ridge Parkway",
            "history reaches back to 1979; each run re-fetches the full range so NPS month revisions are picked up",
        ],
        "months": months,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    latest = months[-1] if months else None
    tail = (f"latest {latest['month_key']}={latest['recreation_visitors']:,} rec visits"
            if latest and latest.get("recreation_visitors") is not None else "no rows")
    print(f"Wrote {OUT_PATH} ({len(months)} months; {tail})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
