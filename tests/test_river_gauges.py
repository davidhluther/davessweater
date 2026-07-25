"""Pure-function tests for scripts/capture_river_gauges.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_river_gauges import merge_day, slim_series


def _ts(site, param, value, when="2026-07-25T14:00:00.000-04:00"):
    return {
        "sourceInfo": {"siteCode": [{"value": site}]},
        "variable": {"variableCode": [{"value": param}]},
        "values": [{"value": [{"value": value, "dateTime": when}]}],
    }


def test_slim_series_maps_params_to_named_fields():
    out = slim_series([
        _ts("03479000", "00060", "84.8"),
        _ts("03479000", "00065", "1.70"),
        _ts("03161000", "00060", "223"),
    ])
    assert out["03479000"]["streamflow_cfs"] == 84.8
    assert out["03479000"]["gage_height_ft"] == 1.7
    assert out["03479000"]["name"].startswith("Watauga River")
    assert out["03161000"]["streamflow_cfs"] == 223.0


def test_slim_series_survives_junk():
    out = slim_series([
        _ts("03479000", "00060", "Ice"),          # USGS ice-affected marker
        _ts("03479000", "99999", "5"),            # unknown param dropped
        {"sourceInfo": {}, "variable": {}, "values": []},
    ])
    assert out["03479000"]["streamflow_cfs"] is None
    assert "99999" not in str(out)


def test_merge_day_appends_and_rolls_over():
    day = merge_day(None, {"at": "t1", "readings": {}}, "2026-07-25")
    day = merge_day(day, {"at": "t2", "readings": {}}, "2026-07-25")
    assert len(day["samples"]) == 2
    fresh = merge_day(day, {"at": "t3", "readings": {}}, "2026-07-26")
    assert fresh["date"] == "2026-07-26" and len(fresh["samples"]) == 1
