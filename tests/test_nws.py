"""Offline unit tests for the NWS adapter's normalize_periods() function.

conftest.py adds scripts/ to sys.path, so we can import directly from sources/nws.py.
No network calls are made — we supply a hand-built sample payload that mirrors the
real NWS API shape (properties.periods[]).
"""
from sources.nws import normalize_periods

# Minimal realistic sample — two days (4 periods: day/night pairs).
# NWS periods alternate isDaytime True / False.
SAMPLE_PERIODS = [
    {
        "number": 1,
        "isDaytime": True,
        "startTime": "2026-06-22T06:00:00-04:00",
        "endTime": "2026-06-22T18:00:00-04:00",
        "temperature": 78,
        "temperatureUnit": "F",
        "windSpeed": "10 mph",
        "windDirection": "SW",
        "shortForecast": "Mostly Cloudy",
        "detailedForecast": "Mostly cloudy. Highs around 78.",
    },
    {
        "number": 2,
        "isDaytime": False,
        "startTime": "2026-06-22T18:00:00-04:00",
        "endTime": "2026-06-23T06:00:00-04:00",
        "temperature": 58,
        "temperatureUnit": "F",
        "windSpeed": "6 mph",
        "windDirection": "W",
        "shortForecast": "Mostly Clear",
        "detailedForecast": "Mostly clear. Lows around 58.",
    },
    {
        "number": 3,
        "isDaytime": True,
        "startTime": "2026-06-23T06:00:00-04:00",
        "endTime": "2026-06-23T18:00:00-04:00",
        "temperature": 65,
        "temperatureUnit": "F",
        "windSpeed": "15 to 20 mph",
        "windDirection": "NW",
        "shortForecast": "Rain Showers",
        "detailedForecast": "Rain showers likely. Chance of thunderstorms late.",
    },
    {
        "number": 4,
        "isDaytime": False,
        "startTime": "2026-06-23T18:00:00-04:00",
        "endTime": "2026-06-24T06:00:00-04:00",
        "temperature": 50,
        "temperatureUnit": "F",
        "windSpeed": "8 mph",
        "windDirection": "N",
        "shortForecast": "Chance Snow Showers",
        "detailedForecast": "Chance of snow showers overnight.",
    },
]

# A period list that starts with a night entry (edge-case: odd ordering)
NIGHT_FIRST_PERIODS = [
    {
        "number": 1,
        "isDaytime": False,
        "startTime": "2026-06-21T18:00:00-04:00",
        "endTime": "2026-06-22T06:00:00-04:00",
        "temperature": 55,
        "temperatureUnit": "F",
        "windSpeed": "5 mph",
        "windDirection": "S",
        "shortForecast": "Partly Cloudy",
        "detailedForecast": "Partly cloudy.",
    },
    {
        "number": 2,
        "isDaytime": True,
        "startTime": "2026-06-22T06:00:00-04:00",
        "endTime": "2026-06-22T18:00:00-04:00",
        "temperature": 82,
        "temperatureUnit": "F",
        "windSpeed": "12 mph",
        "windDirection": "SW",
        "shortForecast": "Sunny",
        "detailedForecast": "Sunny and warm.",
    },
    # No night follows — tests low_f fallback to None
]

# Snowy period for snow precip_type detection
SNOW_PERIODS = [
    {
        "number": 1,
        "isDaytime": True,
        "startTime": "2026-12-15T06:00:00-05:00",
        "endTime": "2026-12-15T18:00:00-05:00",
        "temperature": 28,
        "temperatureUnit": "F",
        "windSpeed": "20 mph",
        "windDirection": "N",
        "shortForecast": "Heavy Snow",
        "detailedForecast": "Heavy snow expected. Blizzard conditions possible.",
    },
    {
        "number": 2,
        "isDaytime": False,
        "startTime": "2026-12-15T18:00:00-05:00",
        "endTime": "2026-12-16T06:00:00-05:00",
        "temperature": 18,
        "temperatureUnit": "F",
        "windSpeed": "15 mph",
        "windDirection": "N",
        "shortForecast": "Freezing",
        "detailedForecast": "Freezing temperatures overnight.",
    },
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_returns_two_days_for_four_periods():
    result = normalize_periods(SAMPLE_PERIODS)
    assert len(result) == 2


def test_first_day_date():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[0]["date"] == "2026-06-22"


def test_first_day_high_f():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[0]["high_f"] == 78.0


def test_first_day_low_f_from_next_night():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[0]["low_f"] == 58.0


def test_first_day_wind_mph():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[0]["wind_mph"] == 10.0


def test_first_day_precip_type_none():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[0]["precip_type"] == "none"


def test_second_day_precip_type_rain():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[1]["precip_type"] == "rain"


def test_second_day_high_f():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[1]["high_f"] == 65.0


def test_second_day_wind_mph_uses_first_integer():
    # "15 to 20 mph" -> 15.0
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[1]["wind_mph"] == 15.0


def test_second_day_low_f_when_night_follows():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[1]["low_f"] == 50.0


def test_rain_and_snow_amounts_are_none():
    result = normalize_periods(SAMPLE_PERIODS)
    for day in result:
        assert day["rain_in"] is None
        assert day["snow_in"] is None


def test_fields_provided():
    result = normalize_periods(SAMPLE_PERIODS)
    for day in result:
        assert day["fields_provided"] == ["high", "low", "wind", "precip_type"]


def test_snow_precip_type():
    result = normalize_periods(SNOW_PERIODS)
    assert len(result) == 1
    assert result[0]["precip_type"] == "snow"


def test_snow_day_low_f():
    result = normalize_periods(SNOW_PERIODS)
    assert result[0]["low_f"] == 18.0


def test_night_first_skipped_only_day_returned():
    result = normalize_periods(NIGHT_FIRST_PERIODS)
    assert len(result) == 1
    assert result[0]["date"] == "2026-06-22"
    assert result[0]["high_f"] == 82.0


def test_no_following_night_low_is_none():
    # NIGHT_FIRST_PERIODS: the single daytime entry has no nighttime pair
    result = normalize_periods(NIGHT_FIRST_PERIODS)
    assert result[0]["low_f"] is None
