"""Backfill of Ray's per-town sky-icon precip type: patch mechanics, idempotence,
and the scoring-contract integration that the whole repair depends on."""
import json

import backfill_rays_town_icons as bf
import compare
from capture_rays_locations import normalize_station
from scoring import score_prediction


STATION = {
    "stationId": "2", "stationName": "Blowing Rock",
    "forecastContent": {
        "26-07-18": {"high": 81, "low": 63, "date": "26-07-18", "golfballs": 3,
                     "iconDay": "Day/01_Dry/02_Few_Clouds.png",
                     "iconNight": "Night/01_Dry/03_Sct_Clouds.png"},
        "26-07-19": {"high": 79, "low": 62, "date": "26-07-19", "golfballs": 4,
                     "iconDay": "Day/03_Lightning/02_Sct_Thundershowers_PM.png",
                     "iconNight": "Night/03_Lightning/06_Night_TShrsPMSct.png"},
    },
}


def _fbd():
    return {r["date"]: r for r in normalize_station(STATION)}


# ── patch mechanics + idempotence ────────────────────────────────────────────

def test_merge_icons_is_idempotent():
    fetched = _fbd()["2026-07-18"]
    row = {"date": "2026-07-18", "high_f": 81, "low_f": 63, "golfballs": 3,
           "fields_provided": ["high", "low"]}
    bf._merge_icons(row, fetched)
    once = json.dumps(row, sort_keys=True)
    bf._merge_icons(row, fetched)  # second application must not change anything
    assert json.dumps(row, sort_keys=True) == once
    assert row["precip_type"] == "none"
    assert row["fields_provided"] == ["high", "low", "precip_type"]
    assert row["golfballs"] == 3  # preserved


def test_patch_prediction_file_adds_icons_and_reports_change(tmp_path):
    f = tmp_path / "raysweather_forecast.json"
    f.write_text(json.dumps({"source": "raysweather", "daily": [
        {"date": "2026-07-18", "high_f": 81, "low_f": 63, "golfballs": 3,
         "fields_provided": ["high", "low"]},
        {"date": "2026-07-19", "high_f": 79, "low_f": 62, "golfballs": 4,
         "fields_provided": ["high", "low"]},
    ]}))
    assert bf._patch_prediction_file(f, _fbd()) is True
    daily = json.loads(f.read_text())["daily"]
    assert daily[0]["precip_type"] == "none"          # dry icon
    assert daily[1]["precip_type"] == "rain"          # lightning icon
    assert daily[0]["icon_day"] == "Day/01_Dry/02_Few_Clouds.png"
    # second run is a no-op
    assert bf._patch_prediction_file(f, _fbd()) is False


def test_patch_comparison_file_syncs_stored_prediction(tmp_path):
    f = tmp_path / "2026-07-19.json"
    f.write_text(json.dumps({"date": "2026-07-19", "sources": {"raysweather": {
        "prediction": {"date": "2026-07-19", "high_f": 79, "low_f": 62,
                       "golfballs": 4, "fields_provided": ["high", "low"]},
        "score": {"score": 60.0}}}}))
    assert bf._patch_comparison_file(f, "2026-07-19", _fbd()) is True
    pred = json.loads(f.read_text())["sources"]["raysweather"]["prediction"]
    assert pred["precip_type"] == "rain"
    assert "precip_type" in pred["fields_provided"]
    assert bf._patch_comparison_file(f, "2026-07-19", _fbd()) is False  # idempotent


# ── the fairness payoff: Ray's icon now earns precip credit ───────────────────

def _ray_row(precip_type):
    """A patched Ray town row: high/low + icon-derived precip type, no amount."""
    return {"date": "2026-07-19", "high_f": 79, "low_f": 62, "golfballs": 4,
            "precip_type": precip_type, "fields_provided": ["high", "low", "precip_type"]}


def test_dry_icon_earns_full_precip_on_a_dry_day():
    # Ray's dry icon -> "none" -> implied-zero amount -> full 20 on a dry day,
    # exactly the credit Boone's pipeline gives him.
    actual = {"high_f": 79, "low_f": 62, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    res = score_prediction(compare._to_contract(_ray_row("none")), compare._normalize_actual(actual))
    assert res["breakdown"]["precip"]["points"] == 20.0
    assert res["coverage"]["precip"] is True


def test_dry_icon_credit_beats_the_old_forfeit():
    # Old behavior (no precip_type at all) forfeited the whole 20; the icon fixes it.
    actual = {"high_f": 79, "low_f": 62, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    old = {"date": "2026-07-19", "high_f": 79, "low_f": 62,
           "fields_provided": ["high", "low"]}
    norm = compare._normalize_actual(actual)
    old_score = score_prediction(compare._to_contract(old), norm)["score"]
    new_score = score_prediction(compare._to_contract(_ray_row("none")), norm)["score"]
    assert new_score > old_score
    assert new_score - old_score == 20.0


def test_wet_icon_earns_identification_but_forfeits_amount():
    # Ray's rain icon on a rainy day: 10-pt form ID, amount forfeited (no number).
    actual = {"high_f": 79, "low_f": 62, "wind_mph": 5, "rain_in": 0.30, "snow_in": 0.0}
    res = score_prediction(compare._to_contract(_ray_row("rain")), compare._normalize_actual(actual))
    assert res["breakdown"]["precip"]["points"] == 10.0
    assert res["coverage"]["precip"] is False  # amount never claimed -> no gain by omission


def test_wet_icon_on_a_dry_day_earns_no_precip():
    # Predicted rain, stayed dry -> honest 0 on precip (no free credit).
    actual = {"high_f": 79, "low_f": 62, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    res = score_prediction(compare._to_contract(_ray_row("rain")), compare._normalize_actual(actual))
    assert res["breakdown"]["precip"]["points"] == 0.0
