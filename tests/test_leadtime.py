"""Tests for leadtime.score_lead — lead-time scoring built on the daily engine.

The load-bearing invariant: score_lead at lead 0 must reproduce the existing
daily comparison EXACTLY (same file selection, same row match, same
capture-day-low recovery, same contract + scoring). If leadtime.py ever drifts
from compare.py's pipeline, the lead-0 tests fail against the committed
comparison JSON.
"""
import datetime
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


def test_aggregate_mae_and_bias():
    rows = [
        {"source": "openmeteo", "lead": 1, "score": 90, "high_err": 2.0, "high_bias": 2.0, "low_err": 1.0, "low_bias": -1.0},
        {"source": "openmeteo", "lead": 1, "score": 80, "high_err": 4.0, "high_bias": -4.0, "low_err": 3.0, "low_bias": 3.0},
    ]
    agg = leadtime._aggregate_rows(rows)
    cell = agg["openmeteo"]["1"]
    assert cell["n"] == 2
    assert cell["avg_score"] == 85.0
    assert cell["high_mae"] == 3.0          # (2+4)/2
    assert cell["high_bias"] == -1.0        # (2 + -4)/2


def _openmeteo_row_exists(capture_day, target_date):
    p = DATA / "predictions" / capture_day / "openmeteo_forecast.json"
    if not p.exists():
        return False
    data = json.load(open(p))
    return any(day.get("date") == target_date for day in data.get("daily", []))


def _a_date_with_lead1_openmeteo():
    """Most recent date with committed actuals plus an openmeteo row for it in
    both its own capture (lead 0) and the prior day's capture (lead 1)."""
    for f in sorted(DATA.glob("actuals/*.json"), reverse=True):
        d = f.stem
        prev = (datetime.date.fromisoformat(d) - datetime.timedelta(days=1)).isoformat()
        if _openmeteo_row_exists(d, d) and _openmeteo_row_exists(prev, d):
            return d
    raise AssertionError("no date with openmeteo captures at lead 0 and 1")


def test_build_leadtime_and_rollup_on_real_data(tmp_path, monkeypatch):
    """Integration against the real committed data (read-only), like the
    lead-0 parity tests.

    Hermeticity choice: redirect ONLY the outputs. Reads must keep going
    through the real tree — score_lead's lead-0 path (_fix_bucket_low) and
    _best_rays_prediction read via compare.DATA_DIR, so neither DATA_DIR may
    point at tmp during the build. _leadtime_dir() is monkeypatched to
    tmp_path for the per-date write; leadtime.DATA_DIR is switched to
    tmp_path only AFTER build_leadtime, for build_leadtime_scores'
    leadtime_scores.json write (that function reads no predictions/actuals).
    Nothing under the repo's data/ is created, and pytest cleans tmp_path."""
    out_dir = tmp_path / "leadtime"
    monkeypatch.setattr(leadtime, "_leadtime_dir", lambda: out_dir)
    date = _a_date_with_lead1_openmeteo()
    result = leadtime.build_leadtime(date)

    assert result is not None
    om_leads = {r["lead"] for r in result["rows"] if r["source"] == "openmeteo"}
    assert 0 in om_leads
    assert any(lead >= 1 for lead in om_leads)

    written = out_dir / f"{date}.json"
    assert written.exists()
    assert json.load(open(written)) == result

    # Roll the per-date file up and check the envelope + cell keys the
    # TypeScript side (LeadCell/LeadtimeScores) depends on.
    monkeypatch.setattr(leadtime, "DATA_DIR", tmp_path)
    scores = leadtime.build_leadtime_scores()
    assert scores["location"] == leadtime.LOCATION
    assert scores["max_lead"] == leadtime.MAX_LEAD
    cell = scores["by_source"]["openmeteo"]["0"]
    assert set(cell) == {"n", "avg_score", "high_mae", "low_mae",
                         "high_bias", "low_bias"}
    assert cell["n"] == 1  # one built date -> one row per (source, lead)
    row0 = next(r for r in result["rows"]
                if r["source"] == "openmeteo" and r["lead"] == 0)
    assert cell["avg_score"] == row0["score"]
    assert (tmp_path / "leadtime_scores.json").exists()
