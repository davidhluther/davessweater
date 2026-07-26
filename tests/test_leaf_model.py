"""Pure-function tests for scripts/leaf_model.py (no network, no I/O)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import leaf_model as lm


# ── elevation lapse ──────────────────────────────────────────────────────────

def test_reference_elevation_no_shift():
    assert lm.elevation_shift_days(lm.REF_ELEVATION_FT) == 0.0


def test_lower_elevation_peaks_later():
    # 1,000 ft below reference ⇒ +DAYS_PER_1000FT days later.
    assert lm.elevation_shift_days(lm.REF_ELEVATION_FT - 1000) == lm.DAYS_PER_1000FT


def test_higher_elevation_peaks_earlier():
    assert lm.elevation_shift_days(lm.REF_ELEVATION_FT + 1000) == -lm.DAYS_PER_1000FT


def test_elevation_shift_is_linear():
    two_k = lm.elevation_shift_days(lm.REF_ELEVATION_FT - 2000)
    one_k = lm.elevation_shift_days(lm.REF_ELEVATION_FT - 1000)
    assert round(two_k, 6) == round(2 * one_k, 6)


# ── thermal modulation ───────────────────────────────────────────────────────

def test_thermal_none_is_zero():
    assert lm.thermal_shift_days(None) == 0.0


def test_thermal_warm_delays_peak():
    # positive anomaly (warmer) ⇒ positive (later) shift
    assert lm.thermal_shift_days(2.0) == lm.DAYS_PER_DEGF * 2.0


def test_thermal_cool_advances_peak():
    assert lm.thermal_shift_days(-2.0) == -lm.DAYS_PER_DEGF * 2.0


def test_thermal_clamps_both_directions():
    assert lm.thermal_shift_days(100.0) == lm.MAX_THERMAL_SHIFT_DAYS
    assert lm.thermal_shift_days(-100.0) == -lm.MAX_THERMAL_SHIFT_DAYS


# ── peak center date ─────────────────────────────────────────────────────────

def test_reference_peak_is_october_6():
    assert lm.peak_center_date(lm.REF_ELEVATION_FT, 2026) == date(2026, 10, 6)


def test_high_elevation_leads_low_by_weeks():
    # The core sanity check: Beech (5,436) must lead Wilkesboro (1,001) by weeks.
    beech = lm.peak_center_date(5436, 2026)
    wilkesboro = lm.peak_center_date(1001, 2026)
    gap = (wilkesboro - beech).days
    assert gap >= 21, f"expected >=3 weeks, got {gap} days"
    assert beech < wilkesboro


def test_monotonic_in_elevation():
    # Every drop in elevation should push the peak the same way or later.
    elevs = [5436, 5000, 3701, 3333, 2559, 1024, 1001]
    dates = [lm.peak_center_date(e, 2026) for e in elevs]
    for earlier, later in zip(dates, dates[1:]):
        assert earlier <= later


def test_thermal_shifts_center():
    cool = lm.peak_center_date(3333, 2026, temp_anomaly_f=-4.0)
    base = lm.peak_center_date(3333, 2026, temp_anomaly_f=None)
    warm = lm.peak_center_date(3333, 2026, temp_anomaly_f=4.0)
    assert cool < base < warm


# ── predict_window shape ─────────────────────────────────────────────────────

def test_predict_window_bounds_symmetric():
    p = lm.predict_window(3333, 2026)
    start = date.fromisoformat(p["peak_start"])
    center = date.fromisoformat(p["peak_center"])
    end = date.fromisoformat(p["peak_end"])
    assert (center - start).days == lm.HALF_WINDOW_DAYS
    assert (end - center).days == lm.HALF_WINDOW_DAYS


def test_predict_window_records_components():
    p = lm.predict_window(2559, 2026, temp_anomaly_f=1.0)
    c = p["components"]
    assert c["reference_elevation_ft"] == lm.REF_ELEVATION_FT
    assert c["temp_anomaly_f"] == 1.0
    assert c["half_window_days"] == lm.HALF_WINDOW_DAYS
    # elevation shift for 2,559 ft is positive (lower than reference)
    assert c["elevation_shift_days"] > 0


# ── scorer ───────────────────────────────────────────────────────────────────

def _pred(center_iso):
    """Build a minimal prediction dict centered on a date, ±HALF_WINDOW."""
    from datetime import timedelta
    c = date.fromisoformat(center_iso)
    h = lm.HALF_WINDOW_DAYS
    return {
        "peak_start": (c - timedelta(days=h)).isoformat(),
        "peak_center": c.isoformat(),
        "peak_end": (c + timedelta(days=h)).isoformat(),
    }


def test_exact_hit_scores_100():
    r = lm.score_prediction(_pred("2026-10-17"), "2026-10-17")
    assert r["abs_error_days"] == 0
    assert r["signed_error_days"] == 0
    assert r["window_hit"] is True
    assert r["score"] == 100.0
    assert r["grade"] == "right"


def test_within_tolerance_full_credit():
    r = lm.score_prediction(_pred("2026-10-17"), "2026-10-20")
    assert r["abs_error_days"] == 3
    assert r["score"] == 100.0  # 3 days == tolerance, no penalty


def test_penalty_beyond_tolerance():
    # 6 days off: 3 beyond tolerance × 6 pts = 18 → 82.
    r = lm.score_prediction(_pred("2026-10-17"), "2026-10-23")
    assert r["abs_error_days"] == 6
    assert r["score"] == 82.0
    assert r["grade"] == "right"


def test_signed_error_direction():
    # predicted center after observed ⇒ positive (predicted late)
    late = lm.score_prediction(_pred("2026-10-20"), "2026-10-15")
    assert late["signed_error_days"] > 0
    early = lm.score_prediction(_pred("2026-10-10"), "2026-10-15")
    assert early["signed_error_days"] < 0


def test_window_hit_false_when_outside():
    r = lm.score_prediction(_pred("2026-10-17"), "2026-11-05")
    assert r["window_hit"] is False
    assert r["score"] < 40
    assert r["grade"] == "wrong"


def test_observed_range_overlap_is_hit():
    # predicted window 10-12..10-22; observed band 10-20..10-28 overlaps.
    r = lm.score_prediction(_pred("2026-10-17"), {"start": "2026-10-20", "end": "2026-10-28"})
    assert r["window_hit"] is True
    # observed center is 10-24; error = 7 days → 4 beyond tol × 6 = 24 → 76.
    assert r["observed_center"] == "2026-10-24"
    assert r["score"] == 76.0


def test_observed_range_as_list():
    r = lm.score_prediction(_pred("2026-10-17"), ["2026-10-15", "2026-10-19"])
    assert r["observed_center"] == "2026-10-17"
    assert r["score"] == 100.0


def test_score_never_negative():
    r = lm.score_prediction(_pred("2026-10-01"), "2026-12-25")
    assert r["score"] == 0.0
    assert r["grade"] == "wrong"


def test_meh_band():
    # Need a score in [60,75): abs_err such that 100-6*(e-3) in that range.
    # e=9 → 100-36 = 64 → meh.
    r = lm.score_prediction(_pred("2026-10-17"), "2026-10-26")
    assert r["abs_error_days"] == 9
    assert r["score"] == 64.0
    assert r["grade"] == "meh"
