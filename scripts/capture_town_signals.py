#!/usr/bin/env python3
"""
capture_town_signals.py — early-warning scan of Town of Boone CivicPlus feeds.

The verified event registry covers the region's big recurring festivals, but the
things that actually close King Street on a random Saturday — a permitted street
festival, a parade, a road closure for a race — often surface first as a line
item on the town's own calendar or agenda center, weeks before any tourism site
lists them. This is the early-warning layer: a daily, keyword-filtered skim of
the Town of Boone CivicPlus RSS feeds, kept deliberately slim (title / date /
link / which feed), so the forecasts get a heads-up on unannounced events.

Feeds scanned (all CivicPlus RSS, verified live 2026-07-25):
  - Calendar - Town of Boone Events   (RSSFeed.aspx?ModID=58&CID=Town-of-Boone-Events-26)
  - Calendar - All calendars          (RSSFeed.aspx?ModID=58&CID=All-calendar.xml)
  - Agenda Center                      (RSSFeed.aspx?ModID=65&CID=All-agendacenter.xml)
The events feed is already the registry's canonical town feed; the all-calendars
and agenda-center feeds are the additional early-warning surfaces. Any of the
three can be empty at a given moment (they were mostly empty at build time — a
summer lull) without meaning anything is wrong; the point is to catch items the
day they appear.

Titles are matched against event-permit keywords with word-boundary matching, so
"race" doesn't fire on "embrace" and "fair" isn't matched at all (too noisy).

Fail-closed, stdlib only: a dead or malformed feed contributes nothing and the
script ALWAYS exits 0, so a CivicPlus outage can never fail the daily workflow.
Consumers gate on fetched_at.
"""

import re
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "data" / "events"
OUT_PATH = OUT_DIR / "town_signals.json"

TIMEOUT_S = 30

FEEDS = [
    {"id": "boone-events",
     "url": "https://townofboone.net/RSSFeed.aspx?ModID=58&CID=Town-of-Boone-Events-26"},
    {"id": "boone-all-calendars",
     "url": "https://townofboone.net/RSSFeed.aspx?ModID=58&CID=All-calendar.xml"},
    {"id": "boone-agenda-center",
     "url": "https://townofboone.net/RSSFeed.aspx?ModID=65&CID=All-agendacenter.xml"},
]

# Event-permit keywords — the signals worth an early warning. Matched with word
# boundaries against the lowercased title (so "race" != "embrace").
KEYWORDS = [
    "special event", "street closure", "road closure", "closure",
    "festival", "permit", "parade", "race", "5k", "block party",
]


def matched_keyword(title: str | None) -> str | None:
    """The first keyword whose whole-word/phrase form appears in the title, else
    None. Word-boundary matching avoids substring false positives."""
    if not title:
        return None
    low = title.lower()
    for kw in KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", low):
            return kw
    return None


def _localname(tag: str) -> str:
    """Strip an XML namespace: '{ns}title' -> 'title'."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_items(xml_text: str) -> list[dict]:
    """RSS <item>s -> [{title, date, link}], namespace-agnostic. Malformed XML
    yields an empty list (caller keeps going)."""
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return []
    items = []
    for item in root.iter():
        if _localname(item.tag) != "item":
            continue
        fields: dict[str, str] = {}
        for child in item:
            name = _localname(child.tag)
            if name in ("title", "link", "pubDate") and child.text:
                fields[name] = child.text.strip()
        items.append({
            "title": fields.get("title"),
            "date": fields.get("pubDate"),
            "link": fields.get("link"),
        })
    return items


def scan_feed(items: list[dict], feed_id: str) -> list[dict]:
    """Keep the keyword-matching items, tagged with the feed and matched keyword."""
    hits = []
    for it in items:
        kw = matched_keyword(it.get("title"))
        if kw:
            hits.append({
                "title": it.get("title"),
                "date": it.get("date"),
                "link": it.get("link"),
                "feed": feed_id,
                "keyword": kw,
            })
    return hits


def fetch(url: str) -> str | None:
    req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        print(f"  WARN fetch failed: {exc}", file=sys.stderr)
        return None


def main() -> int:
    now = datetime.now(NY)
    signals: list[dict] = []
    feeds_ok = 0
    for feed in FEEDS:
        text = fetch(feed["url"])
        if text is None:
            print(f"  {feed['id']}: fetch failed")
            continue
        feeds_ok += 1
        hits = scan_feed(parse_items(text), feed["id"])
        signals.extend(hits)
        print(f"  {feed['id']}: {len(hits)} keyword hits")

    out = {
        "fetched_at": now.isoformat(),
        "source": "Town of Boone CivicPlus RSS (calendar + agenda center)",
        "feeds_ok": feeds_ok,
        "feeds_total": len(FEEDS),
        "keywords": KEYWORDS,
        "signals": signals,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({len(signals)} signals; {feeds_ok}/{len(FEEDS)} feeds reachable)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
