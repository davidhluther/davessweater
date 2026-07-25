#!/usr/bin/env python3
"""
capture_campus_events.py — App State's campus-wide event calendar (Localist).

calendar.appstate.edu runs Localist, whose JSON API is public and keyless
(verified 2026-07-25). One pull covers the whole campus footprint the
athletics ICS misses: Holmes Convocation Center concerts, Appalachian Theatre
shows, commencement events, conferences — the events that fill lodging and
King Street without appearing on any sports schedule.

Writes data/events/campus.json: the next ~90 days of events, slimmed to the
fields the demand engines need. Fail-closed, stdlib only, always exits 0.
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_PATH = BASE_DIR / "data" / "events" / "campus.json"

API = "https://calendar.appstate.edu/api/2/events"
DAYS_AHEAD = 90
PER_PAGE = 100
MAX_PAGES = 10
TIMEOUT_S = 25
CALL_SPACING_S = 1.0


def slim_event(item: dict) -> dict | None:
    """Localist wraps each event as {'event': {...}}; keep what the engines need."""
    ev = item.get("event") or {}
    inst = (ev.get("event_instances") or [{}])[0].get("event_instance") or {}
    start = inst.get("start")
    if not ev.get("title") or not start:
        return None
    types = [t.get("name") for t in (ev.get("filters") or {}).get("event_types", []) if t.get("name")]
    return {
        "id": ev.get("id"),
        "title": ev.get("title"),
        "start": start,
        "end": inst.get("end"),
        "venue": ev.get("location_name") or ev.get("location"),
        "address": ev.get("address"),
        "types": types,
    }


def main() -> int:
    now = datetime.now(NY)
    events, ok = [], False
    page = 1
    try:
        while page <= MAX_PAGES:
            url = f"{API}?days={DAYS_AHEAD}&pp={PER_PAGE}&page={page}"
            req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
            with urlopen(req, timeout=TIMEOUT_S) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            for item in payload.get("events", []):
                s = slim_event(item)
                if s:
                    events.append(s)
            total = (payload.get("page") or {}).get("total", 1)
            if page >= total:
                break
            page += 1
            time.sleep(CALL_SPACING_S)
        ok = True
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"WARN campus events fetch failed on page {page}: {exc}", file=sys.stderr)

    out = {
        "fetched_at": now.isoformat(),
        "source": "calendar.appstate.edu Localist API (public, keyless)",
        "days_ahead": DAYS_AHEAD,
        "fetch_ok": ok,
        "count": len(events),
        "events": sorted(events, key=lambda e: e["start"]),
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({len(events)} events, fetch_ok={ok})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
