"""Pure-function tests for scripts/capture_traffic_actuals.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_traffic_actuals import CORRIDORS, congestion_ratio, merge_day


def test_congestion_ratio():
    assert congestion_ratio(28, 48) == 0.583
    assert congestion_ratio(56, 56) == 1.0
    assert congestion_ratio(None, 48) is None
    assert congestion_ratio(28, None) is None
    assert congestion_ratio(28, 0) is None


def test_merge_day_creates_then_appends():
    s1 = {"at": "2026-07-25T08:00:00-04:00", "readings": {}}
    s2 = {"at": "2026-07-25T17:00:00-04:00", "readings": {}}
    day = merge_day(None, s1, "2026-07-25")
    assert day["date"] == "2026-07-25"
    assert len(day["samples"]) == 1
    day = merge_day(day, s2, "2026-07-25")
    assert len(day["samples"]) == 2
    assert day["samples"][1]["at"].endswith("17:00:00-04:00")


def test_merge_day_rolls_over_on_new_date():
    old = merge_day(None, {"at": "x", "readings": {}}, "2026-07-25")
    fresh = merge_day(old, {"at": "y", "readings": {}}, "2026-07-26")
    assert fresh["date"] == "2026-07-26"
    assert len(fresh["samples"]) == 1


def test_corridor_pins_have_names_and_plausible_coords():
    assert len(CORRIDORS) == 6
    for slug, lat, lon, name in CORRIDORS:
        assert 35.9 < lat < 36.5 and -82.0 < lon < -81.3, slug
        assert name
