"""Tests for leadtime.score_lead — lead-time scoring built on the daily engine.

The load-bearing invariant: score_lead at lead 0 must reproduce the existing
daily comparison EXACTLY (same file selection, same row match, same
capture-day-low recovery, same contract + scoring). If leadtime.py ever drifts
from compare.py's pipeline, the lead-0 tests fail against the committed
comparison JSON.
"""
import json
import pathlib

import pytest

import compare
import leadtime
from sources import SOURCES

DATA = pathlib.Path(__file__).resolve().parent.parent / "data"


def _a_date_with_comparison(source):
    """Most recent committed comparison in which `source` has a score."""
    for f in sorted(DATA.glob("comparisons/*.json"), reverse=True):
        d = json.load(open(f))
        if d.get("sources", {}).get(source, {}).get("score"):
            return d["date"], d
    raise AssertionError(f"no comparison with {source} score found")


@pytest.mark.parametrize("source", ["openmeteo", "raysweather", "metno"])
def test_lead0_matches_existing_comparison(source):
    """Lead-0 parity across the three scoring branches: openmeteo (plain
    daily-array lookup), raysweather (strip+daily merge), metno (capture-day
    bucket-low recovery)."""
    date, comp = _a_date_with_comparison(source)
    norm_actual = compare._normalize_actual(comp["actuals"])
    lead0 = leadtime.score_lead(date, source, 0, norm_actual)
    assert lead0 is not None
    assert lead0["score"] == comp["sources"][source]["score"]["score"]


def test_missing_capture_returns_none():
    _, comp = _a_date_with_comparison("openmeteo")
    norm_actual = compare._normalize_actual(comp["actuals"])
    assert leadtime.score_lead("1900-01-01", "openmeteo", 3, norm_actual) is None


def test_source_files_matches_sources_registry():
    """Drift guard: every registered source (plus openmeteo, which compare.py
    scores outside the SOURCES loop) must have a capture-file mapping.
    raysweather is special-cased in _rays_row, and Apple ("apple_weather") is
    deliberately absent — flat single-day capture, no daily array. Fails
    loudly when a new source is registered but not mapped here."""
    assert set(leadtime.SOURCE_FILES) == {s["key"] for s in SOURCES} | {"openmeteo"}


def test_rays_lead3_uses_daily_row_not_capture_day_strip(tmp_path, monkeypatch):
    """At lead >= 1 Ray's forecast for D is the daily[] row dated D. The strip
    (today_high_f/tonight_low_f) describes the capture day, and a missing row
    must NOT fall back to another date's row (both of which
    _best_rays_prediction does, correctly, for lead 0 only)."""
    cap = tmp_path / "predictions" / "2026-07-04"
    cap.mkdir(parents=True)
    capture = {
        "forecast": {"today_high_f": 92.0, "tonight_low_f": 68.0},
        "daily": [
            {"date": "2026-07-04", "high_f": 92.0, "low_f": 68.0},
            {"date": "2026-07-07", "high_f": 84.0, "low_f": 65.0,
             "precip_type": "rain"},
        ],
    }
    (cap / "rays_boone.json").write_text(json.dumps(capture))
    monkeypatch.setattr(leadtime, "DATA_DIR", tmp_path)
    norm_actual = {"high_f": 84.0, "low_f": 65.0, "wind_mph": 5.0,
                   "rain_in": 0.2, "snow_in": 0.0}

    lead3 = leadtime.score_lead("2026-07-07", "raysweather", 3, norm_actual)
    assert lead3 is not None
    assert lead3["high_bias"] == 0.0  # daily row's 84, not the strip's 92
    assert lead3["low_bias"] == 0.0

    # A scraped precip_in artifact (0.0 in the 2026-03..06 raw captures) must
    # be inert: Ray never publishes a numeric amount, so the amount stays
    # forfeited at every lead — the same policy _best_rays_prediction applies
    # at lead 0. Without the drop, 0.0 would score as an explicit dry
    # forecast against the 0.2" actual and shift the score in Ray's favor.
    capture["daily"][1]["precip_in"] = 0.0
    (cap / "rays_boone.json").write_text(json.dumps(capture))
    with_artifact = leadtime.score_lead("2026-07-07", "raysweather", 3, norm_actual)
    assert with_artifact is not None
    assert with_artifact["score"] == lead3["score"]

    # 2026-07-09 has no row in the 07-04 capture -> no forecast at lead 5.
    assert leadtime.score_lead("2026-07-09", "raysweather", 5, norm_actual) is None
