"""Pure-function tests for scripts/capture_lodging_demand.py (no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_lodging_demand import high_share, min_rate, summarize, target_stays


def test_target_stays_from_a_wednesday():
    # Wed 2026-07-22 -> Fri 07-24, Sat 07-25, Sat 08-01
    stays = target_stays(date(2026, 7, 22))
    assert [s["chk_in"] for s in stays] == ["2026-07-24", "2026-07-25", "2026-08-01"]
    assert stays[0]["chk_out"] == "2026-07-25"


def test_target_stays_never_include_today():
    # On a Friday, "next Friday" is a week out, not tonight.
    stays = target_stays(date(2026, 7, 24))
    assert [s["chk_in"] for s in stays] == ["2026-07-25", "2026-07-31", "2026-08-01"]


def test_min_rate_picks_cheapest_and_survives_junk():
    rates = [
        {"name": "Booking.com", "rate": 222},
        {"name": "Agoda.com", "rate": 190},
        {"name": "Broken", "rate": None},
    ]
    assert min_rate(rates) == 190
    assert min_rate([]) is None
    assert min_rate(None) is None
    assert min_rate([{"rate": None}]) is None


def _cap(town, chk_in_rates, high_days=None):
    return {
        "name": "x",
        "town": town,
        "hotel_key": "k",
        "heatmap": {"high_price_days": high_days} if high_days is not None else None,
        "stays": {
            chk_in: {"chk_out": "", "min_rate": rate, "rates": None}
            for chk_in, rate in chk_in_rates.items()
        },
    }


def test_summarize_medians_per_town_and_stay():
    stays = [{"chk_in": "2026-08-01", "chk_out": "2026-08-02"}]
    caps = [
        _cap("boone", {"2026-08-01": 100.0}),
        _cap("boone", {"2026-08-01": 150.0}),
        _cap("boone", {"2026-08-01": None}),  # failed fetch: excluded, counted out
        _cap("blowing-rock", {"2026-08-01": 250.0}),
    ]
    s = summarize(caps, stays)
    assert s["towns"]["boone"]["2026-08-01"] == {
        "median_min_rate": 125.0,
        "hotels_reporting": 2,
    }
    assert s["towns"]["blowing-rock"]["2026-08-01"]["median_min_rate"] == 250.0


def test_summarize_all_failed_is_null_not_zero():
    stays = [{"chk_in": "2026-08-01", "chk_out": "2026-08-02"}]
    s = summarize([_cap("boone", {"2026-08-01": None})], stays)
    assert s["towns"]["boone"]["2026-08-01"] == {
        "median_min_rate": None,
        "hotels_reporting": 0,
    }


def test_high_share_counts_only_hotels_with_heatmaps():
    caps = [
        _cap("boone", {}, high_days=["2026-08-08", "2026-08-15"]),
        _cap("boone", {}, high_days=["2026-08-08"]),
        _cap("boone", {}, high_days=None),  # no heatmap: excluded from denominator
    ]
    share = high_share(caps)
    assert share == {"2026-08-08": 1.0, "2026-08-15": 0.5}
    assert high_share([_cap("boone", {}, high_days=None)]) == {}
