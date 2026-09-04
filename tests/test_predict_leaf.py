"""Tests for scripts/predict_leaf.py -- the I/O shell around leaf_model.py.

No network calls: these exercise the pure/local pieces (climatology window
selection, anomaly arithmetic, the September-only cache filter, output-path
mapping, and the overwrite guard) without touching load_or_fetch_series or
fetch_archive.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import leaf_model as lm
import predict_leaf as pl


# ── climatology_years ────────────────────────────────────────────────────────

def test_climatology_years_rolling_v0():
    params = lm.get_params("leaf-v0-draft")
    years = list(pl.climatology_years(2026, params))
    assert years == [2020, 2021, 2022, 2023, 2024, 2025]
    assert 2026 not in years


def test_climatology_years_fixed_span_v1():
    params = lm.get_params("leaf-v1")
    years = list(pl.climatology_years(2026, params))
    assert years == list(range(2008, 2026))
    assert years[0] == 2008
    assert years[-1] == 2025
    # The fixed span is independent of the target year -- 2019 sees the same
    # normal years as 2026 does (the whole point of switching off rolling).
    assert list(pl.climatology_years(2019, params)) == years


def test_climatology_years_fixed_span_excludes_target_year_if_inside_span():
    # climatology_years() only returns the *range*; compute_anomaly is what
    # excludes the target year from its own normal. Confirm the range itself
    # can include the target year (e.g. a hindcast for 2019, which sits inside
    # 2008-2025) so the caller-side exclusion is the thing actually tested.
    params = lm.get_params("leaf-v1")
    years = list(pl.climatology_years(2019, params))
    assert 2019 in years


# ── compute_anomaly ───────────────────────────────────────────────────────────

def _daily_series(year: int, mean_temp: float, start=(9, 1), end=(9, 25)):
    """A synthetic daily series with a constant mean temp across a window,
    enough days to clear MIN_DAYS_FOR_ANOMALY."""
    from datetime import date, timedelta
    out = {}
    d = date(year, *start)
    e = date(year, *end)
    while d <= e:
        out[d.isoformat()] = {"tmax": mean_temp, "tmin": mean_temp}
        d += timedelta(days=1)
    return out


def test_compute_anomaly_no_normal_available_returns_none():
    params = lm.get_params("leaf-v0-draft")
    anomaly, detail = pl.compute_anomaly({}, 2026, params)
    assert anomaly is None
    assert "reason" in detail
    assert "normal_years" not in detail


def test_compute_anomaly_insufficient_current_year_data():
    params = lm.get_params("leaf-v0-draft")
    daily = {}
    for y in range(2020, 2026):
        daily.update(_daily_series(y, 60.0))
    anomaly, detail = pl.compute_anomaly(daily, 2026, params)
    assert anomaly is None
    assert detail["normal_years"] == 6
    assert "insufficient" in detail["reason"]


def test_compute_anomaly_warmer_than_normal_is_positive():
    params = lm.get_params("leaf-v0-draft")
    daily = {}
    for y in range(2020, 2026):
        daily.update(_daily_series(y, 60.0))
    daily.update(_daily_series(2026, 65.0))
    anomaly, detail = pl.compute_anomaly(daily, 2026, params)
    assert anomaly == 5.0
    assert detail["normal_years"] == 6
    assert detail["current_days"] == 25


def test_compute_anomaly_excludes_target_year_from_its_own_normal():
    # If the target year's own data leaked into the normal, a self-comparison
    # would always read as a zero anomaly. Feed 2026 a different mean than the
    # climatology years and confirm the anomaly isn't washed out.
    params = lm.get_params("leaf-v0-draft")
    daily = {}
    for y in range(2020, 2026):
        daily.update(_daily_series(y, 58.0))
    daily.update(_daily_series(2026, 58.0 + 3.0))
    anomaly, _detail = pl.compute_anomaly(daily, 2026, params)
    assert anomaly == 3.0


# ── _september_only ───────────────────────────────────────────────────────────

def test_september_only_keeps_september_and_drops_other_months():
    daily = {
        "2026-08-30": {"tmax": 70, "tmin": 50},
        "2026-09-01": {"tmax": 72, "tmin": 52},
        "2026-09-25": {"tmax": 68, "tmin": 48},
        "2026-10-02": {"tmax": 60, "tmin": 40},
    }
    kept = pl._september_only(daily)
    assert set(kept) == {"2026-09-01", "2026-09-25"}


def test_september_only_empty_input():
    assert pl._september_only({}) == {}


# ── output_path ────────────────────────────────────────────────────────────

def test_output_path_v0_draft_is_frozen_predictions_file():
    assert pl.output_path("leaf-v0-draft", None) == pl.LEAF_DIR / "predictions.json"


def test_output_path_v1_provisional():
    path = pl.output_path("leaf-v1", "provisional")
    assert path == pl.LEAF_DIR / "predictions-v1-provisional.json"


def test_output_path_v1_final():
    path = pl.output_path("leaf-v1", "final")
    assert path == pl.LEAF_DIR / "predictions-v1.json"


def test_output_path_unknown_combination_gets_explicit_filename():
    path = pl.output_path("leaf-v2", "draft")
    assert path == pl.LEAF_DIR / "predictions-leaf-v2-draft.json"


def test_output_path_unknown_version_no_pass():
    path = pl.output_path("leaf-v2", None)
    assert path == pl.LEAF_DIR / "predictions-leaf-v2.json"


# ── overwrite guard ────────────────────────────────────────────────────────

def test_main_refuses_to_overwrite_existing_file(tmp_path, monkeypatch, capsys):
    existing = tmp_path / "predictions.json"
    existing.write_text(json.dumps({"already": "here"}))

    monkeypatch.setattr(
        sys, "argv",
        ["predict_leaf.py", "--model-version", "leaf-v0-draft", "--out", str(existing)],
    )
    rc = pl.main()
    captured = capsys.readouterr()

    assert rc == 1
    assert "REFUSING to overwrite" in captured.err
    # The file must be untouched -- this is the whole point of the guard.
    assert json.loads(existing.read_text()) == {"already": "here"}


def test_main_allows_overwrite_with_flag(tmp_path, monkeypatch):
    # Point --out somewhere that already exists, but this time pass
    # --allow-overwrite. We don't want this test hitting the network (no
    # thermal signal exists for a synthetic town anyway), so stub out the
    # actual prediction machinery and just confirm the guard gets past the
    # refusal and calls through to write the file.
    existing = tmp_path / "predictions.json"
    existing.write_text(json.dumps({"already": "here"}))

    def fake_predict(year, refresh, version, pass_name):
        return {"model_version": version, "model_pass": pass_name,
                "generated_at": "2026-09-04T00:00:00-04:00",
                "predictions": []}

    monkeypatch.setattr(pl, "predict", fake_predict)
    monkeypatch.setattr(
        sys, "argv",
        ["predict_leaf.py", "--model-version", "leaf-v0-draft",
         "--out", str(existing), "--allow-overwrite"],
    )
    rc = pl.main()

    assert rc == 0
    written = json.loads(existing.read_text())
    assert written["model_version"] == "leaf-v0-draft"
    assert written["predictions"] == []
