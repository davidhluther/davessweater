"""
leaf_model.py — pure-function core for the High Country fall leaf-color model.

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

TWO VERSIONS LIVE HERE (since 2026-09-04):

  leaf-v0-draft — the July 2026 constants, FROZEN. data/leaf/predictions.json was
      generated with them on 2026-07-26 and is a graded artifact: it is scored in
      November exactly as published. Nothing in this file may change a v0 number.
  leaf-v1 — calibrated 2026-09-04 against 18 years of published High Country
      peak-color observations at a 3,300 ft reference elevation, using our own
      Open-Meteo temperature series rather than the observer's station record.
      Adopted at the September refresh, graded separately from v0.

Every constant is per-version in PARAMS below; the module-level names are v0's
values, kept so a reader (and the frozen artifact) can still see them by name.

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


# ── versioned parameters ─────────────────────────────────────────────────────
# Each version is a complete, self-contained parameter set. v0 is frozen: its
# numbers produced data/leaf/predictions.json on 2026-07-26 and that file is
# graded as published. v1's numbers come from scripts/fit_leaf_v1.py, which
# regenerates every figure in docs/leaf-model.md's calibration section.

DEFAULT_VERSION = "leaf-v1"

PARAMS = {
    "leaf-v0-draft": {
        "ref_elevation_ft": REF_ELEVATION_FT,
        "ref_peak_month": REF_PEAK_MONTH,
        "ref_peak_day": REF_PEAK_DAY,
        "days_per_1000ft": DAYS_PER_1000FT,
        # One thermal window, one coefficient, one climatology rule.
        "thermal_window": {"start": (9, 1), "end": (9, 25)},
        "days_per_degf": DAYS_PER_DEGF,
        "max_thermal_shift_days": MAX_THERMAL_SHIFT_DAYS,
        "climatology": {"mode": "rolling", "years": 6},
        "half_window_days": HALF_WINDOW_DAYS,
        "grade_tol_days": GRADE_TOL_DAYS,
        "grade_penalty_per_day": GRADE_PENALTY_PER_DAY,
        "provenance": "First-guess priors, declared not fitted (July 2026).",
    },
    "leaf-v1": {
        # Anchor: UNCHANGED from v0, and now corroborated rather than assumed.
        # The observed record's mean peak at 3,300 ft is October 16.5 (n=17);
        # walking that up 1,700 ft at the declared lapse implies an October 5.5
        # anchor at 5,000 ft, and the 2017-2025 era implies October 6.8. v0's
        # October 6 sits between them, so it stays.
        "ref_elevation_ft": 5000,
        "ref_peak_month": 10,
        "ref_peak_day": 6,
        # Lapse: UNCHANGED. The historical record is single-elevation and says
        # nothing about the gradient, so there is nothing here to fit it on.
        "days_per_1000ft": 6.5,
        # Thermal: the full calendar month of September is the best predictor
        # (R2 0.673 on our series; 0.588 for Sep 1-25), so v1 fits BOTH windows
        # and uses whichever the calendar can actually supply -- see `passes`.
        "thermal_window": {"start": (9, 1), "end": (9, 30)},
        "days_per_degf": 1.80,
        # Clamp widened 7 -> 10. The one historical case the old clamp would
        # have truncated is 2019: a +4.8 degF September anomaly implies +8.6
        # days, and the observed delay was +12.5. A 7-day clamp makes the
        # model's single largest documented miss larger on purpose.
        "max_thermal_shift_days": 10,
        # Climatology: a fixed long-term normal, not a 6-year rolling one. The
        # coefficient was fitted against anomalies from an 18-year mean; a
        # 6-year window over 2020-2025 sits 1.3 degF cooler than that mean at
        # Boone, and the coefficient would multiply that offset into about
        # 2.3 days of spurious delay every year.
        "climatology": {"mode": "fixed_span", "start_year": 2008, "end_year": 2025},
        "half_window_days": 5,
        # Grading rules are IDENTICAL to v0's on purpose: two model versions
        # graded on one unchanged ruler is the only way the comparison means
        # anything.
        "grade_tol_days": 3,
        "grade_penalty_per_day": 6,
        # Provisional pass: the September refresh runs before the month ends and
        # before the archive catches up, so the first v1 pass uses Sep 1-25 with
        # the coefficient fitted on THAT window (1.65, not 1.80). The final pass
        # in early October uses the full month. Both are published and graded.
        "passes": {
            "provisional": {
                "thermal_window": {"start": (9, 1), "end": (9, 25)},
                "days_per_degf": 1.65,
            },
            "final": {
                "thermal_window": {"start": (9, 1), "end": (9, 30)},
                "days_per_degf": 1.80,
            },
        },
        "provenance": ("Calibrated 2026-09-04 against 18 years of published High Country "
                       "peak-color observations at a 3,300 ft reference elevation, paired "
                       "with our own Open-Meteo September temperature series. "
                       "See scripts/fit_leaf_v1.py and docs/leaf-model.md."),
    },
}


def get_params(version: str | None = None, pass_name: str | None = None) -> dict:
    """The parameter set for `version` (default: the adopted model), optionally
    specialized to a named pass. Raises on an unknown version rather than
    silently falling back -- a typo must not quietly grade the wrong model."""
    version = version or DEFAULT_VERSION
    if version not in PARAMS:
        raise KeyError(f"unknown leaf model version {version!r}; "
                       f"known: {sorted(PARAMS)}")
    params = dict(PARAMS[version])
    if pass_name:
        passes = params.get("passes") or {}
        if pass_name not in passes:
            raise KeyError(f"model {version!r} has no pass {pass_name!r}; "
                           f"known: {sorted(passes)}")
        params.update(passes[pass_name])
        params["pass"] = pass_name
    return params


def _p(params=None, version=None, pass_name=None) -> dict:
    """Resolve a parameter set from an explicit dict, or a version (+ pass)."""
    if params is not None:
        return params
    return get_params(version, pass_name)


def elevation_shift_days(elevation_ft: float, params=None, version=None) -> float:
    """Days the peak moves relative to the reference elevation. Positive = later
    (lower than reference); negative = earlier (higher than reference)."""
    p = _p(params, version)
    return (p["ref_elevation_ft"] - elevation_ft) * p["days_per_1000ft"] / 1000.0


def thermal_shift_days(temp_anomaly_f, params=None, version=None, pass_name=None):
    """Bounded peak shift for a September temperature anomaly (this year's mean
    minus the town's normal). Warmer (positive anomaly) ⇒ later peak. Returns 0.0
    when no anomaly is available (pure-climatology mode)."""
    if temp_anomaly_f is None:
        return 0.0
    p = _p(params, version, pass_name)
    raw = p["days_per_degf"] * temp_anomaly_f
    cap = p["max_thermal_shift_days"]
    if raw > cap:
        return float(cap)
    if raw < -cap:
        return float(-cap)
    return float(raw)


def peak_center_date(elevation_ft: float, year: int, temp_anomaly_f=None,
                     params=None, version=None, pass_name=None) -> date:
    """The predicted peak-color center date for a town at `elevation_ft` in
    `year`, combining the photoperiod anchor, elevation lapse, and (optional)
    thermal modulation. Rounded to the nearest whole day."""
    p = _p(params, version, pass_name)
    ref = date(year, p["ref_peak_month"], p["ref_peak_day"])
    shift = elevation_shift_days(elevation_ft, p) + thermal_shift_days(temp_anomaly_f, p)
    return ref + timedelta(days=round(shift))


def predict_window(elevation_ft: float, year: int, temp_anomaly_f=None,
                   params=None, version=None, pass_name=None) -> dict:
    """Full per-town prediction: center + start/end window + the component parts
    that produced it (so a reader can reconstruct the number by hand)."""
    p = _p(params, version, pass_name)
    elev_shift = elevation_shift_days(elevation_ft, p)
    therm_shift = thermal_shift_days(temp_anomaly_f, p)
    center = peak_center_date(elevation_ft, year, temp_anomaly_f, p)
    half = p["half_window_days"]
    start = center - timedelta(days=half)
    end = center + timedelta(days=half)
    return {
        "peak_start": start.isoformat(),
        "peak_center": center.isoformat(),
        "peak_end": end.isoformat(),
        "components": {
            "reference_date": date(year, p["ref_peak_month"], p["ref_peak_day"]).isoformat(),
            "reference_elevation_ft": p["ref_elevation_ft"],
            "elevation_shift_days": round(elev_shift, 2),
            "thermal_shift_days": round(therm_shift, 2),
            "temp_anomaly_f": (round(temp_anomaly_f, 2)
                               if temp_anomaly_f is not None else None),
            "half_window_days": half,
            "days_per_degf": p["days_per_degf"],
            "max_thermal_shift_days": p["max_thermal_shift_days"],
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


def score_prediction(prediction: dict, observed, params=None, version=None) -> dict:
    """Grade a predicted window against an observed peak.

    `prediction` is a predict_window() dict (needs peak_start/center/end).
    `observed` is a single date (ISO string or date), or a {start,end} /
    [start,end] range from a grading source.

    Returns error in days (absolute + signed, predicted-minus-observed so
    positive = predicted late), a window-hit bool (did the observed peak fall
    inside our predicted window / overlap it), a 0–100 score, and a grade label.
    """
    p = _p(params, version)
    pred_center = _parse_date(prediction["peak_center"])
    pred_start = _parse_date(prediction["peak_start"])
    pred_end = _parse_date(prediction["peak_end"])

    obs_center, obs_start, obs_end = _observed_center_and_span(observed)

    signed_error_days = (pred_center - obs_center).days
    abs_error_days = abs(signed_error_days)

    # window hit = predicted [start,end] overlaps observed [start,end]
    # (for a single observed date this reduces to "date is inside the window").
    window_hit = (pred_start <= obs_end) and (obs_start <= pred_end)

    penalty = p["grade_penalty_per_day"] * max(0, abs_error_days - p["grade_tol_days"])
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
