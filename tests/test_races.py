"""Pure-function tests for scripts/capture_races.py (no network)."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_races import is_sample_day, parse_us_date, slim, within_window


def test_sample_day_is_monday_only():
    # 2026-07-20 is a Monday.
    assert [is_sample_day(date(2026, 7, 20 + i)) for i in range(7)] == [
        True, False, False, False, False, False, False,
    ]


def test_parse_us_date_to_iso():
    assert parse_us_date("08/09/2026") == "2026-08-09"
    assert parse_us_date("12/01/2026") == "2026-12-01"


def test_parse_us_date_bad_input():
    assert parse_us_date(None) is None
    assert parse_us_date("") is None
    assert parse_us_date("2026-08-09") is None  # already ISO, not the US format
    assert parse_us_date("garbage") is None


def test_slim_maps_race_fields():
    race = {
        "race_id": 12345, "name": "Boone Trail 5K",
        "next_date": "08/29/2026", "next_end_date": "08/29/2026",
        "is_registration_open": "T",
        "address": {"city": "Boone", "state": "NC", "zipcode": "28607"},
        "url": "https://runsignup.com/Race/NC/Boone/BooneTrail5K",
    }
    assert slim(race) == {
        "race_id": 12345, "name": "Boone Trail 5K",
        "date": "2026-08-29", "end_date": "2026-08-29",
        "city": "Boone", "state": "NC",
        "registration_open": True,
        "url": "https://runsignup.com/Race/NC/Boone/BooneTrail5K",
    }


def test_slim_registration_closed_and_missing_date():
    assert slim({"next_date": "01/01/2027", "is_registration_open": "F"})["registration_open"] is False
    assert slim({"name": "no date race"}) is None  # no next_date -> dropped


def test_within_window_filters_and_sorts():
    today = date(2026, 7, 25)
    horizon = date(2027, 7, 25)
    races = [
        {"date": "2026-08-08", "name": "B race"},
        {"date": "2026-08-08", "name": "A race"},   # same date, earlier name
        {"date": "2025-01-01", "name": "past"},      # before today -> dropped
        {"date": "2030-01-01", "name": "far future"},  # after horizon -> dropped
        {"date": "bad", "name": "unparseable"},       # dropped
    ]
    out = within_window(races, today, horizon)
    assert [r["name"] for r in out] == ["A race", "B race"]


def test_within_window_includes_boundaries():
    today = date(2026, 7, 25)
    horizon = date(2027, 7, 25)
    races = [{"date": "2026-07-25", "name": "today"},
             {"date": "2027-07-25", "name": "horizon"}]
    out = within_window(races, today, horizon)
    assert {r["name"] for r in out} == {"today", "horizon"}
