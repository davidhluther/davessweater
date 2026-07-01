"""Replay snow-day scenarios through the scoring engine.

The coupled snow-depth path (scoring.py: _snow_tol + the _amount_points snow
branch + the rain/snow type cascade) has never scored a real committed day — snow
is rare in the tracked window, and the two Ray snow days were graded under the
legacy pre-snow model. This exercises that path directly so a bug can't debut
unnoticed in winter (R12)."""
from scoring import score_prediction, precip_type


def P(**kw):
    base = {"high_f": None, "low_f": None, "wind_mph": None, "precip_type": None,
            "rain_in": None, "snow_in": None, "fields_provided": []}
    base.update(kw)
    return base


# A snowy day: 6" of snow, no rain. _snow_tol = max(1.0, 20% of 6.0) = 1.2".
SNOW = {"high_f": 30, "low_f": 18, "wind_mph": 8, "rain_in": 0.0, "snow_in": 6.0}
SNOW_FP = ["high", "low", "wind", "precip_type", "snow_amount"]


def test_actual_type_derives_as_snow():
    assert precip_type(SNOW["rain_in"], SNOW["snow_in"]) == "snow"


def test_perfect_snow_forecast_scores_100():
    pred = P(high_f=30, low_f=18, wind_mph=8, precip_type="snow", snow_in=6.0, fields_provided=SNOW_FP)
    assert score_prediction(pred, SNOW)["score"] == 100.0


def test_snow_amount_within_tolerance_earns_full_amount():
    # 1" off, tolerance 1.2" -> full 10 amount points.
    pred = P(high_f=30, low_f=18, wind_mph=8, precip_type="snow", snow_in=7.0, fields_provided=SNOW_FP)
    assert score_prediction(pred, SNOW)["breakdown"]["precip_amount"]["points"] == 10.0


def test_snow_amount_beyond_tolerance_is_penalized_not_forfeited():
    # 4" off: (4.0 - 1.2) * SNOW_SLOPE 2.0 = 5.6 -> 10 - 5.6 = 4.4 (scored, partial).
    pred = P(high_f=30, low_f=18, wind_mph=8, precip_type="snow", snow_in=10.0, fields_provided=SNOW_FP)
    pts = score_prediction(pred, SNOW)["breakdown"]["precip_amount"]["points"]
    assert pts == 4.4


def test_rain_forecast_on_a_snow_day_gets_partial_type_and_forfeits_amount():
    # Right that *something* fell, wrong form -> type 4/10. A rain forecast carries
    # rain_amount, not snow_amount, so the snow amount is forfeited (None), not zeroed.
    pred = P(high_f=30, low_f=18, wind_mph=8, precip_type="rain", rain_in=0.5,
             fields_provided=["high", "low", "wind", "precip_type", "rain_amount"])
    r = score_prediction(pred, SNOW)
    assert r["breakdown"]["precip_type"]["points"] == 4.0
    assert r["breakdown"]["precip_amount"]["points"] is None


def test_forecasting_dry_on_a_snow_day_scores_type_zero():
    pred = P(high_f=30, low_f=18, wind_mph=8, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"])
    assert score_prediction(pred, SNOW)["breakdown"]["precip_type"]["points"] == 0.0


def test_mixed_precip_day_scores_type_and_both_amounts():
    # Rain 0.3" + snow 2.0" -> mixed. Amount splits 5/5 across rain and snow bands.
    actual = {"high_f": 34, "low_f": 30, "wind_mph": 5, "rain_in": 0.3, "snow_in": 2.0}
    assert precip_type(actual["rain_in"], actual["snow_in"]) == "mixed"
    pred = P(high_f=34, low_f=30, wind_mph=5, precip_type="mixed", rain_in=0.3, snow_in=2.0,
             fields_provided=["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"])
    r = score_prediction(pred, actual)
    assert r["breakdown"]["precip_type"]["points"] == 10.0
    assert r["breakdown"]["precip_amount"]["scored"] is True
    assert r["score"] == 100.0
