"""test_roads.py — road-condition forecast rubric + ordinal scorer (pure logic).

scripts/ is on sys.path via conftest.py, so `import roads` resolves directly.
"""

from roads import LEVELS, road_condition_forecast, score_road_forecast


def fc(**kw):
    base = {"low_f": 40, "high_f": 55, "snow_in": 0.0, "rain_in": 0.0, "precip_type": "none"}
    base.update(kw)
    return base


# --- rubric -------------------------------------------------------------------

def test_dry_warm_is_clear():
    r = road_condition_forecast(fc())
    assert r["level"] == "Clear"


def test_plain_rain_above_freezing_is_wet():
    r = road_condition_forecast(fc(rain_in=0.3, low_f=40, precip_type="rain"))
    assert r["level"] == "Wet"


def test_light_snow_near_freezing_is_slushy():
    r = road_condition_forecast(fc(snow_in=0.6, low_f=32, precip_type="snow"))
    assert r["level"] == "Slushy"


def test_cold_wet_refreeze_is_icy():
    r = road_condition_forecast(fc(rain_in=0.2, low_f=28, precip_type="rain"))
    assert r["level"] == "Icy"


def test_heavy_snow_is_hazardous():
    r = road_condition_forecast(fc(snow_in=3.0, low_f=25, precip_type="snow"))
    assert r["level"] == "Hazardous"


def test_freezing_rain_is_hazardous():
    # rain falling into sub-freezing air = the worst case
    r = road_condition_forecast(fc(rain_in=0.15, low_f=30, precip_type="rain", freezing=True))
    assert r["level"] == "Hazardous"


def test_reason_and_risk_present():
    r = road_condition_forecast(fc(snow_in=3.0, low_f=25))
    assert isinstance(r["reason"], str) and r["reason"]
    assert 0 <= r["risk"] <= 100
    assert r["level"] in LEVELS


def test_moderate_snow_cold_is_icy():
    # >= icy_snow_in (0.5") of snow with a cold low, under the hazard threshold
    r = road_condition_forecast(fc(snow_in=1.0, low_f=26, precip_type="snow"))
    assert r["level"] == "Icy"


def test_missing_low_does_not_crash():
    r = road_condition_forecast({"snow_in": 0.0, "rain_in": 0.0, "precip_type": "none"})
    assert r["level"] == "Clear"


# --- scorer -------------------------------------------------------------------

def test_exact_match_full_score():
    assert score_road_forecast("Icy", "Icy")["score"] == 100


def test_adjacent_partial_score():
    s = score_road_forecast("Icy", "Slushy")["score"]  # off by one level
    assert 50 <= s < 100


def test_far_miss_low_score():
    s = score_road_forecast("Clear", "Hazardous")["score"]  # off by four
    assert s == 0


def test_score_is_symmetric():
    assert score_road_forecast("Wet", "Icy")["score"] == score_road_forecast("Icy", "Wet")["score"]
