"""Tests for leadtime.score_lead — lead-time scoring built on the daily engine.

The load-bearing invariant: score_lead at lead 0 must reproduce the existing
daily comparison EXACTLY (same file selection, same row match, same
capture-day-low recovery, same contract + scoring). If leadtime.py ever drifts
from compare.py's pipeline, the lead-0 test fails against the committed
comparison JSON.
"""
import json
import pathlib

import compare
from leadtime import score_lead

DATA = pathlib.Path(__file__).resolve().parent.parent / "data"


def _a_date_with_openmeteo_comparison():
    for f in sorted(DATA.glob("comparisons/*.json"), reverse=True):
        d = json.load(open(f))
        if d.get("sources", {}).get("openmeteo", {}).get("score"):
            return d["date"], d
    raise AssertionError("no comparison with openmeteo score found")


def test_lead0_matches_existing_comparison():
    date, comp = _a_date_with_openmeteo_comparison()
    norm_actual = compare._normalize_actual(comp["actuals"])
    lead0 = score_lead(date, "openmeteo", 0, norm_actual)
    assert lead0 is not None
    assert lead0["score"] == comp["sources"]["openmeteo"]["score"]["score"]


def test_missing_capture_returns_none():
    date, comp = _a_date_with_openmeteo_comparison()
    norm_actual = compare._normalize_actual(comp["actuals"])
    assert score_lead("1900-01-01", "openmeteo", 3, norm_actual) is None


def test_rays_lead3_uses_daily_row_not_capture_day_strip(tmp_path, monkeypatch):
    """At lead >= 1 Ray's forecast for D is the daily[] row dated D. The strip
    (today_high_f/tonight_low_f) describes the capture day, and a missing row
    must NOT fall back to another date's row (both of which
    _best_rays_prediction does, correctly, for lead 0 only)."""
    import leadtime

    cap = tmp_path / "predictions" / "2026-07-04"
    cap.mkdir(parents=True)
    (cap / "rays_boone.json").write_text(json.dumps({
        "forecast": {"today_high_f": 92.0, "tonight_low_f": 68.0},
        "daily": [
            {"date": "2026-07-04", "high_f": 92.0, "low_f": 68.0},
            {"date": "2026-07-07", "high_f": 84.0, "low_f": 65.0,
             "precip_type": "rain"},
        ],
    }))
    monkeypatch.setattr(leadtime, "DATA_DIR", tmp_path)
    norm_actual = {"high_f": 84.0, "low_f": 65.0, "wind_mph": 5.0,
                   "rain_in": 0.2, "snow_in": 0.0}

    lead3 = leadtime.score_lead("2026-07-07", "raysweather", 3, norm_actual)
    assert lead3 is not None
    assert lead3["high_bias"] == 0.0  # daily row's 84, not the strip's 92
    assert lead3["low_bias"] == 0.0

    # 2026-07-09 has no row in the 07-04 capture -> no forecast at lead 5.
    assert leadtime.score_lead("2026-07-09", "raysweather", 5, norm_actual) is None
