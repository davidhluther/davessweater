"""Pure-function tests for scripts/capture_left917_events.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_left917_events import slim


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
