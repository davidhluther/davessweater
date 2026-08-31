"""Pure-function tests for scripts/compute_busyness.py (no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from compute_busyness import (
    band,
    build_horizon,
    events_component,
    is_defunct,
    is_superseded,
    leaf_component,
    leaf_peak_share,
    score_hotel,
    score_str,
    weather_note,
    alerts_overlapping,
)


# ── hotel component ─────────────────────────────────────────────────────────

def test_score_hotel_scales_fraction_to_40():
    assert score_hotel({"2026-08-15": 0.957}, "2026-08-15") == 0.957 * 40
    assert score_hotel({"2026-08-15": 1.0}, "2026-08-15") == 40.0
    assert score_hotel({"2026-08-15": 0.0}, "2026-08-15") == 0.0


def test_score_hotel_missing_or_none():
    assert score_hotel(None, "2026-08-15") == 0.0
    assert score_hotel({}, "2026-08-15") == 0.0
    assert score_hotel({"2026-08-14": 0.5}, "2026-08-15") == 0.0


# ── STR component ───────────────────────────────────────────────────────────

def test_score_str_mean_across_markets():
    fills = {"boone": {"2026-08-01": 0.8}, "blowing-rock": {"2026-08-01": 0.6}}
    assert score_str(fills, "2026-08-01") == 0.7 * 25


def test_score_str_caps_market_fill_at_one():
    fills = {"boone": {"2026-08-01": 1.4}, "blowing-rock": {"2026-08-01": 1.0}}
    # both cap to 1.0 -> mean 1.0 -> full 25
    assert score_str(fills, "2026-08-01") == 25.0


def test_score_str_missing():
    assert score_str(None, "2026-08-01") == 0.0
    assert score_str({"boone": {}}, "2026-08-01") == 0.0


# ── events component ────────────────────────────────────────────────────────

def _registry(events=None, seasons=None):
    return {"events": events or [], "seasons": seasons or []}


def test_events_magnitude_points_dates_list():
    reg = _registry(events=[
        {"id": "a", "name": "Major thing", "magnitude": "major", "dates": ["2026-08-15"]},
        {"id": "b", "name": "Minor thing", "magnitude": "minor", "dates": ["2026-08-15"]},
    ])
    ev = events_component(reg, None, "2026-08-15")
    assert ev["points"] == 24  # 20 + 4
    assert ev["ids"] == ["a", "b"]
    # ordered most-important-first
    assert ev["drivers"] == ["Major thing", "Minor thing"]


def test_events_date_range_span():
    reg = _registry(events=[
        {"id": "r", "name": "Ranged", "magnitude": "moderate",
         "date_range": {"start": "2026-07-28", "end": "2026-08-02"}},
    ])
    assert events_component(reg, None, "2026-07-30")["points"] == 10
    assert events_component(reg, None, "2026-08-05")["points"] == 0


def test_events_season_counts_half_magnitude():
    reg = _registry(seasons=[
        {"id": "ski", "name": "Ski season", "magnitude": "moderate",
         "date_range": {"start": "2026-11-20", "end": "2027-03-14"}},
    ])
    # moderate 10 -> half 5
    assert events_component(reg, None, "2026-12-01")["points"] == 5


def test_events_negative_subtracts():
    reg = _registry(events=[
        {"id": "big", "name": "Home football", "magnitude": "major", "dates": ["2026-11-25"],
         "type": "athletics"},
        {"id": "out", "name": "Thanksgiving break", "magnitude": "moderate",
         "demand_sign": "negative", "dates": ["2026-11-25"]},
    ])
    ev = events_component(reg, None, "2026-11-25")
    assert ev["points"] == 10  # 20 positive - 10 negative
    # negative driver still surfaces, ordered by magnitude
    assert ev["drivers"][0] == "Home football"
    assert "Thanksgiving break" in ev["drivers"]


def test_events_positive_pool_capped_at_30():
    reg = _registry(events=[
        {"id": "a", "name": "A", "magnitude": "major", "dates": ["2026-08-15"]},
        {"id": "b", "name": "B", "magnitude": "major", "dates": ["2026-08-15"]},
    ])
    # 20 + 20 = 40 capped to 30
    assert events_component(reg, None, "2026-08-15")["points"] == 30


def test_events_skips_defunct():
    reg = _registry(events=[
        {"id": "todd", "name": "Todd Festival - LIKELY DEFUNCT", "magnitude": "minor",
         "dates": ["2026-08-15"]},
    ])
    assert events_component(reg, None, "2026-08-15")["points"] == 0


def test_is_defunct_detects_name_and_flag():
    assert is_defunct({"name": "X - LIKELY DEFUNCT"}) is True
    assert is_defunct({"name": "X", "provenance": {"flag": "treat as discontinued"}}) is True
    assert is_defunct({"name": "Normal event"}) is False


def test_events_athletics_home_game_from_feed():
    athletics = {"feeds": {"mbb": [
        {"uid": "g1", "summary": "App State MBB vs X", "home": True,
         "start": "2026-08-15T23:30:00+00:00"},
        {"uid": "g2", "summary": "away", "home": False,
         "start": "2026-08-15T23:30:00+00:00"},
    ]}}
    ev = events_component(_registry(), athletics, "2026-08-15")
    assert ev["points"] == 4  # minor home basketball
    assert ev["ids"] == ["g1"]
    assert ev["drivers"] == ["App State home men's basketball"]


def test_events_football_not_double_counted():
    # Registry snapshot has the football Saturday AND the feed has the same game.
    reg = _registry(events=[
        {"id": "asu-fb", "name": "App State home football", "type": "athletics",
         "magnitude": "major", "dates": ["2026-09-05"]},
    ])
    athletics = {"feeds": {"football": [
        {"uid": "fbg", "summary": "vs Maine", "home": True,
         "start": "2026-09-05T19:30:00+00:00"},
    ]}}
    ev = events_component(reg, athletics, "2026-09-05")
    assert ev["points"] == 20  # counted once, not 40
    assert ev["ids"] == ["asu-fb"]


# ── bands ───────────────────────────────────────────────────────────────────

def test_band_edges():
    assert band(34) == "calm"
    assert band(35) == "typical"
    assert band(54) == "typical"
    assert band(55) == "busy"
    assert band(74) == "busy"
    assert band(75) == "slammed"
    assert band(100) == "slammed"


# ── alerts + weather drivers ────────────────────────────────────────────────

def test_alerts_overlapping_span_and_counties():
    alerts = [{"event": "Winter Storm Warning", "counties": ["Watauga"],
               "onset": "2026-12-01T18:00:00-05:00", "ends": "2026-12-02T12:00:00-05:00"}]
    assert alerts_overlapping(alerts, "2026-12-01") == ["Winter Storm Warning (Watauga)"]
    assert alerts_overlapping(alerts, "2026-12-05") == []
    assert alerts_overlapping(None, "2026-12-01") == []


def test_weather_note_only_when_significant():
    days = [{"date": "2026-08-01", "sky": "rain",
             "hourly": [{"hour": 12, "prob": 70, "inches": 0.2}]}]
    note = weather_note(days, "2026-08-01")
    assert note is not None and "rain" in note and "70%" in note
    dry = [{"date": "2026-08-01", "sky": "clear",
            "hourly": [{"hour": 12, "prob": 5, "inches": 0.0}]}]
    assert weather_note(dry, "2026-08-01") is None


# ── assembly / missing inputs ───────────────────────────────────────────────

def test_build_horizon_length_and_weekend_bonus():
    horizon = build_horizon(date(2026, 7, 25), None, None, None, None, None, None)
    assert len(horizon) == 14
    # 2026-07-25 is a Saturday -> weekend bonus 5, everything else 0 -> score 5
    first = horizon[0]
    assert first["date"] == "2026-07-25"
    assert first["components"]["weekend"] == 5.0
    assert first["score"] == 5
    assert first["band"] == "calm"


def test_build_horizon_all_missing_scores_are_low():
    horizon = build_horizon(date(2026, 7, 27), None, None, None, None, None, None)
    # Mon 07-27, no inputs -> score 0 calm
    assert horizon[0]["score"] == 0
    assert horizon[0]["band"] == "calm"
    assert horizon[0]["drivers"] == []


def test_build_horizon_full_stack_integration():
    hotel = {"2026-08-15": 0.957}
    fills = {"boone": {"2026-08-15": 0.9}, "blowing-rock": {"2026-08-15": 0.9}}
    reg = _registry(events=[
        {"id": "movein", "name": "Move-in", "magnitude": "major", "dates": ["2026-08-15"]},
        {"id": "aip", "name": "Art in the Park", "magnitude": "minor", "dates": ["2026-08-15"]},
    ])
    horizon = build_horizon(date(2026, 8, 15), hotel, fills, reg, None, [], None)
    day = horizon[0]  # Saturday 08-15
    # hotel 0.957*40=38.3, str 0.9*25=22.5, events 24, weekend 5 -> 89.8 -> 90
    assert day["components"]["hotel"] == 38.3
    assert day["components"]["str"] == 22.5
    assert day["components"]["events"] == 24
    assert day["score"] == 90
    assert day["band"] == "slammed"
    assert "96% of hotels price this date high" in day["drivers"]
    assert any("STRs" in d for d in day["drivers"])


# ── leaf component ──────────────────────────────────────────────────────────

# Two towns, deliberately non-overlapping windows, so a date can put exactly
# half the footprint at peak and the share arithmetic is checkable by hand.
LEAF = {
    "target_year": 2026,
    "predictions": [
        {"slug": "beech-mountain", "peak_start": "2026-09-28", "peak_end": "2026-10-08"},
        {"slug": "wilkesboro", "peak_start": "2026-10-27", "peak_end": "2026-11-06"},
    ],
}


def test_leaf_peak_share_counts_covering_windows():
    assert leaf_peak_share(LEAF, "2026-10-01") == 0.5
    assert leaf_peak_share(LEAF, "2026-11-01") == 0.5
    assert leaf_peak_share(LEAF, "2026-10-15") == 0.0


def test_leaf_peak_share_includes_both_window_endpoints():
    # The window is inclusive at both ends; peak_start and peak_end are peak days.
    assert leaf_peak_share(LEAF, "2026-09-28") == 0.5
    assert leaf_peak_share(LEAF, "2026-10-08") == 0.5
    assert leaf_peak_share(LEAF, "2026-09-27") == 0.0
    assert leaf_peak_share(LEAF, "2026-10-09") == 0.0


def test_leaf_peak_share_missing_model_is_zero_not_guessed():
    assert leaf_peak_share(None, "2026-10-17") == 0.0
    assert leaf_peak_share({}, "2026-10-17") == 0.0
    assert leaf_peak_share({"predictions": []}, "2026-10-17") == 0.0


def test_leaf_component_scales_share_to_max_and_names_the_count():
    out = leaf_component(LEAF, "2026-10-01")
    assert out["points"] == 7.5  # half the towns * LEAF_MAX 15
    assert out["drivers"] == ["Predicted peak color at 1 of 2 tracked towns"]


def test_leaf_component_out_of_season_contributes_nothing():
    out = leaf_component(LEAF, "2026-07-04")
    assert out["points"] == 0.0
    assert out["drivers"] == []


def test_leaf_component_full_footprint_earns_the_cap():
    everywhere = {"predictions": [
        {"slug": "a", "peak_start": "2026-10-16", "peak_end": "2026-10-20"},
        {"slug": "b", "peak_start": "2026-10-15", "peak_end": "2026-10-21"},
    ]}
    assert leaf_component(everywhere, "2026-10-18")["points"] == 15.0


def test_build_horizon_scores_the_leaf_term_and_names_it():
    horizon = build_horizon(date(2026, 10, 1), None, None, None, None, None, None, LEAF)
    day = horizon[0]
    assert day["components"]["leaf"] == 7.5
    assert "Predicted peak color at 1 of 2 tracked towns" in day["drivers"]


def test_build_horizon_leaf_defaults_off_when_model_absent():
    horizon = build_horizon(date(2026, 10, 1), None, None, None, None, None, None)
    assert horizon[0]["components"]["leaf"] == 0.0


# ── superseded registry rows ────────────────────────────────────────────────

def test_is_superseded_only_when_a_model_owns_the_row():
    assert is_superseded({"superseded_by": "data/leaf/predictions.json"})
    assert not is_superseded({})
    assert not is_superseded({"superseded_by": ""})


def test_superseded_season_does_not_double_count_against_the_model():
    """The flat leaf placeholder and the model describe the same fact. The
    engine must take one of them, and it takes the model."""
    reg = {"events": [], "seasons": [{
        "id": "leaf-season-2026", "name": "Leaf season",
        "date_range": {"start": "2026-10-01", "end": "2026-11-01"},
        "superseded_by": "data/leaf/predictions.json",
    }]}
    out = events_component(reg, None, "2026-10-17")
    assert out["points"] == 0.0
    assert out["drivers"] == []


def test_live_registry_leaf_season_is_superseded():
    """Guards the wiring itself: if someone drops the flag from the real
    registry, the season starts scoring twice and this fails."""
    import json
    from pathlib import Path as _Path
    registry = json.loads(
        (_Path(__file__).resolve().parent.parent / "data" / "events" / "registry.json").read_text()
    )
    leaf_rows = [s for s in registry["seasons"] if s["id"] == "leaf-season-2026"]
    assert leaf_rows, "the leaf season row disappeared from the registry"
    assert leaf_rows[0].get("superseded_by") == "data/leaf/predictions.json"
