"""Tests for scripts/compare_traffic.py grading + running scores (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import compare_traffic as ct
import traffic_model as tm


def _forecast(iso, event_day=False, wclass="saturday"):
    """A minimal forecast with one corridor and two graded windows."""
    return {
        "targets": {
            iso: {
                "weekday_class": wclass,
                "event_day": event_day,
                "corridors": {
                    "king-st": {"windows": {
                        "08:00": {"ratio": 0.60, "jammed_prob": 0.20, "jammed": False},
                        "17:00": {"ratio": 0.40, "jammed_prob": 0.80, "jammed": True},
                    }},
                },
            }
        }
    }


def _actuals(iso):
    return {"date": iso, "samples": [
        {"at": f"{iso}T08:05:00-04:00", "readings": {"king-st": {"ratio": 0.50}}},
        {"at": f"{iso}T17:05:00-04:00", "readings": {"king-st": {"ratio": 0.45}}},
    ]}


def test_grade_computes_abs_error_and_brier():
    iso = "2026-07-25"
    comp = ct.grade(_forecast(iso), _actuals(iso), iso)
    assert comp["n_pairs"] == 2
    kw = comp["corridors"]["king-st"]["windows"]
    # 08:00: pred 0.60 vs obs 0.50 -> ae 0.10; obs 0.50 < 0.55 -> jammed True; brier (0.20-1)^2
    assert kw["08:00"]["abs_error"] == 0.10
    assert kw["08:00"]["observed_jammed"] is True
    assert kw["08:00"]["brier"] == round((0.20 - 1.0) ** 2, 4)
    # 17:00: pred 0.40 vs obs 0.45 -> ae 0.05; obs jammed; brier (0.80-1)^2
    assert kw["17:00"]["abs_error"] == 0.05
    assert kw["17:00"]["brier"] == round((0.80 - 1.0) ** 2, 4)
    # overall MAE = mean(0.10, 0.05) = 0.075
    assert comp["overall"]["ratio_mae"] == 0.075


def test_grade_returns_none_without_target():
    assert ct.grade({"targets": {}}, _actuals("2026-07-25"), "2026-07-25") is None


def test_grade_skips_windows_without_observation():
    iso = "2026-07-25"
    actuals = {"date": iso, "samples": [
        {"at": f"{iso}T08:05:00-04:00", "readings": {"king-st": {"ratio": 0.50}}}]}
    comp = ct.grade(_forecast(iso), actuals, iso)
    # only the 08:00 window had a sample
    assert comp["n_pairs"] == 1
    assert list(comp["corridors"]["king-st"]["windows"].keys()) == ["08:00"]


def test_update_scores_accumulates_by_condition_and_weekday():
    iso = "2026-07-25"
    comp = ct.grade(_forecast(iso, event_day=True, wclass="saturday"), _actuals(iso), iso)
    scores = ct.update_scores(None, comp)
    assert scores["overall"]["n"] == 2
    assert scores["by_corridor"]["king-st"]["n"] == 2
    assert scores["by_condition"]["event_day"]["n"] == 2
    assert scores["by_condition"]["ordinary"]["n"] == 0
    assert scores["by_weekday_class"]["saturday"]["n"] == 2
    assert scores["graded_dates"] == [iso]
    # overall MAE matches the comparison
    assert scores["overall"]["ratio_mae"] == 0.075


def test_update_scores_is_idempotent_per_date():
    iso = "2026-07-25"
    comp = ct.grade(_forecast(iso, event_day=True), _actuals(iso), iso)
    scores = ct.update_scores(None, comp)
    again = ct.update_scores(scores, comp)  # same date -> no double count
    assert again["overall"]["n"] == 2
    assert again["graded_dates"] == [iso]


def test_update_scores_two_distinct_dates_accumulate():
    c1 = ct.grade(_forecast("2026-07-25", wclass="saturday"), _actuals("2026-07-25"), "2026-07-25")
    c2 = ct.grade(_forecast("2026-07-26", wclass="sunday"), _actuals("2026-07-26"), "2026-07-26")
    scores = ct.update_scores(None, c1)
    scores = ct.update_scores(scores, c2)
    assert scores["overall"]["n"] == 4
    assert scores["by_weekday_class"]["saturday"]["n"] == 2
    assert scores["by_weekday_class"]["sunday"]["n"] == 2
    assert scores["graded_dates"] == ["2026-07-25", "2026-07-26"]


def test_main_missing_inputs_exits_zero(monkeypatch):
    # A date with no forecast/actuals on disk -> graceful skip, no exception.
    monkeypatch.setattr(sys, "argv", ["compare_traffic.py", "--date", "2020-01-01"])
    assert ct.main() == 0
