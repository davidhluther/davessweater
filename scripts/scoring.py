"""Pure scoring engine for Dave's Sweater — the coupled, snow-aware model.
No I/O. Inputs are normalized prediction/actual dicts (see plan contract)."""

TEMP_TOL, TEMP_SLOPE = 2.0, 3.0
WIND_TOL, WIND_SLOPE = 3.0, 2.0
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


def score_prediction(pred, actual):
    fp = pred.get("fields_provided", [])
    actual_type = precip_type(actual.get("rain_in"), actual.get("snow_in"))

    high = _band(pred.get("high_f"), actual.get("high_f"), 30, TEMP_TOL, TEMP_SLOPE) if "high" in fp else None
    low = _band(pred.get("low_f"), actual.get("low_f"), 30, TEMP_TOL, TEMP_SLOPE) if "low" in fp else None
    wind = _band(pred.get("wind_mph"), actual.get("wind_mph"), 20, WIND_TOL, WIND_SLOPE) if "wind" in fp else None
    ptype = _type_points(pred.get("precip_type"), actual_type) if "precip_type" in fp else None
    pamt = _amount_points(pred, actual, actual_type)

    cats = {"high_temp": (high, 30), "low_temp": (low, 30), "wind": (wind, 20),
            "precip_type": (ptype, 10), "precip_amount": (pamt, 10)}
    total = round(sum((pts or 0) for pts, _ in cats.values()), 1)
    return {
        "score": total,
        "grade": _score_grade(total),
        "coverage": {k: (pts is not None) for k, (pts, _) in cats.items()},
        "breakdown": {k: {"points": pts, "max": mx, "scored": pts is not None} for k, (pts, mx) in cats.items()},
    }
