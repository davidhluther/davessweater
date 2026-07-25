"""Pure-function tests for scripts/capture_str_pacing.py (no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_str_pacing import upcoming_weekend_dates, weekend_pacing


def test_upcoming_weekends_from_a_wednesday():
    # Wed 2026-07-22 -> Fri 24, Sat 25, Fri 31, Sat Aug 1, ... (4 weekends = 8 nights)
    days = upcoming_weekend_dates(date(2026, 7, 22))
    assert days[:4] == ["2026-07-24", "2026-07-25", "2026-07-31", "2026-08-01"]
    assert len(days) == 8


def test_upcoming_weekends_start_strictly_after_today():
    # On a Friday, tonight is excluded; Saturday still included.
    days = upcoming_weekend_dates(date(2026, 7, 24))
    assert days[0] == "2026-07-25"
    assert "2026-07-24" not in days


def test_weekend_pacing_maps_rows_and_nulls_gaps():
    rows = [
        {"date": "2026-08-01", "fill_rate": 0.48, "booked_rate_avg": 394.6,
         "available_count": 490, "booked_count": 233},
    ]
    out = weekend_pacing(rows, ["2026-08-01", "2026-08-07"])
    assert out["2026-08-01"] == {"fill_rate": 0.48, "booked_rate_avg": 394.6}
    assert out["2026-08-07"] == {"fill_rate": None, "booked_rate_avg": None}
