"""Offline unit tests for the OpenWeatherMap adapter's normalize_list function.

The sample payload below mirrors the real OWM /data/2.5/forecast JSON shape:
  { "list": [ <3-hourly entries> ] }

We test two days to verify:
  - correct daily max/min aggregation
  - correct mm->inch rain/snow conversion
  - correct precip_type derivation
  - correct fields_provided
"""
import pytest
from sources.openweathermap import normalize_list

# ---------------------------------------------------------------------------
# Minimal realistic sample: two days, four 3-hour slots each
# Day 1: 2026-07-04 — warm, no rain, breezy
# Day 2: 2026-07-05 — cooler, 6mm rain, 0mm snow
# ---------------------------------------------------------------------------

SAMPLE_LIST = [
    # ---- Day 1: 2026-07-04 ----
    {
        "dt_txt": "2026-07-04 00:00:00",
        "main": {"temp_max": 72.5, "temp_min": 65.1},
        "wind": {"speed": 8.2},
        "weather": [{"main": "Clear"}],
    },
    {
        "dt_txt": "2026-07-04 03:00:00",
        "main": {"temp_max": 70.0, "temp_min": 63.4},
        "wind": {"speed": 6.5},
        "weather": [{"main": "Clouds"}],
    },
    {
        "dt_txt": "2026-07-04 06:00:00",
        "main": {"temp_max": 80.3, "temp_min": 68.9},
        "wind": {"speed": 12.1},
        "weather": [{"main": "Clear"}],
    },
    {
        "dt_txt": "2026-07-04 09:00:00",
        "main": {"temp_max": 78.0, "temp_min": 66.2},
        "wind": {"speed": 9.8},
        "weather": [{"main": "Clear"}],
    },
    # ---- Day 2: 2026-07-05 — rainy ----
    {
        "dt_txt": "2026-07-05 00:00:00",
        "main": {"temp_max": 65.0, "temp_min": 58.3},
        "wind": {"speed": 5.0},
        "weather": [{"main": "Rain"}],
        "rain": {"3h": 2.5},
    },
    {
        "dt_txt": "2026-07-05 03:00:00",
        "main": {"temp_max": 63.2, "temp_min": 57.1},
        "wind": {"speed": 7.3},
        "weather": [{"main": "Rain"}],
        "rain": {"3h": 3.5},
    },
    {
        "dt_txt": "2026-07-05 06:00:00",
        "main": {"temp_max": 64.8, "temp_min": 56.0},
        "wind": {"speed": 4.9},
        "weather": [{"main": "Clouds"}],
    },
    {
        "dt_txt": "2026-07-05 09:00:00",
        "main": {"temp_max": 67.5, "temp_min": 59.9},
        "wind": {"speed": 6.1},
        "weather": [{"main": "Clear"}],
    },
]


@pytest.fixture
def days():
    return normalize_list(SAMPLE_LIST)


def test_returns_two_days(days):
    assert len(days) == 2


def test_dates_sorted(days):
    assert days[0]["date"] == "2026-07-04"
    assert days[1]["date"] == "2026-07-05"


# ---- Day 1 assertions ----

def test_day1_high_f(days):
    # max of [72.5, 70.0, 80.3, 78.0] = 80.3
    assert days[0]["high_f"] == 80.3


def test_day1_low_f(days):
    # min of [65.1, 63.4, 68.9, 66.2] = 63.4
    assert days[0]["low_f"] == 63.4


def test_day1_wind_mph(days):
    # max of [8.2, 6.5, 12.1, 9.8] = 12.1
    assert days[0]["wind_mph"] == 12.1


def test_day1_no_precip(days):
    assert days[0]["precip_type"] == "none"
    assert days[0]["rain_in"] is None
    assert days[0]["snow_in"] is None


# ---- Day 2 assertions ----

def test_day2_high_f(days):
    # max of [65.0, 63.2, 64.8, 67.5] = 67.5
    assert days[1]["high_f"] == 67.5


def test_day2_low_f(days):
    # min of [58.3, 57.1, 56.0, 59.9] = 56.0
    assert days[1]["low_f"] == 56.0


def test_day2_rain_in(days):
    # total rain_mm = 2.5 + 3.5 = 6.0 mm; / 25.4 = 0.23622... -> round 3dp = 0.236
    expected = round(6.0 / 25.4, 3)
    assert days[1]["rain_in"] == expected


def test_day2_snow_in(days):
    # no snow entries
    assert days[1]["snow_in"] is None


def test_day2_precip_type_rain(days):
    assert days[1]["precip_type"] == "rain"


def test_day2_wind_mph(days):
    # max of [5.0, 7.3, 4.9, 6.1] = 7.3
    assert days[1]["wind_mph"] == 7.3


# ---- fields_provided ----

def test_fields_provided_complete(days):
    for day in days:
        assert set(day["fields_provided"]) == {
            "high", "low", "wind", "precip_type", "rain_amount", "snow_amount"
        }


# ---- Mixed precip day (inline) ----

def test_mixed_precip():
    entries = [
        {
            "dt_txt": "2026-01-15 00:00:00",
            "main": {"temp_max": 34.0, "temp_min": 30.0},
            "wind": {"speed": 10.0},
            "weather": [{"main": "Snow"}],
            "rain": {"3h": 5.0},   # 5mm rain
            "snow": {"3h": 10.0},  # 10mm snow liquid equiv
        }
    ]
    result = normalize_list(entries)
    assert result[0]["precip_type"] == "mixed"
    assert result[0]["rain_in"] == round(5.0 / 25.4, 3)
    assert result[0]["snow_in"] == round(10.0 / 25.4, 3)
