#!/usr/bin/env python3
"""
capture_races.py — road/running races near Boone (RunSignup open API).

RunSignup's public race-search endpoint is open and keyless (verified live
2026-07-25). This queries races within ~40 miles of Boone (zipcode 28607) over
the next ~12 months and records the ones it finds. Races quantify event
MAGNITUDE for the traffic + tourism forecasts: a Saturday-morning 5K closes
streets and fills a parking lot; a destination trail race or half-marathon
(MerleFest-area, the Creeper Trail, App State events) draws travelers and books
rooms. The verified event registry names the big recurring festivals; this fills
in the long tail of dated, location-stamped athletic events that no hand-curated
list would keep current.

Endpoint (verified live 2026-07-25):
  https://runsignup.com/rest/races?format=json&zipcode=28607&radius=40
      &start_date=today&end_date={+12mo}&only_partner_races=F&results_per_page=250
Each race exposes name, next_date (MM/DD/YYYY), address (city/state), a public
url, and is_registration_open. Participant / registration COUNTS are NOT in the
search payload — they require a per-race details call, which would multiply API
calls against the repo-is-the-API sharing rule; is_registration_open is carried
as the available magnitude proxy instead.

Cadence: weekly. Race calendars move slowly, so one pull a week (Mondays, NY, the
same gate shape as capture_str_pacing.py) is plenty. --force overrides for
testing.

Fail-closed, stdlib only: a fetch failure writes an empty list and the script
ALWAYS exits 0, so a RunSignup outage can never fail the daily workflow.
Consumers gate on fetched_at.
"""

import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "events"
OUT_PATH = OUT_DIR / "races.json"

BOONE_ZIP = "28607"
RADIUS_MILES = 40
WINDOW_DAYS = 366          # upcoming ~12 months
RESULTS_PER_PAGE = 250
SAMPLE_WEEKDAYS = (0,)     # Mondays only — the weekly pull cadence
TIMEOUT_S = 30


def is_sample_day(today: date) -> bool:
    """Race pulls run once a week, Mondays (owner cadence directive)."""
    return today.weekday() in SAMPLE_WEEKDAYS


def api_url(end_date: date) -> str:
    return (
        "https://runsignup.com/rest/races?format=json"
        f"&zipcode={BOONE_ZIP}&radius={RADIUS_MILES}"
        f"&start_date=today&end_date={end_date.isoformat()}"
        f"&only_partner_races=F&results_per_page={RESULTS_PER_PAGE}"
    )


def parse_us_date(value: str | None) -> str | None:
    """RunSignup dates are 'MM/DD/YYYY' -> ISO 'YYYY-MM-DD' (None if unparseable)."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%m/%d/%Y").date().isoformat()
    except (ValueError, AttributeError):
        return None


def slim(race: dict) -> dict | None:
    """One RunSignup race -> the slim record the forecasts need, or None if it
    has no usable upcoming date."""
    next_iso = parse_us_date(race.get("next_date"))
    if not next_iso:
        return None
    addr = race.get("address") or {}
    return {
        "race_id": race.get("race_id"),
        "name": race.get("name"),
        "date": next_iso,
        "end_date": parse_us_date(race.get("next_end_date")),
        "city": addr.get("city"),
        "state": addr.get("state"),
        "registration_open": race.get("is_registration_open") == "T",
        "url": race.get("url"),
    }


def within_window(races: list[dict], today: date, horizon: date) -> list[dict]:
    """Keep upcoming races whose date falls in [today, horizon], sorted by date.
    (RunSignup already filters server-side; this is a defensive local guard so a
    stray past/far-future row never lands in the file.)"""
    out = []
    for r in races:
        try:
            d = date.fromisoformat(r["date"])
        except (KeyError, TypeError, ValueError):
            continue
        if today <= d <= horizon:
            out.append(r)
    return sorted(out, key=lambda r: (r["date"], r.get("name") or ""))


def fetch_races(end_date: date) -> list[dict] | None:
    req = Request(api_url(end_date),
                  headers={"User-Agent": "davessweater.com data pipeline"})
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN RunSignup fetch failed: {exc}", file=sys.stderr)
        return None
    if payload.get("error"):
        print(f"WARN RunSignup error: {payload['error']}", file=sys.stderr)
        return None
    return [w.get("race") or {} for w in payload.get("races", [])]


def main() -> int:
    force = "--force" in sys.argv
    now = datetime.now(NY)
    today = now.date()
    if not is_sample_day(today) and not force:
        print(f"{today} is not a race sample day (Mondays); skipping pull (exit 0).")
        return 0

    horizon = today + timedelta(days=WINDOW_DAYS)
    raw = fetch_races(horizon)
    ok = raw is not None
    races = within_window([s for s in (slim(r) for r in (raw or [])) if s], today, horizon)

    out = {
        "fetched_at": now.isoformat(),
        "source": "RunSignup public race-search API (runsignup.com, keyless)",
        "fetch_ok": ok,
        "query": {"zipcode": BOONE_ZIP, "radius_miles": RADIUS_MILES,
                  "window_days": WINDOW_DAYS},
        "notes": [
            "registration_open is the magnitude proxy; RunSignup's search payload does not expose participant counts",
            "date = the race's next occurrence (RunSignup next_date), normalized to ISO",
        ],
        "races": races,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({len(races)} upcoming races within {RADIUS_MILES}mi; fetch_ok={ok})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
