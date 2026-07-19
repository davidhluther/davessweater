"""M5 multi-location pipeline: registry validity + the location scoring path.
The scorer must be the SAME rubric as Boone's (same _to_contract + score_prediction),
so these tests replay a synthetic town-day and check scores, the bucket-low
recovery, the no-ghosts rule, and the rebuilt scores.json shape."""
import json

import pytest

from compare_locations import rebuild_scores, score_location_date
from locations import load_locations

LOC = {"slug": "testville", "name": "Testville", "lat": 36.1, "lon": -81.6,
       "provenance": "test fixture"}

ACTUALS = {"date": "2026-07-10", "high_f": 80.0, "low_f": 60.0, "wind_mph": 5.0,
           "rain_in": 0.0, "snow_in": 0.0, "precip_type": "none"}


def _write_pred(base, slug, date, key, rows):
    d = base / slug / "predictions" / date
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{key}_forecast.json").write_text(json.dumps(
        {"source": key, "label": key, "location": "Testville", "daily": rows}))


def _row(date, **kw):
    row = {"date": date, "high_f": 80, "low_f": 60, "wind_mph": 5,
           "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
           "fields_provided": ["high", "low", "wind", "precip_type",
                               "rain_amount", "snow_amount"]}
    row.update(kw)
    return row


def test_registry_loads_and_is_valid():
    locs = load_locations()
    slugs = [l["slug"] for l in locs]
    assert len(slugs) == len(set(slugs))
    assert "boone" not in slugs
    for loc in locs:
        assert loc["provenance"], "every pin needs coordinate provenance"
        # Five-county coverage sanity box (Watauga/Ashe/Avery/Mitchell/Wilkes/
        # Yancey, Burnsville west to N. Wilkesboro east) — a wrong-state
        # geocode fails loudly. Widened deliberately 2026-07-19.
        assert 35.85 < loc["lat"] < 36.55 and -82.45 < loc["lon"] < -81.05


def test_perfect_town_day_scores_100_and_writes_comparison(tmp_path):
    _write_pred(tmp_path, "testville", "2026-07-10", "openmeteo", [_row("2026-07-10")])
    _write_pred(tmp_path, "testville", "2026-07-10", "nws", [_row("2026-07-10")])
    comp = score_location_date(LOC, "2026-07-10", ACTUALS, base=tmp_path)
    assert comp["sources"]["openmeteo"]["score"]["score"] == 100.0
    assert comp["sources"]["nws"]["score"]["score"] == 100.0
    # two members -> the DSI composite attaches, same as Boone
    assert "composite" in comp["sources"]
    assert (tmp_path / "testville" / "comparisons" / "2026-07-10.json").exists()
    assert (tmp_path / "testville" / "actuals" / "2026-07-10.json").exists()


def test_bucket_low_recovered_from_day_ahead_capture(tmp_path):
    # metno's capture-day low comes from the PRIOR morning's capture (R11 rule)
    _write_pred(tmp_path, "testville", "2026-07-09", "metno",
                [_row("2026-07-09"), _row("2026-07-10", low_f=60)])
    _write_pred(tmp_path, "testville", "2026-07-10", "metno",
                [_row("2026-07-10", low_f=72)])  # afternoon-biased bucket low
    comp = score_location_date(LOC, "2026-07-10", ACTUALS, base=tmp_path)
    bd = comp["sources"]["metno"]["score"]["breakdown"]["low_temp"]
    assert bd["predicted"] == 60 and bd["points"] == 30.0


def test_bucket_low_forfeited_without_prior_capture(tmp_path):
    _write_pred(tmp_path, "testville", "2026-07-10", "metno",
                [_row("2026-07-10", low_f=72)])
    comp = score_location_date(LOC, "2026-07-10", ACTUALS, base=tmp_path)
    assert comp["sources"]["metno"]["score"]["coverage"]["low_temp"] is False


def test_no_ghost_comparison_when_nothing_scoreable(tmp_path):
    (tmp_path / "testville" / "predictions" / "2026-07-10").mkdir(parents=True)
    assert score_location_date(LOC, "2026-07-10", ACTUALS, base=tmp_path) is None
    assert not (tmp_path / "testville" / "comparisons" / "2026-07-10.json").exists()


def test_rebuild_scores_matches_boone_shape(tmp_path):
    _write_pred(tmp_path, "testville", "2026-07-10", "openmeteo", [_row("2026-07-10")])
    _write_pred(tmp_path, "testville", "2026-07-10", "nws",
                [_row("2026-07-10", high_f=90)])  # 10°F miss -> 30-(8*3)=6 -> 76
    score_location_date(LOC, "2026-07-10", ACTUALS, base=tmp_path)
    scores = rebuild_scores(LOC, base=tmp_path)
    assert scores["location_slug"] == "testville"
    assert scores["totals"]["openmeteo"]["days"] == 1
    assert scores["totals"]["openmeteo"]["total_score"] == 100.0
    assert scores["totals"]["nws"]["right"] == 1  # 76 -> "right" band
    assert scores["entries"][0]["date"] == "2026-07-10"
    # entries-vs-totals invariant, same as tests/test_scores_consistency.py
    for src, t in scores["totals"].items():
        evals = [e[src] for e in scores["entries"] if isinstance(e.get(src), (int, float))]
        assert len(evals) == t["days"]
        assert abs(sum(evals) - t["total_score"]) < 0.5
