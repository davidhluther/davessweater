"""Pure-function tests for scripts/capture_wx_alerts.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_wx_alerts import our_counties, slim


def test_our_counties_filters_and_names():
    props = {"geocode": {"UGC": ["NCC189", "NCC009", "NCC067", "NCZ018"]}}
    assert our_counties(props) == ["Ashe", "Watauga"]


def test_our_counties_empty_cases():
    assert our_counties({}) == []
    assert our_counties({"geocode": {"UGC": ["NCC067"]}}) == []
    assert our_counties({"geocode": {}}) == []


def test_slim_keeps_report_fields_and_falls_back_to_expires():
    props = {
        "event": "Winter Storm Warning",
        "severity": "Moderate",
        "urgency": "Expected",
        "onset": "2026-12-01T18:00:00-05:00",
        "ends": None,
        "expires": "2026-12-02T06:00:00-05:00",
        "headline": "Winter Storm Warning until 6 AM",
        "id": "urn:oid:x",
        "description": "huge CAP text that should not be kept",
    }
    s = slim(props, ["Watauga"])
    assert s["event"] == "Winter Storm Warning"
    assert s["counties"] == ["Watauga"]
    assert s["ends"] == "2026-12-02T06:00:00-05:00"
    assert "description" not in s
