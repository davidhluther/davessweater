"""Offline unit tests for the Met.no adapter's normalize_timeseries function.

The sample payload mimics the Met.no Locationforecast 2.0 compact JSON shape
but is entirely hand-built — no live API call is made.

Two dates are covered so that the grouping logic (accumulating multiple hourly
entries into a single daily record) is exercised:
  2026-06-22 — three entries, warm, rainy
  2026-06-23 — three entries, cold, precip at/below 0 °C (triggers snow path)
"""
from sources.metno import normalize_timeseries


# ---------------------------------------------------------------------------
# Sample payload — realistic shape, hand-crafted values
# ---------------------------------------------------------------------------

SAMPLE_TIMESERIES = [
    # --- 2026-06-22 (warm rainy day) ---
    {
        "time": "2026-06-22T00:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": 18.0, "wind_speed": 3.0}},
            "next_1_hours": {"details": {"precipitation_amount": 0.0}},
        },
    },
    {
        "time": "2026-06-22T06:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": 22.5, "wind_speed": 5.0}},
            "next_1_hours": {"details": {"precipitation_amount": 2.54}},  # 0.1 in of rain
        },
    },
    {
        "time": "2026-06-22T12:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": 26.0, "wind_speed": 7.5}},
            "next_1_hours": {"details": {"precipitation_amount": 0.0}},
        },
    },
    # --- 2026-06-23 (cold day, precip at freezing => snow path) ---
    {
        "time": "2026-06-23T00:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": -2.0, "wind_speed": 4.0}},
            "next_1_hours": {"details": {"precipitation_amount": 5.08}},  # 0.2 in liquid
        },
    },
    {
        "time": "2026-06-23T06:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": -0.5, "wind_speed": 6.0}},
            "next_1_hours": {"details": {"precipitation_amount": 0.0}},
        },
    },
    {
        "time": "2026-06-23T12:00:00Z",
        "data": {
            "instant": {"details": {"air_temperature": 3.0, "wind_speed": 2.0}},
            "next_1_hours": {"details": {"precipitation_amount": 0.0}},
        },
    },
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_returns_two_days():
    result = normalize_timeseries(SAMPLE_TIMESERIES)
    assert len(result) == 2


def test_dates_are_correct():
    result = normalize_timeseries(SAMPLE_TIMESERIES)
    assert result[0]["date"] == "2026-06-22"
    assert result[1]["date"] == "2026-06-23"


def test_warm_day_high_f():
    """Max temp on day 1 is 26.0 °C → 78.8 °F."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[0]
    assert day["high_f"] == round(26.0 * 9 / 5 + 32, 1)  # 78.8


def test_warm_day_low_f():
    """Min temp on day 1 is 18.0 °C → 64.4 °F."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[0]
    assert day["low_f"] == round(18.0 * 9 / 5 + 32, 1)  # 64.4


def test_warm_day_wind_mph():
    """Max wind on day 1 is 7.5 m/s → ~16.8 mph (rounded to 1 dp)."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[0]
    assert day["wind_mph"] == round(7.5 * 2.23694, 1)


def test_warm_day_precip_type_is_rain():
    """Day 1 has precip but all temps above 0 → rain."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[0]
    assert day["precip_type"] == "rain"


def test_warm_day_rain_in():
    """Day 1 has 2.54 mm of precip → 0.1 in (rounded to 3 dp)."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[0]
    assert day["rain_in"] == round(2.54 / 25.4, 3)  # 0.1


def test_cold_day_precip_type_is_snow():
    """Day 2 has precip while temp <= 0 °C → snow path."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[1]
    assert day["precip_type"] == "snow"


def test_cold_day_rain_in():
    """Day 2 total precip = 5.08 mm → ~0.2 in liquid (snow depth is None)."""
    day = normalize_timeseries(SAMPLE_TIMESERIES)[1]
    assert day["rain_in"] == round(5.08 / 25.4, 3)  # 0.2


def test_snow_in_is_none():
    """Met.no compact gives liquid mm, not snow depth — snow_in must be None."""
    result = normalize_timeseries(SAMPLE_TIMESERIES)
    for day in result:
        assert day["snow_in"] is None


def test_fields_provided():
    """Adapter commits to 5 fields; snow_amount is absent by design."""
    result = normalize_timeseries(SAMPLE_TIMESERIES)
    expected = {"high", "low", "wind", "precip_type", "rain_amount"}
    for day in result:
        assert set(day["fields_provided"]) == expected
        assert "snow_amount" not in day["fields_provided"]
