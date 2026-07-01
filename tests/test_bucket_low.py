"""Tests for the capture-day low recovery (compare._fix_bucket_low).

Met.no / OpenWeatherMap derive the daily low as min() over their sub-daily
timeseries; on the capture day that misses the pre-dawn trough, biasing the low
warm. The fix recovers the low from the day-ahead forecast issued the prior
morning, or forfeits it when no prior capture exists. Other sources (which read a
provider daily-min) are untouched."""
import compare


def _day(**kw):
    base = {
        "date": "2026-06-24", "high_f": 72.0, "low_f": 66.0, "wind_mph": 8.0,
        "precip_type": "none", "rain_in": 0.0, "snow_in": None,
        "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount"],
    }
    base.update(kw)
    return base


def test_bucket_low_recovered_from_day_ahead(monkeypatch):
    monkeypatch.setattr(compare, "_day_ahead_low", lambda k, d: 52.7)
    day = compare._fix_bucket_low("metno", "2026-06-24", _day())
    assert day["low_f"] == 52.7
    assert "low" in day["fields_provided"]  # still scored, with the correct low


def test_bucket_low_forfeited_when_no_prior_capture(monkeypatch):
    monkeypatch.setattr(compare, "_day_ahead_low", lambda k, d: None)
    day = compare._fix_bucket_low("openweathermap", "2026-06-23", _day(date="2026-06-23"))
    assert day["low_f"] is None
    assert "low" not in day["fields_provided"]  # forfeited, not scored against a bad value
    # every other field is left intact
    assert day["high_f"] == 72.0
    assert set(day["fields_provided"]) == {"high", "wind", "precip_type", "rain_amount"}


def test_non_bucket_source_is_untouched(monkeypatch):
    # A source that reads a provider daily-min must never be rewritten, even if a
    # prior-day forecast happens to exist.
    monkeypatch.setattr(compare, "_day_ahead_low", lambda k, d: 40.0)
    before = _day()
    after = compare._fix_bucket_low("openmeteo", "2026-06-24", dict(before))
    assert after["low_f"] == before["low_f"]
    assert after["fields_provided"] == before["fields_provided"]
