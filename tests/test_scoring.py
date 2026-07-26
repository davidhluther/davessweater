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
    # Merged precip row (max 20) reports the amount comparison; the type call is folded into points.
    assert bd["precip"]["max"] == 20
    assert bd["precip"]["predicted"] == 0.10 and bd["precip"]["actual"] == 0.12 and bd["precip"]["error"] == 0.02
    # a forfeited category still reports predicted=None
    pred2 = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
              fields_provided=["high","low","precip_type","rain_amount"])
    assert score_prediction(pred2, ACT)["breakdown"]["wind"]["predicted"] is None

def test_predicted_rain_without_amount_forfeits_amount():
    # Predicts rain but gives no total -> amount sub-score forfeited (0); the 10-pt
    # identification is still kept, so precip = 10/20. Temps: high 4 off = 30-(4-1)*3=21,
    # low 3 off = 30-(3-1)*3=24, wind spot on = 20 -> 21+24+20+10 = 75 (/100).
    pred = P(high_f=80, low_f=58, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["score"] == 75.0
    assert r["breakdown"]["precip"]["points"] == 10.0
    assert r["coverage"]["precip"] is False  # amount not answered

def test_omitted_wind_forfeits_its_category():
    # wind omitted -> 80/100 (no credit for a field never forecast). Temps spot on.
    pred = P(high_f=84, low_f=61, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","precip_type","rain_amount"])
    r = score_prediction(pred, ACT)
    assert r["coverage"]["wind"] is False
    assert r["breakdown"]["wind"]["points"] is None
    assert r["breakdown"]["precip"]["points"] == 20.0
    assert r["score"] == 80.0


def test_predicted_rain_without_amount_cannot_exceed_90():
    # Perfect on high/low/wind/type but predicts rain with no total -> amount
    # forfeited -> caps at 90/100. A source can't win by leaving the hard field blank.
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, ACT)
    assert r["score"] == 90.0
    assert r["coverage"]["precip"] is False
    assert r["grade"]["verdict"] == "right"


def test_no_precip_forecast_scores_amount_as_zero_inches():
    # "No rain" IS a zero-inch forecast: on a dry day the merged field earns the full 20.
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    r = score_prediction(pred, dry)
    assert r["breakdown"]["precip"]["points"] == 20.0
    assert r["score"] == 100.0

def test_precision_not_punished_within_rain_tolerance():
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.10,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["breakdown"]["precip"]["points"] == 20.0

def test_snow_scored_in_depth_with_coarse_tolerance():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="snow", snow_in=5.0,
             fields_provided=["high","low","wind","precip_type","snow_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip"]["points"] == 20.0
    assert r["score"] == 100.0

def test_wrong_precip_form_forfeits_amount_of_the_missing_form():
    # Rain forecast on a snow day: identification 4/10, and because the forecast
    # carried rain_amount (not snow_amount), the snow amount is forfeited -> precip 4/20.
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 6.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="rain", rain_in=0.5,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip"]["points"] == 4.0

def test_wrong_form_amount_capped_at_five_when_both_amounts_provided():
    # A source that publishes BOTH rain and snow amounts but names the wrong form:
    # identification 4/10, and the amount sub-score (here 6/10 on snow depth) is
    # capped at 5 -> precip = 4 + 5 = 9/20. You can't bank amount accuracy while
    # calling snow "rain".
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 3.0}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="rain", rain_in=0.2, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip"]["points"] == 9.0

def test_none_forecast_on_trace_rain_day_gets_trace_credit_not_wrong_form_cap():
    # Actual 0.03" is inside the amount tolerance (<= 0.1"), so a "none" forecast is
    # nearly right: 6/10 trace identification + full 10/10 amount (predicted 0",
    # ~0" fell) = 16/20. A none-vs-trace disagreement is NOT a misnamed form, so the
    # wrong-form cap does not apply.
    act = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.03, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    r = score_prediction(pred, act)
    assert r["breakdown"]["precip"]["points"] == 16.0
    assert r["score"] == 96.0

def test_none_forecast_beyond_trace_band_loses_identification():
    # Actual 0.15" is beyond the trace band, so "none" earns 0 identification; the
    # amount is still scored (predicted 0" vs 0.15" -> 9/10) -> precip = 9/20.
    act = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.15, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    assert score_prediction(pred, act)["breakdown"]["precip"]["points"] == 9.0

def test_zero_qpf_rain_forecast_on_dry_day_scores_full_precip():
    # A "rain, 0 QPF" forecast on a dry day (e.g. a thunderstorm weather-code with
    # 0" QPF, nothing fell): predicted 0", 0" fell, so the merged dry-day band gives
    # the full 20 — the old split penalized the "rain" label while crediting the
    # amount, the double-grade the merge removes.
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="rain", rain_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    r = score_prediction(pred, dry)
    assert r["breakdown"]["precip"]["points"] == 20.0

def test_rain_forecast_without_amount_gets_no_dry_day_credit():
    # Names precip but omits the total on a dry day -> can't be scored on the amount
    # band, and the type fallback denies credit (no gain by omission) -> precip 0/20.
    dry = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}
    pred = P(high_f=80, low_f=60, wind_mph=5, precip_type="rain",
             fields_provided=["high","low","wind","precip_type"])
    r = score_prediction(pred, dry)
    assert r["breakdown"]["precip"]["points"] == 0.0
    assert r["coverage"]["precip"] is False

def test_none_forecast_on_sub_tolerance_snow_day_gets_trace_credit():
    act = {"high_f": 30, "low_f": 20, "wind_mph": 10, "rain_in": 0.0, "snow_in": 0.8}
    pred = P(high_f=30, low_f=20, wind_mph=10, precip_type="none", rain_in=0.0, snow_in=0.0,
             fields_provided=["high","low","wind","precip_type","rain_amount","snow_amount"])
    # 0.8" snow is inside the 1" band: 6/10 trace id + full 10/10 amount = 16/20.
    assert score_prediction(pred, act)["breakdown"]["precip"]["points"] == 16.0
    act_heavy = dict(act, snow_in=3.0)
    # 3" is beyond trace: 0 id + 6/10 amount (predicted 0" vs 3") = 6/20.
    assert score_prediction(pred, act_heavy)["breakdown"]["precip"]["points"] == 6.0

def test_precip_type_derivation():
    assert precip_type(0.2, 0.0) == "rain"
    assert precip_type(0.0, 3.0) == "snow"
    assert precip_type(0.1, 2.0) == "mixed"
    assert precip_type(0.0, 0.0) == "none"

def test_grade_band_labels_unchanged():
    pred = P(high_f=84, low_f=61, wind_mph=6, precip_type="rain", rain_in=0.12,
             fields_provided=["high","low","wind","precip_type","rain_amount"])
    assert score_prediction(pred, ACT)["grade"]["verdict"] == "right"


# ── Temperature window/slope (recalibrated 2026-07-26: 1°F full-credit, -3/°F) ──

def TP(**kw):
    base = {"high_f": None, "low_f": None, "wind_mph": None, "precip_type": None,
            "rain_in": None, "snow_in": None, "fields_provided": ["high"]}
    base.update(kw)
    return base

TACT = {"high_f": 80, "low_f": 60, "wind_mph": 5, "rain_in": 0.0, "snow_in": 0.0}

def test_temp_full_credit_within_1F():
    # 1°F off is still full credit (the tightened window's inner edge).
    assert score_prediction(TP(high_f=81), TACT)["breakdown"]["high_temp"]["points"] == 30.0

def test_temp_2F_off_now_loses_credit():
    # 2°F off used to be full credit; under the 1°F window it costs one slope step:
    # 30 - (2-1)*3 = 27.
    assert score_prediction(TP(high_f=82), TACT)["breakdown"]["high_temp"]["points"] == 27.0

def test_temp_slope_stays_minus_three_per_degree():
    # 5°F off: 30 - (5-1)*3 = 18 (slope unchanged at -3/°F).
    assert score_prediction(TP(high_f=85), TACT)["breakdown"]["high_temp"]["points"] == 18.0


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
