"""Regression tests for the 11/16 Argon audit fixes in scripts/compare.py.

D6: the homepage forecasts (latest_forecasts.json + forecast_5day.json) must be
rebuilt on every run_daily_comparison exit path, not only after yesterday
scores, so archive lag can't leave the homepage stale.

D3: Ray's daily[] is matched to the target date exactly. A capture whose
daily[] has rows but none on the target date stays unscored instead of
borrowing daily[0] or the nearest future day.
"""
import json

import pytest

import compare

TARGET = "2026-11-15"


@pytest.fixture
def calls(monkeypatch, tmp_path):
    """Point DATA_DIR at tmp_path and record forecast-builder calls."""
    monkeypatch.setattr(compare, "DATA_DIR", tmp_path)
    seen = []
    monkeypatch.setattr(compare, "build_latest_forecasts", lambda: seen.append("latest"))
    monkeypatch.setattr(compare, "build_forecast_5day", lambda: seen.append("5day"))
    return seen


def _write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj))


# --- D6 ---------------------------------------------------------------------

def test_forecasts_rebuilt_when_actuals_missing(calls, tmp_path):
    """Archive lag: no actuals for yesterday -> no comparison, but the
    forecasts still refresh."""
    assert compare.run_daily_comparison(TARGET) is None
    assert calls == ["latest", "5day"]
    assert not (tmp_path / "comparisons").exists()


def test_forecasts_rebuilt_when_nothing_scores(calls, tmp_path):
    """Actuals present but no source has a row for the date -> no comparison
    written, forecasts still refresh."""
    _write(tmp_path / "actuals" / f"{TARGET}.json",
           {"date": TARGET, "high_f": 50.0, "low_f": 30.0, "conditions": "Clear",
            "precip_in": 0.0, "wind_max_mph": 5.0})
    assert compare.run_daily_comparison(TARGET) is None
    assert calls == ["latest", "5day"]
    assert not (tmp_path / "comparisons" / f"{TARGET}.json").exists()


def test_one_builder_failing_still_runs_other_and_raises(monkeypatch):
    """A failure in one builder can't skip the other, and it surfaces as an
    exception (red workflow step) rather than a quiet pass."""
    seen = []

    def boom():
        seen.append("latest")
        raise RuntimeError("bad capture")

    monkeypatch.setattr(compare, "build_latest_forecasts", boom)
    monkeypatch.setattr(compare, "build_forecast_5day", lambda: seen.append("5day"))
    with pytest.raises(RuntimeError, match="bad capture"):
        compare._build_forecasts_safely()
    assert seen == ["latest", "5day"]


# --- D3 ---------------------------------------------------------------------

def _rays(daily, forecast=None):
    return {"forecast": forecast or {}, "daily": daily}


def test_rays_exact_date_match_used():
    data = _rays([
        {"date": "2026-11-15", "high_f": 52, "low_f": 31, "wind_mph": 8},
        {"date": "2026-11-16", "high_f": 60, "low_f": 40, "wind_mph": 12},
    ])
    pred = compare._best_rays_prediction(data, TARGET)
    assert (pred["today_high_f"], pred["tonight_low_f"], pred["wind_mph"]) == (52, 31, 8)


def test_rays_misanchored_daily_stays_unscored():
    """No row on the target date: the old code took the nearest future row
    (11/16) and scored it against 11/15's actuals."""
    data = _rays(
        [{"date": "2026-11-16", "high_f": 60, "low_f": 40, "wind_mph": 12},
         {"date": "2026-11-17", "high_f": 61, "low_f": 41, "wind_mph": 13}],
        forecast={"today_high_f": 60, "tonight_low_f": 40},
    )
    assert compare._best_rays_prediction(data, TARGET) is None


def test_rays_only_past_rows_stays_unscored():
    """No row on or after the target date: the old code fell back to daily[0]."""
    data = _rays([{"date": "2026-11-13", "high_f": 45, "low_f": 25}])
    assert compare._best_rays_prediction(data, TARGET) is None


def test_rays_no_daily_keeps_strip():
    """A capture with no daily[] at all still scores from its strip (no
    date fallback involved)."""
    data = _rays([], forecast={"today_high_f": 52, "tonight_low_f": 31})
    pred = compare._best_rays_prediction(data, TARGET)
    assert (pred["today_high_f"], pred["tonight_low_f"]) == (52, 31)


def test_rays_misanchored_capture_not_in_comparison(calls, tmp_path):
    """End to end: a mis-anchored Ray's capture produces no raysweather score."""
    _write(tmp_path / "actuals" / f"{TARGET}.json",
           {"date": TARGET, "high_f": 50.0, "low_f": 30.0, "conditions": "Clear",
            "precip_in": 0.0, "wind_max_mph": 5.0})
    _write(tmp_path / "predictions" / TARGET / "rays_boone.json",
           _rays([{"date": "2026-11-16", "high_f": 60, "low_f": 40}],
                 forecast={"today_high_f": 60, "tonight_low_f": 40}))
    comp = compare.run_daily_comparison(TARGET)
    # Ray's was the only source, so nothing scored and nothing was written.
    assert comp is None
    assert not (tmp_path / "comparisons" / f"{TARGET}.json").exists()
