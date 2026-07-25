"""Pure-function tests for scripts/capture_nps_visits.py (no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_nps_visits import is_capture_day, month_key, slim, merge_months


def test_capture_day_is_the_third_only():
    assert is_capture_day(date(2026, 8, 3)) is True
    assert [is_capture_day(date(2026, 8, d)) for d in (1, 2, 4, 15, 30)] == [
        False, False, False, False, False,
    ]


def test_month_key_zero_pads():
    assert month_key(2026, 6) == "2026-06"
    assert month_key(2026, 12) == "2026-12"


def test_slim_reads_a_visitation_record():
    rec = {"Month": 10, "Year": 2025, "RecreationVisitors": 2346934,
           "NonRecreationVisitors": 87240, "UnitCode": "BLRI"}
    assert slim(rec) == {
        "month_key": "2025-10", "year": 2025, "month": 10,
        "recreation_visitors": 2346934, "nonrecreation_visitors": 87240,
    }


def test_slim_rejects_bad_month_and_missing_year():
    assert slim({"Month": 13, "Year": 2025}) is None
    assert slim({"Month": 5}) is None
    assert slim({"Month": "x", "Year": 2025}) is None


def test_slim_tolerates_null_counts():
    out = slim({"Month": 1, "Year": 2000, "RecreationVisitors": None})
    assert out["recreation_visitors"] is None
    assert out["nonrecreation_visitors"] is None


def test_merge_is_idempotent_and_sorted():
    existing = [
        {"month_key": "2025-01", "year": 2025, "month": 1, "recreation_visitors": 100},
        {"month_key": "2025-02", "year": 2025, "month": 2, "recreation_visitors": 200},
    ]
    # Same data re-fetched -> unchanged.
    assert merge_months(existing, list(existing)) == existing


def test_merge_revision_wins_and_new_months_append():
    existing = [
        {"month_key": "2025-01", "year": 2025, "month": 1, "recreation_visitors": 100},
    ]
    fetched = [
        {"month_key": "2025-01", "year": 2025, "month": 1, "recreation_visitors": 111},  # revised
        {"month_key": "2025-02", "year": 2025, "month": 2, "recreation_visitors": 200},  # new
    ]
    out = merge_months(existing, fetched)
    assert [m["month_key"] for m in out] == ["2025-01", "2025-02"]
    assert out[0]["recreation_visitors"] == 111  # revision overwrote


def test_merge_sorts_chronologically():
    out = merge_months(
        [{"month_key": "2025-12", "year": 2025, "month": 12}],
        [{"month_key": "2024-06", "year": 2024, "month": 6},
         {"month_key": "2025-03", "year": 2025, "month": 3}],
    )
    assert [m["month_key"] for m in out] == ["2024-06", "2025-03", "2025-12"]
