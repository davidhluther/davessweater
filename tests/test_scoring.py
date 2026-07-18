from scoring import score_prediction, precip_type

ACT = {"high_f": 84, "low_f": 61, "wind_mph": 6, "rain_in": 0.12, "snow_in": 0.0}

def P(**kw):
    base = {"high_f": None, "low_f": None, "wind_mph": None, "precip_type": None,
            "rain_in": None, "snow_in": None, "fields_provided": []}
    base.update(kw)
    return base

def test_perfect_committed_forecast_scores_100():
    pred = P(high_f=85, low_f=62, wind_mph=7, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["score"] == 100.0

def test_breakdown_carries_predicted_actual_error_deltas():
    pred = P(high_f=85, low_f=62, wind_mph=7, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    bd = score_prediction(pred, ACT)["breakdown"]
    assert bd["high_temp"]["predicted"] == 85 and bd["high_temp"]["actual"] == 84 and bd["high_temp"]["error"] == 1.0
    assert bd["precip_type"]["predicted"] == "rain" and bd["precip_type"]["actual"] == "rain"
    assert bd["precip_amount"]["predicted"] == 0.10 and bd["precip_amount"]["actual"] == 0.12 and bd["precip_amount"]["error"] == 0.02
    # a forfeited category still reports predicted=None
    pred2 = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
              fields_provided=["high","low","precip_type","rain_amount"])
    assert score_prediction(pred2, ACT)["breakdown"]["wind"]["predicted"] is None

def test_predicted_rain_without_amount_forfeits_amount():
    # Predicts rain but gives no total -> amount forfeited (scored as a miss, /100).
    pred = P(high_f=80, low_f=58, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["score"] == 81.0
    assert r["coverage"]["precip_amount"] is False
    assert r["coverage"]["precip_type"] is True

def test_omitted_wind_forfeits_its_category():
    # wind omitted -> 80/100 (no credit for a field never forecast).
    pred = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","precip_type","rain_amount"])
    r = score_prediction(pred, ACT)
    assert r["coverage"]["wind"] is False
    assert r["breakdown"]["wind"]["points"] is None
    assert r["score"] == 80.0


def test_predicted_rain_without_amount_cannot_exceed_90():
    # Perfect on high/low/wind/type but predicts rain with no total -> amount
    # forfeited -> caps at 90/100. A source can't win by leaving the hard field blank.
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["score"] == 90.0
    assert r["coverage"]["precip_amount"] is False
    assert r["grade"]["verdict"] == "right"


def test_no_precip_forecast_scores_amount_as_zero_inches():
    # "No rain" IS a zero-inch forecast: on a dry day it earns the full amount points.
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    r = score_prediction(pred, dry)
    assert r["breakdown"]["precip_amount"]["points"] == 10.0
    assert r["score"] == 100.0

def test_precision_not_punished_within_rain_tolerance():
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["breakdown"]["precip_amount"]["points"] == 10.0

def test_snow_scored_in_depth_with_coarse_tolerance():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="snow", snow_in=5.0,
             fields_provided=["high","low","wind","precip_type","snow_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip_amount"]["points"] == 10.0
    assert r["score"] == 100.0

def test_wrong_precip_form_gets_partial_type_credit():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="rain", rain_in=0.5,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip_type"]["points"] == 4.0

def test_none_forecast_on_trace_rain_day_gets_partial_type_credit():
    # Actual 0.03" is inside the amount tolerance (<= 0.1"), so a "none" forecast
    # is nearly right: 6/10 type, full amount — never 0/10 next to a 10/10.
    act = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.03, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip_type"]["points"] == 6.0
    assert r["breakdown"]["precip_amount"]["points"] == 10.0
    assert r["score"] == 96.0

def test_none_forecast_beyond_trace_band_still_misses_type():
    act = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.15, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    assert score_prediction(pred, act)["breakdown"]["precip_type"]["points"] == 0.0

def test_zero_qpf_rain_forecast_on_dry_day_gets_partial_type_credit():
    # The mirror case (e.g. a thunderstorm weather-code with 0" QPF, nothing fell).
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="rain", rain_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    r = score_prediction(pred, dry)
    assert r["breakdown"]["precip_type"]["points"] == 6.0
    assert r["breakdown"]["precip_amount"]["points"] == 10.0

def test_rain_forecast_without_amount_gets_no_trace_credit():
    # Names precip but omits the total -> can't claim the trace band (no gain by omission).
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    assert score_prediction(pred, dry)["breakdown"]["precip_type"]["points"] == 0.0

def test_none_forecast_on_sub_tolerance_snow_day_gets_partial_type_credit():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 0.8}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    assert score_prediction(pred, act)["breakdown"]["precip_type"]["points"] == 6.0
    act_heavy = dict(act, snow_in=3.0)
    assert score_prediction(pred, act_heavy)["breakdown"]["precip_type"]["points"] == 0.0

def test_precip_type_derivation():
    assert precip_type(0.2, 0.0) == "rain"
    assert precip_type(0.0, 3.0) == "snow"
    assert precip_type(0.1, 2.0) == "mixed"
    assert precip_type(0.0, 0.0) == "none"

def test_grade_band_labels_unchanged():
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["grade"]["verdict"] == "right"


def W(**kw):
    base = {"high_f":84,"low_f":61,"wind_mph":None,"precip_type":None,"rain_in":None,"snow_in":None,
            "fields_provided":["high","low","wind"]}
    base.update(kw); return base

ACTW = {"high_f":84,"low_f":61,"wind_mph":8.0,"rain_in":0.0,"snow_in":0.0}

def test_point_wind_unchanged():
    # a point forecast (wind_mph only) scores exactly as the old band
    assert score_prediction(W(wind_mph=8.0), ACTW)["breakdown"]["wind"]["points"] == 20.0
    assert score_prediction(W(wind_mph=13.0), ACTW)["breakdown"]["wind"]["points"] == 16.0  # |13-8|=5 -> 20-(5-3)*2

def test_interval_wind_width_penalty():
    # wide range pays a vagueness tax even when the midpoint is accurate
    r = score_prediction(W(wind_lo=5, wind_hi=15), ACTW)  # mid 10, width 10 -> eff |10-8|+5=7 -> 20-(7-3)*2
    assert r["breakdown"]["wind"]["points"] == 12.0

def test_tight_interval_keeps_credit():
    r = score_prediction(W(wind_lo=5, wind_hi=10), ACTW)  # mid 7.5, width 5 -> eff |7.5-8|+2.5=3.0 -> 20
    assert r["breakdown"]["wind"]["points"] == 20.0

def test_qualitative_wind_as_nws_interval():
    # "light" maps to (1,7); mid 4, width 6 -> eff |4-8|+3=7 -> 12
    assert score_prediction(W(wind_lo=1, wind_hi=7), ACTW)["breakdown"]["wind"]["points"] == 12.0

def test_wind_forfeit_when_absent():
    p = W(); p["fields_provided"] = ["high","low"]  # no wind provided
    assert score_prediction(p, ACTW)["breakdown"]["wind"]["points"] is None
