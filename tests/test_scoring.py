from scoring import score_prediction, precip_type, normalized_score

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

def test_vague_precip_forfeits_amount_not_zeroed():
    # raw 81 of 90 available (precip_amount forfeited) -> normalized 90.0, NOT 81/100.
    pred = P(high_f=80, low_f=58, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["raw_points"] == 81.0 and r["max_available"] == 90
    assert r["score"] == 90.0
    assert r["coverage"]["precip_amount"] is False
    assert r["coverage"]["precip_type"] is True

def test_omitted_wind_forfeits_its_category():
    # perfect on the 4 fields it provides (wind omitted) -> 80 of 80 available -> 100.0
    pred = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","precip_type","rain_amount"])
    r = score_prediction(pred, ACT)
    assert r["coverage"]["wind"] is False
    assert r["breakdown"]["wind"]["points"] is None
    assert r["raw_points"] == 80.0 and r["max_available"] == 80
    assert r["score"] == 100.0


def test_forfeited_amount_perfect_forecast_scores_100():
    # The Ray case: perfect high/low/wind/type, no precip amount published -> 90 of 90 -> 100, not capped at 90.
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["raw_points"] == 90.0 and r["max_available"] == 90
    assert r["score"] == 100.0
    assert r["coverage"]["precip_amount"] is False
    assert r["grade"]["verdict"] == "right"


def test_normalized_score_helper():
    assert normalized_score(81.0, 90) == 90.0
    assert normalized_score(100.0, 100) == 100.0
    assert normalized_score(0.0, 0) == 0.0  # no scorable fields -> 0, never divide by zero

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
