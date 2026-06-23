"""Offline unit tests for the Tomorrow.io adapter's normalize_daily function.

conftest.py adds scripts/ to sys.path, so we can import from sources.tomorrowio directly.
The live API is never called — we build a realistic sample payload and test the
pure normalize_daily() function.
"""

from sources.tomorrowio import normalize_daily

# ---------------------------------------------------------------------------
# Realistic sample payload matching Tomorrow.io timelines.daily[] shape
# ---------------------------------------------------------------------------
SAMPLE_DAILY = [
    {
        "time": "2026-06-22T06:00:00Z",
        "values": {
            "temperatureMax": 78.5,
            "temperatureMin": 55.2,
            "windSpeedMax": 12.3,
            "windSpeedAvg": 8.1,
            "rainAccumulationSum": 0.04,
            "snowAccumulationSum": 0.0,
        },
    },
    {
        "time": "2026-06-23T06:00:00Z",
        "values": {
            "temperatureMax": 65.0,
            "temperatureMin": 42.0,
            "windSpeedMax": None,          # fallback to windSpeedAvg
            "windSpeedAvg": 7.5,
            "rainAccumulationSum": 0.0,
            "snowAccumulationSum": 2.5,    # snow day
        },
    },
    {
        "time": "2026-06-24T06:00:00Z",
        "values": {
            "temperatureMax": 72.1,
            "temperatureMin": 58.9,
            "windSpeedMax": 9.0,
            "windSpeedAvg": 6.0,
            "rainAccumulationSum": 0.125,
            "snowAccumulationSum": 1.0,    # mixed: both rain and snow present
        },
    },
    {
        "time": "2026-06-25T06:00:00Z",
        "values": {
            "temperatureMax": 85.0,
            "temperatureMin": 68.0,
            "windSpeedMax": 5.0,
            "windSpeedAvg": 3.5,
            "rainAccumulationSum": 0.0,
            "snowAccumulationSum": 0.0,    # dry day
        },
    },
]


def test_result_length_matches_input():
    result = normalize_daily(SAMPLE_DAILY)
    assert len(result) == 4


def test_date_extracted_correctly():
    result = normalize_daily(SAMPLE_DAILY)
    assert result[0]["date"] == "2026-06-22"
    assert result[1]["date"] == "2026-06-23"


def test_high_and_low_mapped_correctly():
    result = normalize_daily(SAMPLE_DAILY)
    assert result[0]["high_f"] == 78.5
    assert result[0]["low_f"] == 55.2


def test_wind_uses_max_when_present():
    result = normalize_daily(SAMPLE_DAILY)
    assert result[0]["wind_mph"] == 12.3


def test_wind_falls_back_to_avg_when_max_is_none():
    result = normalize_daily(SAMPLE_DAILY)
    # Day 1: windSpeedMax is None, should fall back to windSpeedAvg=7.5
    assert result[1]["wind_mph"] == 7.5


def test_rain_day_precip_type():
    result = normalize_daily(SAMPLE_DAILY)
    # Day 0: rain=0.04 (>0.005), snow=0.0 -> "rain"
    assert result[0]["precip_type"] == "rain"
    assert result[0]["rain_in"] == 0.04
    assert result[0]["snow_in"] == 0.0


def test_snow_day_precip_type():
    result = normalize_daily(SAMPLE_DAILY)
    # Day 1: rain=0.0, snow=2.5 (>0.05) -> "snow"
    assert result[1]["precip_type"] == "snow"
    assert result[1]["snow_in"] == 2.5


def test_mixed_precip_type():
    result = normalize_daily(SAMPLE_DAILY)
    # Day 2: rain=0.125 (>0.005) AND snow=1.0 (>0.05) -> "mixed"
    assert result[2]["precip_type"] == "mixed"


def test_dry_day_precip_type():
    result = normalize_daily(SAMPLE_DAILY)
    # Day 3: rain=0.0, snow=0.0 -> "none"
    assert result[3]["precip_type"] == "none"


def test_fields_provided_complete():
    result = normalize_daily(SAMPLE_DAILY)
    expected = ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]
    assert result[0]["fields_provided"] == expected


def test_amounts_rounded_to_3dp():
    result = normalize_daily([{
        "time": "2026-06-26T06:00:00Z",
        "values": {
            "temperatureMax": 70.123456,
            "temperatureMin": 50.987654,
            "windSpeedMax": 11.555555,
            "windSpeedAvg": 5.0,
            "rainAccumulationSum": 0.123456,
            "snowAccumulationSum": 0.0,
        },
    }])
    assert result[0]["high_f"] == 70.1
    assert result[0]["low_f"] == 51.0
    assert result[0]["wind_mph"] == 11.6
    assert result[0]["rain_in"] == 0.123
