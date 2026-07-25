"""Pure-function tests for scripts/traffic_model.py (no network, no I/O)."""

import math
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import traffic_model as tm


# ── windows + weekday class ──────────────────────────────────────────────────

def test_weekday_class():
    assert tm.weekday_class(date(2026, 7, 20)) == "weekday"   # Monday
    assert tm.weekday_class(date(2026, 7, 23)) == "weekday"   # Thursday
    assert tm.weekday_class(date(2026, 7, 24)) == "friday"
    assert tm.weekday_class(date(2026, 7, 25)) == "saturday"
    assert tm.weekday_class(date(2026, 7, 26)) == "sunday"


def test_window_for_time_nearest():
    assert tm.window_for_time("2026-07-25T08:07:00-04:00") == 8
    assert tm.window_for_time("2026-07-25T13:23:40-04:00") == 12   # closer to 12 than 17
    assert tm.window_for_time("2026-07-25T16:40:00-04:00") == 17
    assert tm.window_for_time("2026-07-25T19:05:00-04:00") == 19
    assert tm.window_for_time("2026-07-25T23:00:00-04:00") == 19   # nearest is 19
    assert tm.window_for_time("not-a-time") is None


def test_window_for_time_tie_breaks_earlier():
    # 14:30 is exactly between 12 and 17 (2.5 each) -> earlier window wins.
    assert tm.window_for_time("2026-07-25T14:30:00-04:00") == 12


def test_window_for_time_utc_converts_to_ny():
    # 12:07 UTC == 08:07 EDT -> window 8.
    assert tm.window_for_time("2026-07-25T12:07:00+00:00") == 8


# ── baseline cells + fallback chain ──────────────────────────────────────────

def _day(iso, at, readings):
    return {"date": iso, "samples": [{"at": at, "readings": readings}]}


def test_accumulate_baselines_means():
    days = [
        _day("2026-07-25", "2026-07-25T08:00:00-04:00", {"king-st": {"ratio": 0.4}}),
        _day("2026-07-25", "2026-07-25T08:10:00-04:00", {"king-st": {"ratio": 0.6}}),
    ]
    b = tm.accumulate_baselines(days)
    # (king-st, saturday, 8) mean of 0.4 and 0.6 = 0.5
    assert b["cell"][("king-st", "saturday", 8)] == 0.5
    assert b["corridor_window"][("king-st", 8)] == 0.5
    assert b["corridor"]["king-st"] == 0.5


def test_accumulate_baselines_skips_null_and_missing():
    days = [_day("2026-07-25", "2026-07-25T08:00:00-04:00",
                 {"king-st": None, "bypass-321": {"ratio": None}, "nc105-split": {"ratio": 0.9}})]
    b = tm.accumulate_baselines(days)
    assert ("king-st", "saturday", 8) not in b["cell"]
    assert ("bypass-321", "saturday", 8) not in b["cell"]
    assert b["cell"][("nc105-split", "saturday", 8)] == 0.9


def test_baseline_lookup_fallback_chain():
    baselines = {
        "cell": {("king-st", "saturday", 8): 0.4},
        "corridor_window": {("king-st", 8): 0.4, ("king-st", 17): 0.5},
        "corridor": {"king-st": 0.45, "bypass-321": 0.7},
    }
    # level 0 — exact cell
    assert tm.baseline_lookup(baselines, "king-st", "saturday", 8) == (0.4, "cell")
    # level 1 — corridor+window (no friday-8 cell, but there is a king-st,17 cw... use 17)
    assert tm.baseline_lookup(baselines, "king-st", "friday", 17) == (0.5, "corridor_window")
    # level 2 — corridor mean (no cell, no cw at window 12)
    assert tm.baseline_lookup(baselines, "king-st", "friday", 12) == (0.45, "corridor")
    # level 3 — default 1.0
    assert tm.baseline_lookup(baselines, "us421-deep-gap", "friday", 12) == (1.0, "default")


# ── prediction primitives ────────────────────────────────────────────────────

def test_clamp_ratio():
    assert tm.clamp_ratio(0.5) == 0.5
    assert tm.clamp_ratio(1.4) == 1.0       # above free flow -> 1.0
    assert tm.clamp_ratio(0.01) == 0.05     # floor
    assert tm.clamp_ratio(1.0) == 1.0


def test_predict_ratio_combines_and_clamps():
    assert tm.predict_ratio(0.8, 0.75, 1.0) == 0.6
    assert tm.predict_ratio(0.8, 0.55, 0.85) == round(0.8 * 0.55 * 0.85, 3)
    # outflow pushes above free flow -> clamped to 1.0
    assert tm.predict_ratio(1.0, 1.05, 1.0) == 1.0


def test_jammed_probability_mapping():
    # At threshold, exactly 0.5.
    assert tm.jammed_probability(0.55) == 0.5
    # Below threshold -> more likely jammed; above -> less.
    assert tm.jammed_probability(0.45) > 0.5
    assert tm.jammed_probability(0.65) < 0.5
    # Monotonic decreasing in ratio.
    assert tm.jammed_probability(0.3) > tm.jammed_probability(0.5)
    # Matches the documented logistic.
    expected = round(1.0 / (1.0 + math.exp(tm.JAM_K * (0.45 - tm.JAM_THRESHOLD))), 3)
    assert tm.jammed_probability(0.45) == expected


# ── event multiplier priors ──────────────────────────────────────────────────

def _matched(**kw):
    base = {"ids": [], "labels": [], "football": False, "academic_movein": False,
            "major_towns": set(), "outflow": False}
    base.update(kw)
    return base


def test_event_multiplier_none():
    assert tm.event_multiplier("king-st", _matched(), None) == 1.0


def test_event_multiplier_football_primary_and_spillover():
    m = _matched(football=True)
    assert tm.event_multiplier("king-st", m, None) == 0.55
    assert tm.event_multiplier("bypass-321", m, None) == 0.55
    assert tm.event_multiplier("us421-deep-gap", m, None) == 0.80


def test_event_multiplier_academic_movein_downtown_only():
    m = _matched(academic_movein=True)
    assert tm.event_multiplier("king-st", m, None) == 0.65
    assert tm.event_multiplier("bypass-321", m, None) == 0.65
    assert tm.event_multiplier("us421-deep-gap", m, None) == 1.0  # not a downtown artery


def test_event_multiplier_major_town_event():
    m = _matched(major_towns={"blowing-rock"})
    assert tm.event_multiplier("us321-blowing-rock", m, None) == 0.75
    assert tm.event_multiplier("king-st", m, None) == 1.0  # boone corridor unaffected


def test_event_multiplier_band_nudge_tourist_only():
    assert tm.event_multiplier("bypass-321", _matched(), "slammed") == 0.90
    assert tm.event_multiplier("bypass-321", _matched(), "busy") == 0.95
    assert tm.event_multiplier("nc105-foscoe", _matched(), "busy") == 0.95
    # king-st is not a tourist corridor -> band ignored.
    assert tm.event_multiplier("king-st", _matched(), "slammed") == 1.0
    # calm/typical bands -> no nudge.
    assert tm.event_multiplier("bypass-321", _matched(), "calm") == 1.0


def test_event_multiplier_outflow_loosens():
    assert tm.event_multiplier("king-st", _matched(outflow=True), None) == 1.05


def test_event_multiplier_stacks_multiplicatively():
    # football + busy band on a tourist primary corridor.
    m = _matched(football=True)
    assert tm.event_multiplier("bypass-321", m, "busy") == round(0.55 * 0.95, 4)


# ── event matching ───────────────────────────────────────────────────────────

REGISTRY = {
    "events": [
        {"id": "asu-move-in-new", "type": "academic", "magnitude": "major",
         "towns": ["boone"], "dates": ["2026-08-12"]},
        {"id": "asu-fall-break", "type": "academic", "magnitude": "moderate",
         "demand_sign": "negative", "towns": ["boone"], "dates": ["2026-10-05"]},
        {"id": "woolly-worm", "type": "festival", "magnitude": "major",
         "towns": ["banner-elk"], "dates": ["2026-10-17"]},
        {"id": "app-summer", "type": "festival", "magnitude": "moderate",
         "towns": ["boone"], "date_range": {"start": "2026-06-27", "end": "2026-08-01"}},
        {"id": "asu-fb", "type": "athletics", "magnitude": "major",
         "towns": ["boone"], "dates": ["2026-09-05"]},
        {"id": "dead-fest", "name": "Todd Festival - LIKELY DEFUNCT", "type": "festival",
         "magnitude": "major", "towns": ["todd"], "dates": ["2026-08-12"]},
    ]
}
ATHLETICS = {"feeds": {"football": [
    {"home": True, "start": "2026-09-05T19:30:00+00:00", "uid": "g1"},
    {"home": False, "start": "2026-09-12T16:00:00+00:00", "uid": "g2"},
]}}


def test_match_events_academic_movein():
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-08-12")
    assert m["academic_movein"] is True
    assert "asu-move-in-new" in m["ids"]
    # defunct event excluded despite matching the date.
    assert "dead-fest" not in m["ids"]
    # a major academic inflow doesn't create a major town (own rule handles it).
    assert m["major_towns"] == set()


def test_match_events_date_range_festival_matches():
    # app-summer runs 2026-06-27..2026-08-01 (moderate) — matches inside the span.
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-07-15")
    assert "app-summer" in m["ids"]
    # moderate festival -> not a major town.
    assert m["major_towns"] == set()


def test_match_events_major_town_festival():
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-10-17")
    assert m["major_towns"] == {"banner-elk"}
    assert m["academic_movein"] is False


def test_match_events_outflow():
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-10-05")
    assert m["outflow"] is True


def test_match_events_football_from_feed_and_registry():
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-09-05")
    assert m["football"] is True
    assert "asu-football" in m["ids"]
    # athletics-type registry event never counts as a major town.
    assert m["major_towns"] == set()


def test_match_events_none_on_quiet_day():
    m = tm.match_events(REGISTRY, ATHLETICS, "2026-09-30")
    assert m["ids"] == [] and m["football"] is False


# ── weather multiplier ───────────────────────────────────────────────────────

def test_weather_multiplier_heavy_prob():
    day = {"sky": "rain", "sources": {}, "hourly": [{"prob": 63}, {"prob": 20}]}
    assert tm.weather_multiplier(day) == (0.85, "heavy precip 63%")


def test_weather_multiplier_light():
    day = {"sky": "drizzle", "sources": {}, "hourly": [{"prob": 42}, {"prob": 10}]}
    assert tm.weather_multiplier(day) == (1.0, "dry-or-light")


def test_weather_multiplier_snow():
    day = {"sky": "snow", "sources": {"x": {"precip_type": "snow"}}, "hourly": [{"prob": 30}]}
    assert tm.weather_multiplier(day)[0] == 0.85
    assert tm.weather_multiplier(day)[1] == "snow"


def test_weather_multiplier_no_hourly_uses_source_pop():
    day = {"sky": "cloudy", "sources": {"om": {"precip_prob": 70}}, "hourly": []}
    assert tm.weather_multiplier(day) == (0.85, "heavy precip 70%")


def test_weather_multiplier_missing_day():
    assert tm.weather_multiplier(None) == (1.0, "no-forecast")


# ── grading math ─────────────────────────────────────────────────────────────

def test_observed_window_ratios_averages_within_window():
    day = {"date": "2026-07-25", "samples": [
        {"at": "2026-07-25T08:00:00-04:00", "readings": {"king-st": {"ratio": 0.4}}},
        {"at": "2026-07-25T08:20:00-04:00", "readings": {"king-st": {"ratio": 0.6}}},
        {"at": "2026-07-25T17:00:00-04:00", "readings": {"king-st": {"ratio": 0.9}}},
    ]}
    obs = tm.observed_window_ratios(day)
    assert obs["king-st"]["08:00"] == 0.5
    assert obs["king-st"]["17:00"] == 0.9


def test_abs_error_and_brier():
    assert tm.abs_error(0.6, 0.5) == 0.1
    # observed jammed -> target 1.0
    assert tm.brier(0.8, True) == round((0.8 - 1.0) ** 2, 4)
    assert tm.brier(0.2, False) == round(0.2 ** 2, 4)


def test_add_to_bucket_running_means():
    b = tm.new_bucket()
    b = tm.add_to_bucket(b, 0.1, 0.04)
    assert b["n"] == 1 and b["ratio_mae"] == 0.1 and b["brier"] == 0.04
    b = tm.add_to_bucket(b, 0.3, 0.16)
    assert b["n"] == 2 and b["ratio_mae"] == 0.2 and b["brier"] == 0.1
