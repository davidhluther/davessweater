"""Pure-function tests for the campus-events + wiki-attention captures (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_campus_events import slim_event
from capture_wiki_attention import merge_series


def test_slim_event_extracts_fields():
    item = {"event": {
        "id": 42, "title": "Concert at Holmes",
        "location_name": "Holmes Convocation Center", "address": "111 Rivers St",
        "event_instances": [{"event_instance": {
            "start": "2026-09-05T19:00:00-04:00", "end": "2026-09-05T22:00:00-04:00"}}],
        "filters": {"event_types": [{"name": "Concert"}, {"name": "Music"}]},
    }}
    s = slim_event(item)
    assert s["title"] == "Concert at Holmes"
    assert s["venue"] == "Holmes Convocation Center"
    assert s["start"].startswith("2026-09-05")
    assert s["types"] == ["Concert", "Music"]


def test_slim_event_rejects_incomplete():
    assert slim_event({"event": {"title": "No time"}}) is None
    assert slim_event({"event": {"event_instances": [{"event_instance": {"start": "x"}}]}}) is None
    assert slim_event({}) is None


def test_merge_series_merges_and_sorts():
    existing = {"Boone,_North_Carolina": {"2026-07-20": 400}}
    items = [
        {"timestamp": "2026072100", "views": 410},
        {"timestamp": "2026072200", "views": 425},
        {"timestamp": "bad", "views": 1},
        {"timestamp": "2026072300", "views": "not-int"},
    ]
    out = merge_series(existing, "Boone,_North_Carolina", items)
    s = out["Boone,_North_Carolina"]
    assert s == {"2026-07-20": 400, "2026-07-21": 410, "2026-07-22": 425}


def test_merge_series_overwrites_lagged_counts():
    # The API revises recent days; a re-request wins over the stale value.
    existing = {"A": {"2026-07-24": 100}}
    out = merge_series(existing, "A", [{"timestamp": "2026072400", "views": 180}])
    assert out["A"]["2026-07-24"] == 180
