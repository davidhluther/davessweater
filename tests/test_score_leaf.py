"""Pure-function tests for scripts/score_leaf.py (no network, no writes).

The scoring math itself is tested in test_leaf_model.py; what is tested here is
the join: which observations reach which towns, and whether the season summary
reports the direction of the error honestly.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from score_leaf import build, observation_covers, score_all, summarize

NOW = datetime(2026, 10, 20, 9, 0, 0)

PREDICTIONS = {
    "model_version": "leaf-v0-draft",
    "target_year": 2026,
    "predictions": [
        {"slug": "beech-mountain", "name": "Beech Mountain", "elevation_ft": 5436,
         "peak_start": "2026-09-28", "peak_center": "2026-10-03", "peak_end": "2026-10-08"},
        {"slug": "boone", "name": "Boone", "elevation_ft": 3333,
         "peak_start": "2026-10-12", "peak_center": "2026-10-17", "peak_end": "2026-10-22"},
        {"slug": "wilkesboro", "name": "Wilkesboro", "elevation_ft": 1024,
         "peak_start": "2026-10-27", "peak_center": "2026-11-01", "peak_end": "2026-11-06"},
    ],
}


# ── which observations reach which towns ────────────────────────────────────

def test_slug_observation_matches_only_that_town():
    obs = {"slug": "boone", "observed": "2026-10-17"}
    assert observation_covers(obs, PREDICTIONS["predictions"][1])
    assert not observation_covers(obs, PREDICTIONS["predictions"][0])


def test_band_observation_matches_every_town_inside_it():
    obs = {"applies_to_elevation_ft": {"min": 3000, "max": 6000}, "observed": "2026-10-10"}
    covered = [p["slug"] for p in PREDICTIONS["predictions"] if observation_covers(obs, p)]
    assert covered == ["beech-mountain", "boone"]


def test_band_bounds_are_inclusive():
    obs = {"applies_to_elevation_ft": {"min": 3333, "max": 3333}}
    assert observation_covers(obs, PREDICTIONS["predictions"][1])


def test_open_ended_band_is_allowed():
    obs = {"applies_to_elevation_ft": {"min": 5000}}
    covered = [p["slug"] for p in PREDICTIONS["predictions"] if observation_covers(obs, p)]
    assert covered == ["beech-mountain"]


def test_observation_with_neither_slug_nor_band_matches_nothing():
    assert not observation_covers({"observed": "2026-10-17"}, PREDICTIONS["predictions"][0])


# ── scoring the join ────────────────────────────────────────────────────────

def test_score_all_grades_a_band_observation_across_its_towns():
    obs = {"observations": [{
        "applies_to_elevation_ft": {"min": 4500, "max": 6000},
        "observed": {"start": "2026-10-01", "end": "2026-10-07"},
        "source_id": "fall-color-grandfather", "observed_on": "2026-10-05",
    }]}
    rows = score_all(PREDICTIONS, obs)
    assert len(rows) == 1
    row = rows[0]
    assert row["slug"] == "beech-mountain"
    assert row["source_id"] == "fall-color-grandfather"
    assert row["window_hit"] is True
    assert row["score"] == 100.0


def test_score_all_skips_observations_with_no_observed_date():
    obs = {"observations": [{"slug": "boone", "source_id": "x"}]}
    assert score_all(PREDICTIONS, obs) == []


def test_two_sources_on_one_town_produce_two_rows_not_an_average():
    """Sources disagree; averaging before scoring would hide that."""
    obs = {"observations": [
        {"slug": "boone", "observed": "2026-10-17", "source_id": "a"},
        {"slug": "boone", "observed": "2026-10-25", "source_id": "b"},
    ]}
    rows = score_all(PREDICTIONS, obs)
    assert [r["source_id"] for r in rows] == ["a", "b"]
    assert rows[0]["score"] > rows[1]["score"]


def test_rows_are_ordered_high_elevation_first():
    obs = {"observations": [{"applies_to_elevation_ft": {"min": 0}, "observed": "2026-10-17"}]}
    rows = score_all(PREDICTIONS, obs)
    assert [r["slug"] for r in rows] == ["beech-mountain", "boone", "wilkesboro"]


# ── the season summary ──────────────────────────────────────────────────────

def test_summary_of_nothing_is_null_not_zero():
    """A zero mean score would read as 'the model was wrong', not 'no data'."""
    s = summarize([])
    assert s["scored_rows"] == 0
    assert s["mean_score"] is None
    assert s["window_hit_rate"] is None


def test_summary_signed_error_keeps_its_direction():
    rows = [
        {"slug": "a", "score": 100.0, "abs_error_days": 2, "signed_error_days": -2, "window_hit": True},
        {"slug": "b", "score": 88.0, "abs_error_days": 5, "signed_error_days": -5, "window_hit": True},
    ]
    s = summarize(rows)
    # Both calls landed early; the mean must say early, not just "3.5 days off".
    assert s["mean_signed_error_days"] == -3.5
    assert s["mean_abs_error_days"] == 3.5
    assert s["window_hit_rate"] == 1.0
    assert s["towns_scored"] == 2


def test_summary_signed_errors_can_cancel_while_absolute_does_not():
    rows = [
        {"slug": "a", "score": 100.0, "abs_error_days": 4, "signed_error_days": 4, "window_hit": True},
        {"slug": "b", "score": 100.0, "abs_error_days": 4, "signed_error_days": -4, "window_hit": False},
    ]
    s = summarize(rows)
    assert s["mean_signed_error_days"] == 0.0
    assert s["mean_abs_error_days"] == 4.0
    assert s["window_hit_rate"] == 0.5


# ── the artifact ────────────────────────────────────────────────────────────

def test_build_carries_model_provenance_onto_the_scoreboard():
    out = build(PREDICTIONS, {"updated": "2026-10-20", "observations": []}, NOW)
    assert out["model_version"] == "leaf-v0-draft"
    assert out["target_year"] == 2026
    assert out["observations_updated"] == "2026-10-20"
    assert out["scores"] == []


def test_shipped_observations_file_is_valid_and_starts_empty():
    path = Path(__file__).resolve().parent.parent / "data" / "leaf" / "observations.json"
    data = json.loads(path.read_text())
    assert data["target_year"] == 2026
    assert isinstance(data["observations"], list)
    # Every entry, whenever they arrive, must name where it was read.
    for entry in data["observations"]:
        assert entry.get("source_id"), "an observation with no source is not an observation"
        assert entry.get("observed")
