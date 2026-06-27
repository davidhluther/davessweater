"""Pure scoring engine for Dave's Sweater — the coupled, snow-aware model.
No I/O. Inputs are normalized prediction/actual dicts (see plan contract)."""

TEMP_TOL, TEMP_SLOPE = 2.0, 3.0
WIND_TOL, WIND_SLOPE = 3.0, 2.0
WIND_WIDTH_K = 0.5  # vagueness tax: half the forecast-range width is added to the error
RAIN_TOL, RAIN_SLOPE = 0.1, 20.0
SNOW_MIN_TOL, SNOW_PCT, SNOW_SLOPE = 1.0, 0.20, 2.0


def precip_type(rain_in, snow_in):
    r = (rain_in or 0) > 0.005
    s = (snow_in or 0) > 0.05
    if r and s:
        return "mixed"
    if s:
        return "snow"
    if r:
        return "rain"
    return "none"


def _band(pred, actual, maxpts, tol, slope):
    if pred is None or actual is None:
        return 0.0
    err = abs(pred - actual)
    return round(max(0.0, maxpts - max(0.0, err - tol) * slope), 1)


def _wind_interval(pred):
    lo, hi = pred.get("wind_lo"), pred.get("wind_hi")
    if lo is not None and hi is not None:
        return (min(lo, hi), max(lo, hi))
    w = pred.get("wind_mph")
    return (w, w) if w is not None else None


def _wind_points(pred, actual):
    if "wind" not in pred.get("fields_provided", []):
        return None
    iv = _wind_interval(pred); aw = actual.get("wind_mph")
    if iv is None or aw is None:
        return None
    lo, hi = iv
    eff = abs((lo + hi) / 2.0 - aw) + WIND_WIDTH_K * (hi - lo)
    return round(max(0.0, 20 - max(0.0, eff - WIND_TOL) * WIND_SLOPE), 1)


def _snow_tol(actual_snow):
    return max(SNOW_MIN_TOL, (actual_snow or 0) * SNOW_PCT)


def _type_points(pred_type, actual_type):
    if pred_type == actual_type:
        return 10.0
    precip = {"rain", "snow", "mixed"}
    if pred_type in precip and actual_type in precip:
        return 4.0
    return 0.0


def _amount_points(pred, actual, actual_type):
    fp = pred.get("fields_provided", [])
    if actual_type == "none":
        parts = []
        if "rain_amount" in fp:
            parts.append(_band(pred.get("rain_in"), 0.0, 10, RAIN_TOL, RAIN_SLOPE))
        if "snow_amount" in fp:
            parts.append(_band(pred.get("snow_in"), 0.0, 10, _snow_tol(0), SNOW_SLOPE))
        return round(sum(parts) / len(parts), 1) if parts else None
    if actual_type == "rain":
        if "rain_amount" not in fp:
            return None
        return _band(pred.get("rain_in"), actual.get("rain_in"), 10, RAIN_TOL, RAIN_SLOPE)
    if actual_type == "snow":
        if "snow_amount" not in fp:
            return None
        return _band(pred.get("snow_in"), actual.get("snow_in"), 10, _snow_tol(actual.get("snow_in")), SNOW_SLOPE)
    parts = []
    if "rain_amount" in fp:
        parts.append(_band(pred.get("rain_in"), actual.get("rain_in"), 5, RAIN_TOL, RAIN_SLOPE))
    if "snow_amount" in fp:
        parts.append(_band(pred.get("snow_in"), actual.get("snow_in"), 5, _snow_tol(actual.get("snow_in")), SNOW_SLOPE))
    return round(sum(parts), 1) if parts else None


def _score_grade(score):
    if score >= 90:
        return {"verdict": "right", "ray_count": 5}
    if score >= 75:
        return {"verdict": "right", "ray_count": 4}
    if score >= 60:
        return {"verdict": "meh", "ray_count": 3}
    if score >= 40:
        return {"verdict": "wrong", "ray_count": 2}
    return {"verdict": "wrong", "ray_count": 1}


def normalized_score(raw_points, max_available):
    """Score as a percentage of the points the forecast was actually eligible for.
    A forfeited field (e.g. Ray's precip amount, which he never publishes) shrinks
    max_available instead of dragging the score against a fixed 100-pt denominator —
    so a source is graded on what it forecasts, not penalized for what it omits."""
    if not max_available:
        return 0.0
    return round(raw_points / max_available * 100, 1)


def _delta(p, a):
    return round(abs(p - a), 3) if (p is not None and a is not None) else None


def _bd(points, maxpts, predicted, actual):
    """Breakdown entry carrying the predicted/actual differential."""
    return {"points": points, "max": maxpts, "scored": points is not None,
            "predicted": predicted, "actual": actual, "error": _delta(predicted, actual)}


def _amount_bd(pred, actual, actual_type, points):
    """Precip-amount breakdown — predicted vs actual in the unit that fell."""
    fp = pred.get("fields_provided", [])
    if actual_type == "snow":
        predicted = pred.get("snow_in") if "snow_amount" in fp else None
        observed, unit = round(actual.get("snow_in") or 0, 3), "in_snow_depth"
    elif actual_type in ("rain", "mixed"):
        predicted = pred.get("rain_in") if "rain_amount" in fp else None
        observed, unit = round(actual.get("rain_in") or 0, 3), "in_liquid"
    else:  # none fell
        predicted = pred.get("rain_in") if "rain_amount" in fp else None
        observed, unit = 0.0, "in_liquid"
    return {"points": points, "max": 10, "scored": points is not None,
            "predicted": predicted, "actual": observed, "error": _delta(predicted, observed), "unit": unit}


def score_prediction(pred, actual):
    fp = pred.get("fields_provided", [])
    actual_type = precip_type(actual.get("rain_in"), actual.get("snow_in"))

    high = _band(pred.get("high_f"), actual.get("high_f"), 30, TEMP_TOL, TEMP_SLOPE) if "high" in fp else None
    low = _band(pred.get("low_f"), actual.get("low_f"), 30, TEMP_TOL, TEMP_SLOPE) if "low" in fp else None
    wind = _wind_points(pred, actual)
    ptype = _type_points(pred.get("precip_type"), actual_type) if "precip_type" in fp else None
    pamt = _amount_points(pred, actual, actual_type)

    iv = _wind_interval(pred) if "wind" in fp else None
    if iv is None:
        wind_predicted, wind_mid = None, None
    else:
        lo, hi = iv
        wind_mid = (lo + hi) / 2.0
        wind_predicted = f"{lo}-{hi}" if lo != hi else wind_mid

    raw_points = round(sum((p or 0) for p in (high, low, wind, ptype, pamt)), 1)
    breakdown = {
        "high_temp": _bd(high, 30, pred.get("high_f") if "high" in fp else None, actual.get("high_f")),
        "low_temp": _bd(low, 30, pred.get("low_f") if "low" in fp else None, actual.get("low_f")),
        "wind": {"points": wind, "max": 20, "scored": wind is not None,
                 "predicted": wind_predicted, "actual": actual.get("wind_mph"),
                 "error": _delta(wind_mid, actual.get("wind_mph"))},
        "precip_type": {"points": ptype, "max": 10, "scored": ptype is not None,
                        "predicted": pred.get("precip_type") if "precip_type" in fp else None, "actual": actual_type},
        "precip_amount": _amount_bd(pred, actual, actual_type, pamt),
    }
    max_available = sum(f["max"] for f in breakdown.values() if f["scored"])
    score = normalized_score(raw_points, max_available)
    return {
        "score": score,
        "raw_points": raw_points,
        "max_available": max_available,
        "grade": _score_grade(score),
        "coverage": {k: v["points"] is not None for k, v in breakdown.items()},
        "breakdown": breakdown,
    }
