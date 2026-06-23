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

def test_vague_precip_forfeits_amount_not_zeroed():
    pred = P(high_f=80, low_f=58, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["score"] == 81.0
    assert r["coverage"]["precip_amount"] is False
    assert r["coverage"]["precip_type"] is True

def test_omitted_wind_forfeits_its_category():
    pred = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","precip_type","rain_amount"])
    r = score_prediction(pred, ACT)
    assert r["coverage"]["wind"] is False
    assert r["breakdown"]["wind"]["points"] is None
    assert r["score"] == 80.0

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
