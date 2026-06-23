"""Offline unit tests for the WeatherAPI adapter's normalize function.

Uses a hand-built sample payload that mirrors the WeatherAPI forecastday shape.
No live API calls are made.
"""
from sources.weatherapi import normalize_forecastdays

# Realistic sample payload: 3 forecast days
# Day 1: rain day (totalprecip_in > 0, daily_will_it_rain=1, no snow)
# Day 2: snow day (totalsnow_cm > 0, daily_will_it_snow=1, no rain)
# Day 3: clear day (no precip)
SAMPLE_FORECASTDAY = [
    {
        "date": "2026-06-22",
        "day": {
            "maxtemp_f": 72.3,
            "mintemp_f": 51.8,
            "maxwind_mph": 14.5,
            "totalprecip_in": 0.45,
            "totalsnow_cm": 0.0,
            "daily_will_it_rain": 1,
            "daily_will_it_snow": 0,
            "condition": {"text": "Moderate rain"},
        },
    },
    {
        "date": "2026-06-23",
        "day": {
            "maxtemp_f": 33.1,
            "mintemp_f": 22.4,
            "maxwind_mph": 9.2,
            "totalprecip_in": 0.0,
            "totalsnow_cm": 7.62,   # 3 inches of snow depth
            "daily_will_it_rain": 0,
            "daily_will_it_snow": 1,
            "condition": {"text": "Heavy snow"},
        },
    },
    {
        "date": "2026-06-24",
        "day": {
            "maxtemp_f": 65.0,
            "mintemp_f": 45.2,
            "maxwind_mph": 5.0,
            "totalprecip_in": 0.0,
            "totalsnow_cm": 0.0,
            "daily_will_it_rain": 0,
            "daily_will_it_snow": 0,
            "condition": {"text": "Partly cloudy"},
        },
    },
]


def test_returns_three_days():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    assert len(result) == 3


def test_rain_day_date_and_temps():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    day = result[0]
    assert day["date"] == "2026-06-22"
    assert day["high_f"] == 72.3
    assert day["low_f"] == 51.8


def test_rain_day_wind_and_precip_type():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    day = result[0]
    assert day["wind_mph"] == 14.5
    assert day["precip_type"] == "rain"
    assert day["rain_in"] == 0.45


def test_snow_day_type_and_depth():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    day = result[1]
    assert day["date"] == "2026-06-23"
    assert day["precip_type"] == "snow"
    # 7.62 cm / 2.54 = 3.0 inches exactly
    assert day["snow_in"] == round(7.62 / 2.54, 3)
    assert day["snow_in"] == 3.0


def test_clear_day_precip_none():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    day = result[2]
    assert day["precip_type"] == "none"
    assert day["rain_in"] == 0.0
    assert day["snow_in"] == 0.0


def test_fields_provided_complete_for_all_days():
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    expected = ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]
    for day in result:
        assert day["fields_provided"] == expected


def test_snow_depth_conversion_is_cm_to_inches():
    """7.62 cm / 2.54 = exactly 3.000 inches."""
    result = normalize_forecastdays(SAMPLE_FORECASTDAY)
    snow_day = result[1]
    assert snow_day["snow_in"] == 3.0


def test_mixed_precip_day():
    """A day with both rain and snow flags set should yield 'mixed'."""
    mixed_day = [
        {
            "date": "2026-06-25",
            "day": {
                "maxtemp_f": 35.0,
                "mintemp_f": 28.0,
                "maxwind_mph": 12.0,
                "totalprecip_in": 0.15,
                "totalsnow_cm": 2.54,   # 1 inch snow depth
                "daily_will_it_rain": 1,
                "daily_will_it_snow": 1,
                "condition": {"text": "Sleet"},
            },
        }
    ]
    result = normalize_forecastdays(mixed_day)
    assert result[0]["precip_type"] == "mixed"
    assert result[0]["rain_in"] == 0.15
    assert result[0]["snow_in"] == 1.0
