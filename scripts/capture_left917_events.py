#!/usr/bin/env python3
"""
capture_left917_events.py — left917.net's curated High Country event calendar.

left917.net is an independent local news/events site covering Watauga, Ashe,
and Avery counties — and a friendly party (they plan to use Dave's Sweater as
their weather source). Their PUBLISHED ICS at /calendar.ics (X-PUBLISHED-TTL
1h; 500+ events at first pull) carries the hyperlocal community layer no other
source has: Instagram-sourced happenings, venue shows, Ashe/Avery events.

Sources (owner call 2026-07-25, "whatever's best for DS"): the published ICS is
the SPINE — every event carries a real DTSTART/LOCATION — enriched by their
open /api/items JSON (matched on source URL), which adds the fields the ICS
lacks: cancelled (demand that won't happen), counties, kind, source_name.
The API's own events often lack start times, so it cannot replace the ICS.
We keep FACTUAL fields only — their editorial prose (summaries, pick notes)
stays theirs and out of this public repo. Daily pull vs their hourly TTL.

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
ITEMS_URL = "https://left917.net/api/items"
ATTRIBUTION = "Events: left917.net (the High Country's independent read)"
TIMEOUT_S = 25


def source_url(uid: str | None) -> str | None:
    """Their ICS UIDs embed the source URL: '<url>@left917.net'."""
    if not uid:
        return None
    return uid.rsplit("@left917.net", 1)[0] or None


def items_by_url(items: list[dict]) -> dict[str, dict]:
    """Factual enrichment fields from /api/items, keyed by source URL."""
    out = {}
    for it in items:
        url = it.get("url")
        if not url:
            continue
        out[url] = {
            "cancelled": bool(it.get("cancelled")),
            "counties": it.get("counties") or [],
            "kind": it.get("kind"),
            "source_name": it.get("source_name"),
            "festival_name": it.get("festival_name") or None,
        }
    return out


def slim(events: list[dict], enrich: dict[str, dict] | None = None) -> list[dict]:
    """ICS spine + API enrichment; factual fields only."""
    enrich = enrich or {}
    out = []
    for e in events:
        if not e.get("start") or not e.get("summary"):
            continue
        row = {
            "uid": e.get("uid"),
            "start": e["start"],
            "summary": e["summary"],
            "location": e.get("location"),
        }
        extra = enrich.get(source_url(e.get("uid")) or "")
        if extra:
            row.update(extra)
        out.append(row)
    return sorted(out, key=lambda x: x["start"])


def fetch_items() -> list[dict]:
    from urllib.error import URLError
    from urllib.request import Request, urlopen
    try:
        req = Request(ITEMS_URL, headers={"User-Agent": "davessweater.com data pipeline"})
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8")).get("items", [])
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN {ITEMS_URL}: {exc} (ICS-only this run)", file=sys.stderr)
        return []


def main() -> int:
    now = datetime.now(NY)
    ics = fetch_ics(ICS_URL)
    enrich = items_by_url(fetch_items())
    events = slim(parse_vevents(ics), enrich) if ics else []
    enriched = sum(1 for e in events if "cancelled" in e)
    out = {
        "fetched_at": now.isoformat(),
        "source": ICS_URL,
        "enrichment_source": ITEMS_URL,
        "attribution": ATTRIBUTION,
        "fetch_ok": bool(ics),
        "count": len(events),
        "enriched_count": enriched,
        "events": events,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({len(events)} events, fetch_ok={bool(ics)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
