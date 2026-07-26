"""
leaf_model.py — pure-function core for the High Country fall leaf-color model (v0-draft).

No I/O. Shared by predict_leaf.py (predict + grade) and exercised directly by
tests. Same philosophy as scoring.py / traffic_model.py: transparent, declared
constants; every number a reader can trace back to a stated assumption.

THE MODEL (in one line):

    peak_center = REF_DATE + elevation_shift(elev) + thermal_shift(temp_anomaly)

Three ingredients, in order of authority:

1. PHOTOPERIOD is the clock. Daylength is identical year to year, so the base
   timing of senescence is fixed. We encode it as a single reference anchor
   (peak at ~5,000 ft lands the first week of October) — not modeled per-day,
   just pinned to the well-documented high-elevation peak.

2. ELEVATION LAPSE sets the spatial gradient. Higher = colder sooner = earlier
   peak. The documented High Country pattern is a peak "front" that descends
   ~1,000–1,500 ft per week. We take the midpoint (~1,250 ft/week ≈ 6.5 days per
   1,000 ft of descent) as a declared lapse constant. This is the dominant term
   and the one the sanity check exercises: Beech (5,436 ft) must lead Wilkesboro
   (1,001 ft) by weeks.

3. TEMPERATURE ANOMALY modulates earliness by a few days. A warm early autumn
   delays senescence (later peak); a cold snap / early frost advances it. We
   compare the town's available early-fall mean temperature against its own
   multi-year climatological normal and shift the peak a bounded amount. This
   term is deliberately weak (photoperiod-dominant) and clamps to ±7 days, so a
   thermal signal can nudge but never rewrite the elevation gradient. When no
   early-fall data exists yet (e.g. running in July for the coming fall), the
   term is zero and the prediction is pure elevation climatology — recorded
   honestly in the prediction's `basis`.

Falsifiable by construction: the constants are named, the elevation gradient is
a straight line a reader can check against any two towns, and every prediction
is graded against observed peak once the season arrives (see score_prediction).
"""

from datetime import date, timedelta

MODEL_VERSION = "leaf-v0-draft"

# ── the photoperiod anchor ───────────────────────────────────────────────────
# Peak color at the reference elevation lands the first week of October, per
# Grandfather Mountain's dated galleries (5,000 ft+ turns "the first week of
# October", both 2024 and 2025) and multiple NC-mountains fall-color reports.
REF_ELEVATION_FT = 5000
REF_PEAK_MONTH = 10
REF_PEAK_DAY = 6  # October 6 — center of "first week of October"

# ── the elevation lapse ──────────────────────────────────────────────────────
# The peak front descends ~1,000–1,500 ft/week through the High Country
# (Grandfather / RomanticAsheville / High Country Host). Midpoint ~1,250 ft/week
# = 7 days / 1,250 ft = 5.6 days per 1,000 ft. We round to a slightly steeper
# 6.5 to also fit the documented Grandfather(≈5,000 ft, ~Oct 6) → Boone
# (≈3,333 ft, "mid-to-late October") gap, which implies ~6–9 days / 1,000 ft.
# Lower elevation ⇒ LATER peak, so the shift is positive as elevation drops.
DAYS_PER_1000FT = 6.5

# ── the thermal modulation ───────────────────────────────────────────────────
# Warm early autumn delays peak; cool advances it. Bounded and weak on purpose:
# photoperiod + elevation own the prediction; temperature only nudges.
DAYS_PER_DEGF = 1.5          # peak shift per °F of early-fall temperature anomaly
MAX_THERMAL_SHIFT_DAYS = 7   # hard clamp either direction

# ── the reported window ──────────────────────────────────────────────────────
# A town's peak is a window, not an instant. ±5 days around the center = an
# 11-day "go now" band, consistent with how the human reports describe a
# roughly one-week peak that lingers a few days at the shoulders.
HALF_WINDOW_DAYS = 5

# ── grading ──────────────────────────────────────────────────────────────────
# Same shape as the site's temperature scoring: a tolerance band earns full
# credit, then a linear penalty per day beyond it, floored at zero.
GRADE_TOL_DAYS = 3       # within 3 days of observed peak = full credit
GRADE_PENALTY_PER_DAY = 6  # points lost per day of error beyond the tolerance


def elevation_shift_days(elevation_ft: float) -> float:
    """Days the peak moves relative to the reference elevation. Positive = later
    (lower than reference); negative = earlier (higher than reference)."""
    return (REF_ELEVATION_FT - elevation_ft) * DAYS_PER_1000FT / 1000.0


def thermal_shift_days(temp_anomaly_f):
    """Bounded peak shift for an early-fall temperature anomaly (this year's mean
    minus the town's normal). Warmer (positive anomaly) ⇒ later peak. Returns 0.0
    when no anomaly is available (pure-climatology mode)."""
    if temp_anomaly_f is None:
        return 0.0
    raw = DAYS_PER_DEGF * temp_anomaly_f
    if raw > MAX_THERMAL_SHIFT_DAYS:
        return float(MAX_THERMAL_SHIFT_DAYS)
    if raw < -MAX_THERMAL_SHIFT_DAYS:
        return float(-MAX_THERMAL_SHIFT_DAYS)
    return float(raw)


def peak_center_date(elevation_ft: float, year: int, temp_anomaly_f=None) -> date:
    """The predicted peak-color center date for a town at `elevation_ft` in
    `year`, combining the photoperiod anchor, elevation lapse, and (optional)
    thermal modulation. Rounded to the nearest whole day."""
    ref = date(year, REF_PEAK_MONTH, REF_PEAK_DAY)
    shift = elevation_shift_days(elevation_ft) + thermal_shift_days(temp_anomaly_f)
    return ref + timedelta(days=round(shift))


def predict_window(elevation_ft: float, year: int, temp_anomaly_f=None) -> dict:
    """Full per-town prediction: center + start/end window + the component parts
    that produced it (so a reader can reconstruct the number by hand)."""
    elev_shift = elevation_shift_days(elevation_ft)
    therm_shift = thermal_shift_days(temp_anomaly_f)
    center = peak_center_date(elevation_ft, year, temp_anomaly_f)
    start = center - timedelta(days=HALF_WINDOW_DAYS)
    end = center + timedelta(days=HALF_WINDOW_DAYS)
    return {
        "peak_start": start.isoformat(),
        "peak_center": center.isoformat(),
        "peak_end": end.isoformat(),
        "components": {
            "reference_date": date(year, REF_PEAK_MONTH, REF_PEAK_DAY).isoformat(),
            "reference_elevation_ft": REF_ELEVATION_FT,
            "elevation_shift_days": round(elev_shift, 2),
            "thermal_shift_days": round(therm_shift, 2),
            "temp_anomaly_f": (round(temp_anomaly_f, 2)
                               if temp_anomaly_f is not None else None),
            "half_window_days": HALF_WINDOW_DAYS,
        },
    }


# ── grading (used once observed 2026 peaks arrive) ───────────────────────────

def _parse_date(value) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _observed_center_and_span(observed):
    """Normalize an observed peak — a single date, or a {start,end}/[start,end]
    range — into (center_date, start_date, end_date). A single date has a
    zero-width span."""
    if isinstance(observed, dict):
        start = _parse_date(observed["start"])
        end = _parse_date(observed["end"])
    elif isinstance(observed, (list, tuple)):
        start = _parse_date(observed[0])
        end = _parse_date(observed[1])
    else:
        start = end = _parse_date(observed)
    if end < start:
        start, end = end, start
    center = start + timedelta(days=(end - start).days // 2)
    return center, start, end


def _grade_label(score: float) -> str:
    """Mirror the site's Right / Meh / Wrong bands (90/75/60/40 thresholds)."""
    if score >= 90:
        return "right"
    if score >= 75:
        return "right"
    if score >= 60:
        return "meh"
    return "wrong"


def score_prediction(prediction: dict, observed) -> dict:
    """Grade a predicted window against an observed peak.

    `prediction` is a predict_window() dict (needs peak_start/center/end).
    `observed` is a single date (ISO string or date), or a {start,end} /
    [start,end] range from a grading source.

    Returns error in days (absolute + signed, predicted-minus-observed so
    positive = predicted late), a window-hit bool (did the observed peak fall
    inside our predicted window / overlap it), a 0–100 score, and a grade label.
    """
    pred_center = _parse_date(prediction["peak_center"])
    pred_start = _parse_date(prediction["peak_start"])
    pred_end = _parse_date(prediction["peak_end"])

    obs_center, obs_start, obs_end = _observed_center_and_span(observed)

    signed_error_days = (pred_center - obs_center).days
    abs_error_days = abs(signed_error_days)

    # window hit = predicted [start,end] overlaps observed [start,end]
    # (for a single observed date this reduces to "date is inside the window").
    window_hit = (pred_start <= obs_end) and (obs_start <= pred_end)

    penalty = GRADE_PENALTY_PER_DAY * max(0, abs_error_days - GRADE_TOL_DAYS)
    score = round(max(0.0, 100.0 - penalty), 1)

    return {
        "abs_error_days": abs_error_days,
        "signed_error_days": signed_error_days,
        "window_hit": window_hit,
        "score": score,
        "grade": _grade_label(score),
        "predicted_center": pred_center.isoformat(),
        "observed_center": obs_center.isoformat(),
    }
