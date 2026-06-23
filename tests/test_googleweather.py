"""Offline tests for the Google Weather adapter normalize_days() function.

Uses a hand-built sample payload matching the Google Weather API JSON shape.
No network calls are made — conftest.py puts scripts/ on sys.path so we can
import directly from sources.googleweather.
"""
from sources.googleweather import normalize_days

# ---------------------------------------------------------------------------
# Sample payload: three days, matching the Google Weather forecastDays[] shape.
# ---------------------------------------------------------------------------
SAMPLE_FORECAST_DAYS = [
    {
        "displayDate": {"year": 2026, "month": 6, "day": 22},
        "maxTemperature": {"degrees": 78.5},
        "minTemperature": {"degrees": 54.2},
        "daytimeForecast": {
            "wind": {"speed": {"value": 12.3}},
            "precipitation": {
                "qpf": {"quantity": 0.14},
                "snowQpf": {"quantity": 0.0},
                "probability": {"type": "RAIN"},
            },
        },
    },
    {
        "displayDate": {"year": 2026, "month": 6, "day": 23},
        "maxTemperature": {"degrees": 65.0},
        "minTemperature": {"degrees": 40.0},
        "daytimeForecast": {
            "wind": {"speed": {"value": 8.0}},
            "precipitation": {
                "qpf": {"quantity": 0.0},
                "snowQpf": {"quantity": 2.0},
                "probability": {"type": "SNOW"},
            },
        },
    },
    {
        "displayDate": {"year": 2026, "month": 6, "day": 24},
        "maxTemperature": {"degrees": 82.0},
        "minTemperature": {"degrees": 60.0},
        "daytimeForecast": {
            "wind": {"speed": {"value": 5.5}},
            "precipitation": {
                "qpf": {"quantity": 0.0},
                "snowQpf": {"quantity": 0.0},
                "probability": {"type": "NONE"},
            },
        },
    },
]


def test_normalize_returns_three_days():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert len(result) == 3


def test_day_one_date():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[0]["date"] == "2026-06-22"


def test_day_one_high_and_low():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[0]["high_f"] == 78.5
    assert result[0]["low_f"] == 54.2


def test_day_one_wind():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[0]["wind_mph"] == 12.3


def test_day_one_precip_type_rain():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[0]["precip_type"] == "rain"


def test_day_one_rain_amount():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[0]["rain_in"] == 0.14


def test_day_two_precip_type_snow():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[1]["precip_type"] == "snow"


def test_day_two_snow_amount():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[1]["snow_in"] == 2.0


def test_day_three_precip_type_none():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[2]["precip_type"] == "none"


def test_fields_provided_complete():
    """All six fields must be listed for every day (Google supplies them all)."""
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    expected = {"high", "low", "wind", "precip_type", "rain_amount", "snow_amount"}
    for day in result:
        assert set(day["fields_provided"]) == expected


def test_day_two_date_zero_padded():
    result = normalize_days(SAMPLE_FORECAST_DAYS)
    assert result[1]["date"] == "2026-06-23"


def test_missing_optional_keys_do_not_crash():
    """If snowQpf is absent, snow_in should default to 0.0 without KeyError."""
    sparse = [
        {
            "displayDate": {"year": 2026, "month": 1, "day": 5},
            "maxTemperature": {"degrees": 35.0},
            "minTemperature": {"degrees": 22.0},
            "daytimeForecast": {
                "wind": {"speed": {"value": 10.0}},
                "precipitation": {
                    "qpf": {"quantity": 0.05},
                    # snowQpf deliberately omitted
                    "probability": {"type": "RAIN"},
                },
            },
        }
    ]
    result = normalize_days(sparse)
    assert result[0]["snow_in"] == 0.0
    assert result[0]["rain_in"] == 0.05
    assert result[0]["precip_type"] == "rain"
