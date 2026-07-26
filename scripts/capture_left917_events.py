#!/usr/bin/env python3
"""
capture_left917_events.py — left917.net's curated High Country event calendar.

left917.net is an independent local news/events site covering Watauga, Ashe,
and Avery counties — and a friendly party (they plan to use Dave's Sweater as
their weather source). Their PUBLISHED ICS at /calendar.ics (X-PUBLISHED-TTL
1h; 500+ events at first pull) carries the hyperlocal community layer no other
source has: Instagram-sourced happenings, venue shows, Ashe/Avery events.

We deliberately consume the published feed, not their internal JSON API —
partnership etiquette; the richer /api/items endpoint (cancellation flags,
counties, editorial picks) is an ask for the owner's courtesy ping. Daily pull
(their TTL is hourly; once a day is polite for our needs).

Their UIDs embed the source URL, so consumers can dedup against
data/events/campus.json (they aggregate the App State Localist calendar too).

Writes data/events/left917.json. Fail-closed, stdlib only, always exits 0.
Reuses the RFC 5545 parser from capture_events_ics.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture_events_ics import fetch_ics, parse_vevents  # noqa: E402

from zoneinfo import ZoneInfo  # noqa: E402

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_PATH = BASE_DIR / "data" / "events" / "left917.json"

ICS_URL = "https://left917.net/calendar.ics"
ATTRIBUTION = "Events: left917.net (the High Country's independent read)"


def slim(events: list[dict]) -> list[dict]:
    """Keep the fields the demand engines need; drop parser extras."""
    out = []
    for e in events:
        if not e.get("start") or not e.get("summary"):
            continue
        out.append({
            "uid": e.get("uid"),
            "start": e["start"],
            "summary": e["summary"],
            "location": e.get("location"),
        })
    return sorted(out, key=lambda x: x["start"])


def main() -> int:
    now = datetime.now(NY)
    ics = fetch_ics(ICS_URL)
    events = slim(parse_vevents(ics)) if ics else []
    out = {
        "fetched_at": now.isoformat(),
        "source": ICS_URL,
        "attribution": ATTRIBUTION,
        "fetch_ok": bool(ics),
        "count": len(events),
        "events": events,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({len(events)} events, fetch_ok={bool(ics)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
