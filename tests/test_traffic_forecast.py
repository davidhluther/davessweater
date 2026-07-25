"""Tests for scripts/forecast_traffic.py assembly (pure builders, no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import forecast_traffic as ft
import traffic_model as tm

CORRIDORS = {
    "king-st": "King St", "bypass-321": "Bypass", "us321-blowing-rock": "BR",
    "nc105-split": "105 split", "nc105-foscoe": "Foscoe", "us421-deep-gap": "Deep Gap",
}


def _actuals(iso, at, readings):
    return {"date": iso, "corridors": CORRIDORS, "samples": [{"at": at, "readings": readings}]}


def test_build_target_cold_start_all_default_basis():
    tgt = ft.build_target("2026-07-25", CORRIDORS, tm.accumulate_baselines([]),
                          None, None, None, None)
    assert tgt["weekday_class"] == "saturday"
    for slug in CORRIDORS:
        for w in tgt["corridors"][slug]["windows"].values():
            assert w["basis"] == "default"
            assert w["baseline"] == 1.0
            assert w["ratio"] == 1.0  # 1.0 * 1.0 * 1.0, no events/weather


def test_build_target_uses_cell_then_falls_back():
    # One Saturday sample at ~12:00 seeds only the (corridor, saturday, 12) cell.
    days = [_actuals("2026-07-25", "2026-07-25T12:00:00-04:00",
                     {"king-st": {"ratio": 0.44}})]
    baselines = tm.accumulate_baselines(days)
    tgt = ft.build_target("2026-07-25", CORRIDORS, baselines, None, None, None, None)
    wins = tgt["corridors"]["king-st"]["windows"]
    # window 12 hits the exact cell
    assert wins["12:00"]["basis"] == "cell"
    assert wins["12:00"]["baseline"] == 0.44
    # window 17 has no cell/corridor_window -> corridor mean (same single sample)
    assert wins["17:00"]["basis"] == "corridor"
    assert wins["17:00"]["baseline"] == 0.44


def test_build_target_applies_event_and_weather_multipliers():
    registry = {"events": [{"id": "asu-fb", "type": "athletics", "magnitude": "major",
                            "towns": ["boone"], "dates": ["2026-09-05"]}]}
    forecast_5day = {"days": [{"date": "2026-09-05", "sky": "rain", "sources": {},
                               "hourly": [{"prob": 80}]}]}
    baselines = tm.accumulate_baselines(
        [_actuals("2026-09-05", "2026-09-05T17:00:00-04:00", {"king-st": {"ratio": 0.8}})])
    tgt = ft.build_target("2026-09-05", CORRIDORS, baselines, registry, None, None, forecast_5day)
    assert tgt["event_day"] is True
    w = tgt["corridors"]["king-st"]["windows"]["17:00"]
    # baseline 0.8 * football-primary 0.55 * heavy-weather 0.85
    assert w["event_multiplier"] == 0.55
    assert w["weather_multiplier"] == 0.85
    assert w["ratio"] == tm.predict_ratio(0.8, 0.55, 0.85)
    assert w["jammed"] is True


def test_build_forecast_shape_two_targets():
    fc = ft.build_forecast(date(2026, 7, 25), [], None, None, None, None)
    assert fc["model"] == "traffic-model-v0"
    assert list(fc["targets"].keys()) == ["2026-07-25", "2026-07-26"]
    assert fc["windows"] == ["08:00", "12:00", "17:00", "19:00"]
    assert fc["baseline_cells_observed"] == 0
