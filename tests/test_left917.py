"""Pure-function tests for scripts/capture_left917_events.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_left917_events import items_by_url, slim, source_url


def test_source_url_strips_suffix():
    assert source_url("https://x.com/e/1@left917.net") == "https://x.com/e/1"
    assert source_url(None) is None
    assert source_url("@left917.net") is None


def test_enrichment_joins_on_url():
    enrich = items_by_url([
        {"url": "https://x.com/e/1", "cancelled": True, "counties": ["Ashe"],
         "kind": "event", "source_name": "Venue", "festival_name": "",
         "ai_summary": "their prose - must not pass through"},
        {"no_url": True},
    ])
    events = [{"uid": "https://x.com/e/1@left917.net",
               "start": "2026-08-01T00:00:00+00:00", "summary": "Show"}]
    out = slim(events, enrich)
    assert out[0]["cancelled"] is True
    assert out[0]["counties"] == ["Ashe"]
    assert out[0]["festival_name"] is None
    assert "ai_summary" not in out[0]


def test_slim_keeps_needed_fields_sorted():
    events = [
        {"uid": "b@left917.net", "start": "2026-08-02T18:00:00+00:00",
         "summary": "Later show", "location": "Boone", "home": True},
        {"uid": "a@left917.net", "start": "2026-08-01T22:00:00+00:00",
         "summary": "Dance night", "location": "Parallel Brewing"},
    ]
    out = slim(events)
    assert [e["summary"] for e in out] == ["Dance night", "Later show"]
    assert "home" not in out[0]
    assert out[0]["location"] == "Parallel Brewing"


def test_slim_drops_incomplete():
    assert slim([{"uid": "x", "summary": "no start"},
                 {"uid": "y", "start": "2026-08-01T00:00:00+00:00"}]) == []
