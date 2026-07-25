#!/usr/bin/env python3
"""
capture_events_ics.py — App State athletics schedule capture (ICS feeds).

Fetches the verified SIDEARM calendar feeds listed in data/events/registry.json
(the provenance-verified event registry) whose format is "ics" and whose id
starts with "appstate-" — football (sport_id=3), men's basketball (5), and
women's basketball (12). Athletics are the high-value auto-updating events for
the tourism + traffic forecasts: a home football Saturday is the region's worst
traffic pattern and a lodging spike; the live feeds keep the registry's verified
date snapshot current without a spring re-verify.

The lower-value ICS feeds (festivals, downtown, town events) are intentionally
NOT pulled here — they're annual-verify entries in the registry proper, and the
blowingrock.com feed needs a browser-grade fetcher this stdlib script can't be.

Includes a small RFC 5545 VEVENT parser (line unfolding, DTSTART with/without
TZID or date-only VALUE, SUMMARY, LOCATION, UID) — no external deps. Everything
it doesn't recognize is ignored.

Writes data/events/athletics.json: {fetched_at, feeds: {football: [...], mbb:
[...], wbb: [...]}}, each event {uid, start (ISO), summary, location, home},
sorted by start. `home` is true when LOCATION contains "Boone" (case-insensitive).

Fail-closed, stdlib only, like the other capture scripts: a dead or malformed
feed records an empty list and the script ALWAYS exits 0, so a third-party
outage can never fail the daily workflow. Consumers gate on fetched_at.
"""

import json
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
REGISTRY_PATH = BASE_DIR / "data" / "events" / "registry.json"
OUT_DIR = BASE_DIR / "data" / "events"

TIMEOUT_S = 30
ID_PREFIX = "appstate-"  # only these ICS feeds are pulled here


def unfold_lines(text: str) -> list[str]:
    """RFC 5545 line unfolding: a line starting with space/tab continues the
    previous one (the CRLF + leading whitespace is removed)."""
    raw = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = []
    for line in raw:
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def _unescape(value: str) -> str:
    """Unescape RFC 5545 TEXT values (\\n \\, \\; \\\\)."""
    result = []
    i = 0
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            result.append({"n": "\n", "N": "\n"}.get(nxt, nxt))
            i += 2
        else:
            result.append(ch)
            i += 1
    return "".join(result)


def _split_prop(line: str) -> tuple[str, dict[str, str], str]:
    """Split a content line into (NAME, params, value).

    NAME;TZID=America/New_York:20260905T190000
      -> ("DTSTART", {"TZID": "America/New_York"}, "20260905T190000")
    """
    name_params, _, value = line.partition(":")
    parts = name_params.split(";")
    name = parts[0].upper()
    params: dict[str, str] = {}
    for p in parts[1:]:
        k, _, v = p.partition("=")
        params[k.upper()] = v
    return name, params, value


def parse_dtstart(params: dict[str, str], value: str) -> str | None:
    """Normalize a DTSTART value to an ISO string.

    - VALUE=DATE (8 digits)         -> "2026-09-05" (all-day)
    - trailing Z                    -> UTC-aware ISO
    - TZID param                    -> zone-aware ISO
    - otherwise (naive local time)  -> naive ISO
    Returns None if the value can't be parsed (event is dropped).
    """
    value = value.strip()
    if params.get("VALUE", "").upper() == "DATE" or (len(value) == 8 and value.isdigit()):
        try:
            return datetime.strptime(value[:8], "%Y%m%d").date().isoformat()
        except ValueError:
            return None
    is_utc = value.endswith("Z")
    core = value[:-1] if is_utc else value
    try:
        dt = datetime.strptime(core, "%Y%m%dT%H%M%S")
    except ValueError:
        return None
    if is_utc:
        return dt.replace(tzinfo=ZoneInfo("UTC")).isoformat()
    tzid = params.get("TZID")
    if tzid:
        try:
            return dt.replace(tzinfo=ZoneInfo(tzid)).isoformat()
        except (ZoneInfoNotFoundError, ValueError):
            return dt.isoformat()
    return dt.isoformat()


def is_home(location: str | None) -> bool:
    """Home game heuristic (per spec): LOCATION mentions Boone."""
    return bool(location) and "boone" in location.lower()


def sort_key(iso_start: str) -> datetime:
    """A uniform UTC-aware datetime for sorting mixed date/datetime/tz starts.

    Naive datetimes and all-day dates are assumed local (NY) — the games happen
    on the mountain — then everything is converted to UTC so the comparison
    never mixes naive and aware values.
    """
    try:
        if len(iso_start) == 10:  # date-only "YYYY-MM-DD"
            dt = datetime.fromisoformat(iso_start).replace(tzinfo=NY)
        else:
            dt = datetime.fromisoformat(iso_start)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=NY)
    except ValueError:
        return datetime.max.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(ZoneInfo("UTC"))


def parse_vevents(ics_text: str) -> list[dict]:
    """Parse VEVENTs into {uid, start, summary, location, home}, dropping any
    without a parseable DTSTART. Order follows the feed; caller sorts."""
    events: list[dict] = []
    cur: dict | None = None
    for line in unfold_lines(ics_text):
        upper = line.strip().upper()
        if upper == "BEGIN:VEVENT":
            cur = {}
            continue
        if upper == "END:VEVENT":
            if cur is not None:
                start = cur.get("_start")
                if start:
                    events.append({
                        "uid": cur.get("uid"),
                        "start": start,
                        "summary": cur.get("summary"),
                        "location": cur.get("location"),
                        "home": is_home(cur.get("location")),
                    })
            cur = None
            continue
        if cur is None:
            continue
        name, params, value = _split_prop(line)
        if name == "UID":
            cur["uid"] = value.strip()
        elif name == "SUMMARY":
            cur["summary"] = _unescape(value)
        elif name == "LOCATION":
            cur["location"] = _unescape(value)
        elif name == "DTSTART":
            cur["_start"] = parse_dtstart(params, value)
    return events


def athletics_feeds(registry: dict) -> list[dict]:
    """The registry ICS feeds this script owns (id starts with 'appstate-')."""
    return [
        f for f in registry.get("feeds", [])
        if f.get("format") == "ics" and str(f.get("id", "")).startswith(ID_PREFIX)
    ]


def fetch_ics(url: str) -> str | None:
    req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN fetch failed: {exc}", file=sys.stderr)
        return None


def main() -> int:
    now = datetime.now(NY)
    try:
        registry = json.loads(REGISTRY_PATH.read_text())
    except (OSError, ValueError) as exc:
        print(f"WARN could not read registry ({exc}); writing empty feeds (exit 0).",
              file=sys.stderr)
        registry = {}

    feeds_out: dict[str, list[dict]] = {}
    for feed in athletics_feeds(registry):
        key = feed["id"][len(ID_PREFIX):]  # appstate-football -> football
        text = fetch_ics(feed["url"])
        events: list[dict] = []
        if text:
            try:
                events = sorted(parse_vevents(text), key=lambda e: sort_key(e["start"]))
            except Exception as exc:  # never let a malformed feed break the run
                print(f"  WARN parse failed for {feed['id']}: {exc}", file=sys.stderr)
                events = []
        feeds_out[key] = events
        print(f"  {feed['id']}: {len(events)} events")

    out = {
        "fetched_at": now.isoformat(),
        "source": "App State SIDEARM ICS calendars (per data/events/registry.json feeds)",
        "feeds": feeds_out,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "athletics.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    total = sum(len(v) for v in feeds_out.values())
    print(f"Wrote {out_path} ({total} events across {len(feeds_out)} feeds)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
