"""Tests for the Visual Crossing adapter's normalize_days() function.

conftest.py adds scripts/ to sys.path, so we import from sources.visualcrossing directly.
"""
from sources.visualcrossing import normalize_days


# A small but realistic sample matching the Visual Crossing Timeline "days" shape.
SAMPLE_DAYS = [
    {
        "datetime": "2026-06-22",
        "tempmax": 74.3,
        "tempmin": 58.1,
        "windspeed": 12.4,
        "precip": 0.25,
        "snow": None,
        "preciptype": ["rain"],
    },
    {
        "datetime": "2026-06-23",
        "tempmax": 55.0,
        "tempmin": 32.5,
        "windspeed": 8.0,
        "precip": 0.05,
        "snow": 3.2,
        "preciptype": ["snow", "freezingrain"],
    },
    {
        "datetime": "2026-06-24",
        "tempmax": 82.0,
        "tempmin": 65.0,
        "windspeed": 5.5,
        "precip": 0.0,
        "snow": None,
        "preciptype": None,
    },
]


def test_normalize_returns_one_dict_per_day():
    result = normalize_days(SAMPLE_DAYS)
    assert len(result) == 3


def test_date_passthrough():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["date"] == "2026-06-22"
    assert result[1]["date"] == "2026-06-23"


def test_high_and_low_temps():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["high_f"] == 74.3
    assert result[0]["low_f"] == 58.1
    assert result[1]["high_f"] == 55.0
    assert result[1]["low_f"] == 32.5


def test_wind_mph():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["wind_mph"] == 12.4
    assert result[2]["wind_mph"] == 5.5


def test_precip_type_rain():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["precip_type"] == "rain"


def test_precip_type_mixed_snow_and_freezingrain():
    result = normalize_days(SAMPLE_DAYS)
    # preciptype contains both "snow" and "freezingrain" -> mixed
    assert result[1]["precip_type"] == "mixed"


def test_precip_type_none_derived():
    result = normalize_days(SAMPLE_DAYS)
    # No preciptype list; precip=0.0, no snow -> derive_type -> "none"
    assert result[2]["precip_type"] == "none"


def test_rain_in_mapped_from_precip():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["rain_in"] == 0.25
    assert result[2]["rain_in"] == 0.0


def test_snow_in_none_when_absent():
    result = normalize_days(SAMPLE_DAYS)
    assert result[0]["snow_in"] is None


def test_snow_in_rounded():
    result = normalize_days(SAMPLE_DAYS)
    assert result[1]["snow_in"] == 3.2


def test_fields_provided_complete():
    result = normalize_days(SAMPLE_DAYS)
    expected = {"high", "low", "wind", "precip_type", "rain_amount", "snow_amount"}
    for day in result:
        assert set(day["fields_provided"]) == expected
