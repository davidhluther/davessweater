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

from score_leaf import build, grading_source_ids, observation_covers, score_all, summarize

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
    rows, _ = score_all(PREDICTIONS, obs)
    assert len(rows) == 1
    row = rows[0]
    assert row["slug"] == "beech-mountain"
    assert row["source_id"] == "fall-color-grandfather"
    assert row["window_hit"] is True
    assert row["score"] == 100.0


def test_score_all_skips_observations_with_no_observed_date():
    obs = {"observations": [{"slug": "boone", "source_id": "x"}]}
    rows, rejected = score_all(PREDICTIONS, obs)
    assert rows == []
    assert rejected[0]["reason"] == "no observed date"


def test_two_sources_on_one_town_produce_two_rows_not_an_average():
    """Sources disagree; averaging before scoring would hide that."""
    obs = {"observations": [
        {"slug": "boone", "observed": "2026-10-17", "source_id": "a"},
        {"slug": "boone", "observed": "2026-10-25", "source_id": "b"},
    ]}
    rows, _ = score_all(PREDICTIONS, obs)
    assert [r["source_id"] for r in rows] == ["a", "b"]
    assert rows[0]["score"] > rows[1]["score"]


def test_rows_are_ordered_high_elevation_first():
    obs = {"observations": [{"applies_to_elevation_ft": {"min": 0}, "observed": "2026-10-17",
                             "source_id": "fall-color-grandfather"}]}
    rows, _ = score_all(PREDICTIONS, obs)
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


def test_shipped_observations_file_is_valid():
    path = Path(__file__).resolve().parent.parent / "data" / "leaf" / "observations.json"
    data = json.loads(path.read_text())
    assert data["target_year"] == 2026
    assert isinstance(data["observations"], list)
    # Every entry, whenever they arrive, must name where it was read, and must
    # either name a peak date/band (`observed`) or be an explicit one-sided
    # `constraint` recorded deliberately without one (see hard_rules).
    for entry in data["observations"]:
        assert entry.get("source_id"), "an observation with no source is not an observation"
        assert entry.get("observed") or entry.get("constraint"), (
            "an observation must carry either `observed` or an explicit `constraint`"
        )


# ── the benchmark guard: a forecast may never be scored as an observation ────

def test_grading_source_ids_selects_only_grading_purpose():
    registry = {"grading_sources": [
        {"id": "real", "purpose": "leaf-model grading"},
        {"id": "forecast", "purpose": "leaf-model benchmark"},
        {"id": "unrelated", "purpose": "something else"},
    ]}
    assert grading_source_ids(registry) == {"real"}


def test_grading_source_ids_of_nothing_is_empty():
    assert grading_source_ids(None) == set()
    assert grading_source_ids({}) == set()


def test_observation_from_a_benchmark_source_is_refused_with_a_reason():
    """The 2026-08-31 finding, encoded: High Country Host publishes a static
    elevation-to-week prediction, not observations. Scoring against it would
    measure whether two forecasts agree, which is not grading."""
    obs = {"observations": [{
        "slug": "boone", "observed": "2026-10-17",
        "source_id": "fall-color-highcountryhost",
    }]}
    rows, rejected = score_all(PREDICTIONS, obs, {"fall-color-grandfather"})
    assert rows == []
    assert len(rejected) == 1
    assert "fall-color-highcountryhost" in rejected[0]["reason"]


def test_an_allowed_source_still_scores_alongside_a_refused_one():
    obs = {"observations": [
        {"slug": "boone", "observed": "2026-10-17", "source_id": "fall-color-highcountryhost"},
        {"slug": "boone", "observed": "2026-10-17", "source_id": "fall-color-grandfather"},
    ]}
    rows, rejected = score_all(PREDICTIONS, obs, {"fall-color-grandfather"})
    assert [r["source_id"] for r in rows] == ["fall-color-grandfather"]
    assert len(rejected) == 1


def test_refusals_are_published_in_the_artifact_not_swallowed():
    obs = {"updated": "2026-10-20", "observations": [
        {"slug": "boone", "observed": "2026-10-17", "source_id": "nope"},
    ]}
    out = build(PREDICTIONS, obs, NOW, {"fall-color-grandfather"})
    assert out["scores"] == []
    assert len(out["rejected_observations"]) == 1


def test_live_registry_has_at_least_one_grading_source():
    """If every source were demoted, scoring would silently become a no-op."""
    import json as _json
    from pathlib import Path as _Path
    registry = _json.loads(
        (_Path(__file__).resolve().parent.parent / "data" / "events" / "registry.json").read_text()
    )
    assert grading_source_ids(registry), "no registry source carries a leaf-model grading purpose"


def test_live_registry_keeps_the_prediction_only_source_out_of_grading():
    """Guards the 2026-08-31 demotion against a well-meaning revert."""
    import json as _json
    from pathlib import Path as _Path
    registry = _json.loads(
        (_Path(__file__).resolve().parent.parent / "data" / "events" / "registry.json").read_text()
    )
    assert "fall-color-highcountryhost" not in grading_source_ids(registry)


# ── the year gate: a prior season's facts must not score the live season ────

def test_observation_from_a_different_year_is_refused_with_a_reason():
    obs = {"observations": [{
        "slug": "boone", "observed": "2025-10-17", "year": 2025,
        "source_id": "fall-color-grandfather",
    }]}
    rows, rejected = score_all(PREDICTIONS, obs, {"fall-color-grandfather"})
    assert rows == []
    assert len(rejected) == 1
    assert "2025" in rejected[0]["reason"] and "2026" in rejected[0]["reason"]


def test_observation_with_matching_year_still_scores():
    obs = {"observations": [{
        "slug": "boone", "observed": "2026-10-17", "year": 2026,
        "source_id": "fall-color-grandfather",
    }]}
    rows, rejected = score_all(PREDICTIONS, obs, {"fall-color-grandfather"})
    assert len(rows) == 1
    assert rejected == []


def test_observation_with_no_year_field_still_scores():
    """Most observations won't bother stamping a year; only the fallcolorguy.org
    2025 backcast rows need it, to keep them out of live 2026 scoring."""
    obs = {"observations": [{
        "slug": "boone", "observed": "2026-10-17",
        "source_id": "fall-color-grandfather",
    }]}
    rows, rejected = score_all(PREDICTIONS, obs, {"fall-color-grandfather"})
    assert len(rows) == 1
    assert rejected == []


def test_live_registry_flags_fallcolorguy_internal_only():
    """The owner's no-cite ruling (2026-09-03): fallcolorguy.org may be used as
    a grading source but must never be named or linked on a public page."""
    import json as _json
    from pathlib import Path as _Path
    registry = _json.loads(
        (_Path(__file__).resolve().parent.parent / "data" / "events" / "registry.json").read_text()
    )
    sources = {s["id"]: s for s in registry["grading_sources"]}
    assert "fall-color-fallcolorguy" in sources
    assert sources["fall-color-fallcolorguy"]["internal_only"] is True
    assert "fall-color-fallcolorguy" in grading_source_ids(registry), (
        "internal_only must not exclude it from score_leaf.py's grading -- only "
        "from the public page (src/lib/leaf.ts filters that separately)"
    )


def test_backfilled_2025_observations_carry_a_year_and_are_never_joined_live():
    """The four fallcolorguy.org 2025 rows are provenance, not live grading
    input -- guards against a well-meaning edit dropping the `year` field."""
    path = Path(__file__).resolve().parent.parent / "data" / "leaf" / "observations.json"
    data = json.loads(path.read_text())
    rows_2025 = [o for o in data["observations"] if o.get("source_id") == "fall-color-fallcolorguy"]
    assert len(rows_2025) == 6  # rows A-F from the benchmark doc's §3a
    for row in rows_2025:
        assert row.get("year") == 2025, "every backfilled fallcolorguy.org row must be year-stamped"
    rows, rejected = score_all(PREDICTIONS, data, grading_source_ids({
        "grading_sources": [{"id": "fall-color-fallcolorguy", "purpose": "leaf-model grading"}]
    }))
    assert rows == [], "2025 backcast rows must never score against 2026 predictions"


def test_shipped_observations_carry_their_evidence():
    """Whoever recorded it, a reading has to be auditable against its page."""
    path = Path(__file__).resolve().parent.parent / "data" / "leaf" / "observations.json"
    data = json.loads(path.read_text())
    for entry in data["observations"]:
        assert entry.get("source_id"), "an observation with no source is not an observation"
        assert entry.get("source_url"), "an observation must name the page it was read from"
        assert entry.get("evidence"), "an observation must say what the source actually said"
