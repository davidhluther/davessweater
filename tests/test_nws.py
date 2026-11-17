"""Offline unit tests for the NWS adapter's normalize_periods() function.

conftest.py adds scripts/ to sys.path, so we can import directly from sources/nws.py.
No network calls are made — we supply a hand-built sample payload that mirrors the
real NWS API shape (properties.periods[]).
"""
import pytest

from sources.nws import _precip_type, normalize_periods

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


# ---------------------------------------------------------------------------
# Precip-type classification from forecast text
#
# NWS writes its precip words in the plural far more often than the singular
# ("Chance Showers And Thunderstorms", "Snow Showers Likely", "Flurries").
# precip is a 20-point field, so a word the classifier cannot see is scored as
# a "no precipitation" claim the forecast never made.
# ---------------------------------------------------------------------------

def _classify(short_forecast, detailed_forecast=None):
    """Classify one daytime period through the real normalize_periods path."""
    period = {
        "number": 1,
        "isDaytime": True,
        "startTime": "2026-01-15T06:00:00-05:00",
        "endTime": "2026-01-15T18:00:00-05:00",
        "temperature": 40,
        "temperatureUnit": "F",
        "windSpeed": "5 mph",
        "windDirection": "N",
        "shortForecast": short_forecast,
        "detailedForecast": (
            detailed_forecast if detailed_forecast is not None
            else short_forecast + "."
        ),
    }
    return normalize_periods([period])[0]["precip_type"]


PRECIP_TEXT_CASES = [
    # Plural forms — the shape NWS actually publishes.
    ("Showers Likely", "rain"),
    ("Chance Showers And Thunderstorms", "rain"),
    ("Scattered Thunderstorms", "rain"),
    ("Sprinkles possible this afternoon", "rain"),
    ("Areas of drizzle", "rain"),
    ("Flurries", "snow"),
    ("Snow Flurries Likely", "snow"),
    ("Snow Showers Likely", "snow"),
    ("Areas of blowing snow with icy patches", "snow"),
    # Singular forms must keep working.
    ("Rain Shower", "rain"),
    ("Heavy Snow", "snow"),
    ("Chance Thunderstorm", "rain"),
    # A bare "shower" is a rain shower unless the text names snow.
    ("Isolated Showers", "rain"),
    ("Rain And Snow Showers", "mixed"),
    # Dry text must stay dry — no false positives from the looser match.
    ("Sunny", "none"),
    ("Mostly Cloudy", "none"),
    ("Partly Sunny", "none"),
    ("Patchy Fog", "none"),
]


@pytest.mark.parametrize("text,expected", PRECIP_TEXT_CASES)
def test_precip_type_from_forecast_text(text, expected):
    assert _classify(text) == expected


# ---------------------------------------------------------------------------
# Raw forecast text is kept so a future classifier change can be replayed
# against history instead of being unrepairable (the plural-precip bug was
# unfixable in history precisely because only the verdict was stored).
# ---------------------------------------------------------------------------

def test_source_text_is_preserved():
    result = normalize_periods(SAMPLE_PERIODS)
    assert result[1]["short_forecast"] == "Rain Showers"
    assert result[1]["detailed_forecast"] == (
        "Rain showers likely. Chance of thunderstorms late."
    )


def test_stored_text_replays_to_the_stored_precip_type():
    """The whole point: the verdict must be re-derivable from what we kept."""
    for day in normalize_periods(SAMPLE_PERIODS) + normalize_periods(SNOW_PERIODS):
        replayed = _precip_type(day["short_forecast"], day["detailed_forecast"])
        assert replayed == day["precip_type"]


def test_missing_source_text_is_none_not_an_error():
    periods = [dict(SAMPLE_PERIODS[0])]
    del periods[0]["shortForecast"]
    del periods[0]["detailedForecast"]
    result = normalize_periods(periods)
    assert result[0]["short_forecast"] is None
    assert result[0]["detailed_forecast"] is None


def test_source_text_is_not_a_scored_field():
    # fields_provided is the scoring contract; raw text must stay out of it.
    for day in normalize_periods(SAMPLE_PERIODS):
        assert "short_forecast" not in day["fields_provided"]
        assert "detailed_forecast" not in day["fields_provided"]


def test_live_boone_period_with_only_plural_precip_words():
    """Regression: verified live 2026-07-27 against gridpoint RNK/17,16.

    Every precip word in this period is plural, so the classifier used to
    return "none" for a forecast that plainly called for showers.
    """
    assert _classify(
        "Chance Showers And Thunderstorms",
        "A chance of showers and thunderstorms between 7am and 11am, then "
        "showers and thunderstorms likely after 11am.",
    ) == "rain"
