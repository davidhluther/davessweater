"""The cross-adapter precipitation-probability contract.

Every adapter must emit a `precip_prob` key on each daily row: an int percent
0-100 where its provider publishes a probability, None where it doesn't. The
rule that matters is the one this file exists to pin down — a source that
publishes no probability FORFEITS, and nothing here may ever synthesize one from
a precipitation amount.

Kept in one file rather than sprinkled across the seven per-adapter test modules
so the "every adapter" claim is checkable in one place, and so a new adapter
that quietly omits the field fails a test that names the contract.

conftest.py puts scripts/ on sys.path, so `sources.*` imports work directly.
No network calls — every payload below is hand-built.
"""
import pytest

from sources import to_percent, max_percent
from sources.googleweather import normalize_days as google_days
from sources.metno import normalize_timeseries as metno_series
from sources.nws import normalize_periods as nws_periods
from sources.openweathermap import normalize_list as owm_list
from sources.tomorrowio import normalize_daily as tomorrow_daily
from sources.visualcrossing import normalize_days as vc_days
from sources.weatherapi import normalize_forecastdays as weatherapi_days


# ══════════════════════════════════════════════════════════════════
# Shared helpers
# ══════════════════════════════════════════════════════════════════

def test_to_percent_passes_through_a_plain_percentage():
    assert to_percent(54) == 54
    assert to_percent(0) == 0
    assert to_percent(100) == 100


def test_to_percent_scales_a_fraction():
    """OpenWeatherMap ships `pop` as a 0-1 fraction."""
    assert to_percent(0.34, scale=100) == 34
    assert to_percent(1, scale=100) == 100


def test_to_percent_rounds_to_a_whole_percent():
    assert to_percent(54.4) == 54
    assert to_percent(54.6) == 55
    assert to_percent(0.34567, scale=100) == 35
    # Exact halves follow Python's round() (banker's rounding). Pinned here so
    # the tie rule is a documented choice rather than a surprise; at a whole
    # percent on a display-only field, either way rounds to the same weather.
    assert to_percent(54.5) == 54
    assert to_percent(55.5) == 56


def test_to_percent_clamps_out_of_range_values():
    """A provider handing back 101 or -0.2 is a rounding artifact of a real
    forecast, not a missing one — clamp it rather than forfeit it."""
    assert to_percent(101) == 100
    assert to_percent(140) == 100
    assert to_percent(-3) == 0
    assert to_percent(1.4, scale=100) == 100
    assert to_percent(-0.02, scale=100) == 0


def test_to_percent_forfeits_on_anything_unusable():
    assert to_percent(None) is None
    assert to_percent("") is None
    assert to_percent("not a number") is None
    assert to_percent(float("nan")) is None
    # Booleans are ints in Python; True must not read as 100%.
    assert to_percent(True) is None
    assert to_percent(False) is None


def test_to_percent_accepts_a_quoted_number():
    """Some providers have shipped their percentages as strings."""
    assert to_percent("70") == 70
    assert to_percent("0.4", scale=100) == 40


def test_max_percent_takes_the_day_max_across_parts():
    assert max_percent([10, 54, 38]) == 54
    assert max_percent([0.1, 0.6], scale=100) == 60


def test_max_percent_ignores_unusable_parts_but_keeps_the_rest():
    assert max_percent([None, 40, "x"]) == 40


def test_max_percent_forfeits_when_no_part_is_usable():
    """No parts is a forfeit, not a zero — the whole point of the exercise."""
    assert max_percent([]) is None
    assert max_percent([None, None]) is None


def test_max_percent_keeps_a_genuine_zero():
    """0% is a real forecast ("it will not rain"), distinct from silence."""
    assert max_percent([0, None]) == 0


# ══════════════════════════════════════════════════════════════════
# NWS — probabilityOfPrecipitation.value (wmoUnit:percent), per period
# ══════════════════════════════════════════════════════════════════

def _nws_pair(day_pop, night_pop, date="2026-07-28"):
    def pop(v):
        return {"unitCode": "wmoUnit:percent", "value": v}
    return [
        {"isDaytime": True, "startTime": f"{date}T06:00:00-04:00", "temperature": 80,
         "windSpeed": "7 mph", "shortForecast": "Chance Rain",
         "probabilityOfPrecipitation": pop(day_pop)},
        {"isDaytime": False, "startTime": f"{date}T18:00:00-04:00", "temperature": 62,
         "windSpeed": "5 mph", "shortForecast": "Partly Cloudy",
         "probabilityOfPrecipitation": pop(night_pop)},
    ]


def test_nws_takes_the_max_of_the_day_and_its_paired_night():
    """The pairing that sources low_f from the night also spans its PoP."""
    assert nws_periods(_nws_pair(54, 38))[0]["precip_prob"] == 54
    assert nws_periods(_nws_pair(12, 71))[0]["precip_prob"] == 71


def test_nws_forfeits_when_both_periods_report_null():
    """NWS ships the key with a null value constantly. Null is absence."""
    assert nws_periods(_nws_pair(None, None))[0]["precip_prob"] is None


def test_nws_uses_the_period_that_has_a_value():
    assert nws_periods(_nws_pair(None, 45))[0]["precip_prob"] == 45
    assert nws_periods(_nws_pair(45, None))[0]["precip_prob"] == 45


def test_nws_forfeits_when_the_key_is_missing_entirely():
    periods = _nws_pair(30, 30)
    for p in periods:
        del p["probabilityOfPrecipitation"]
    assert nws_periods(periods)[0]["precip_prob"] is None


def test_nws_clamps_an_out_of_range_value():
    assert nws_periods(_nws_pair(120, 10))[0]["precip_prob"] == 100
    assert nws_periods(_nws_pair(-5, None))[0]["precip_prob"] == 0


def test_nws_does_not_claim_the_probability_as_a_scored_field():
    """precip_prob is displayed, never graded — adding it to fields_provided
    would silently move every source's coverage denominator."""
    day = nws_periods(_nws_pair(54, 38))[0]
    assert day["fields_provided"] == ["high", "low", "wind", "precip_type"]


# ══════════════════════════════════════════════════════════════════
# Met.no — an honest forfeit (no probability in locationforecast here)
# ══════════════════════════════════════════════════════════════════

def _metno_entry(time, temp_c=18.0, precip_mm=0.0):
    return {
        "time": time,
        "data": {
            "instant": {"details": {"air_temperature": temp_c, "wind_speed": 2.0}},
            "next_1_hours": {"details": {"precipitation_amount": precip_mm}},
        },
    }


def test_metno_forfeits_the_probability_even_on_a_wet_day():
    """Met.no publishes an amount but no probability at these coordinates
    (verified live 2026-07-27 on both the compact and complete products). A wet
    forecast must NOT be turned into a made-up percentage."""
    rows = metno_series([
        _metno_entry("2026-06-22T09:00:00Z", 18.0, 2.5),
        _metno_entry("2026-06-22T15:00:00Z", 21.0, 4.0),
    ])
    assert rows[0]["precip_type"] == "rain"
    assert rows[0]["rain_in"] > 0
    assert rows[0]["precip_prob"] is None


def test_metno_still_emits_the_key_so_the_forfeit_is_explicit():
    rows = metno_series([_metno_entry("2026-06-22T09:00:00Z")])
    assert "precip_prob" in rows[0]


# ══════════════════════════════════════════════════════════════════
# OpenWeatherMap — list[].pop, a 0-1 fraction on each 3-hour block
# ══════════════════════════════════════════════════════════════════

def _owm_entry(dt_txt, pop=None):
    e = {"dt_txt": dt_txt, "main": {"temp_max": 70.0, "temp_min": 55.0},
         "wind": {"speed": 8.0}}
    if pop is not None:
        e["pop"] = pop
    return e


def test_owm_converts_the_fraction_and_takes_the_day_max():
    rows = owm_list([
        _owm_entry("2026-06-22 06:00:00", 0.12),
        _owm_entry("2026-06-22 15:00:00", 0.64),
        _owm_entry("2026-06-22 21:00:00", 0.30),
    ])
    assert rows[0]["precip_prob"] == 64


def test_owm_forfeits_when_no_block_carries_pop():
    rows = owm_list([_owm_entry("2026-06-22 06:00:00"),
                     _owm_entry("2026-06-22 15:00:00")])
    assert rows[0]["precip_prob"] is None


def test_owm_keeps_a_genuine_zero_percent_day():
    rows = owm_list([_owm_entry("2026-06-22 06:00:00", 0)])
    assert rows[0]["precip_prob"] == 0


def test_owm_clamps_a_fraction_above_one():
    rows = owm_list([_owm_entry("2026-06-22 06:00:00", 1.2)])
    assert rows[0]["precip_prob"] == 100


def test_owm_groups_probability_per_day_not_across_the_window():
    rows = owm_list([
        _owm_entry("2026-06-22 15:00:00", 0.90),
        _owm_entry("2026-06-23 15:00:00", 0.10),
    ])
    assert [r["precip_prob"] for r in rows] == [90, 10]


# ══════════════════════════════════════════════════════════════════
# WeatherAPI — day.daily_chance_of_rain / daily_chance_of_snow (int %)
# ══════════════════════════════════════════════════════════════════

def _weatherapi_day(**day):
    base = {"maxtemp_f": 70.0, "mintemp_f": 55.0, "maxwind_mph": 9.0,
            "totalprecip_in": 0.0, "totalsnow_cm": 0.0,
            "daily_will_it_rain": 0, "daily_will_it_snow": 0}
    base.update(day)
    return [{"date": "2026-06-22", "day": base}]


def test_weatherapi_takes_the_higher_of_the_rain_and_snow_chances():
    """Both describe the same day, so one chance of precip is their max."""
    rows = weatherapi_days(_weatherapi_day(daily_chance_of_rain=20,
                                           daily_chance_of_snow=75))
    assert rows[0]["precip_prob"] == 75


def test_weatherapi_uses_whichever_chance_is_present():
    assert weatherapi_days(_weatherapi_day(daily_chance_of_rain=44))[0]["precip_prob"] == 44
    assert weatherapi_days(_weatherapi_day(daily_chance_of_snow=61))[0]["precip_prob"] == 61


def test_weatherapi_forfeits_when_neither_chance_is_published():
    assert weatherapi_days(_weatherapi_day())[0]["precip_prob"] is None


def test_weatherapi_accepts_a_quoted_percentage():
    rows = weatherapi_days(_weatherapi_day(daily_chance_of_rain="80"))
    assert rows[0]["precip_prob"] == 80


def test_weatherapi_clamps_an_out_of_range_chance():
    rows = weatherapi_days(_weatherapi_day(daily_chance_of_rain=105))
    assert rows[0]["precip_prob"] == 100


# ══════════════════════════════════════════════════════════════════
# Visual Crossing — days[].precipprob (already the day's max of hourly)
# ══════════════════════════════════════════════════════════════════

def _vc_day(**day):
    base = {"datetime": "2026-06-22", "tempmax": 74.3, "tempmin": 58.1,
            "windspeed": 12.4, "precip": 0.0, "snow": None}
    base.update(day)
    return [base]


def test_vc_reads_the_daily_probability_as_published():
    assert vc_days(_vc_day(precipprob=62.0))[0]["precip_prob"] == 62


def test_vc_rounds_a_fractional_percentage():
    assert vc_days(_vc_day(precipprob=61.7))[0]["precip_prob"] == 62


def test_vc_forfeits_when_precipprob_is_absent_or_null():
    """precipprob is documented "forecast only" — a historical pull has none."""
    assert vc_days(_vc_day())[0]["precip_prob"] is None
    assert vc_days(_vc_day(precipprob=None))[0]["precip_prob"] is None


def test_vc_clamps_an_out_of_range_percentage():
    assert vc_days(_vc_day(precipprob=101.4))[0]["precip_prob"] == 100
    assert vc_days(_vc_day(precipprob=-2))[0]["precip_prob"] == 0


# ══════════════════════════════════════════════════════════════════
# Tomorrow.io — precipitationProbability{Max,Avg,} on the 1d timestep
# ══════════════════════════════════════════════════════════════════

def _tomorrow_day(**values):
    base = {"temperatureMax": 78.5, "temperatureMin": 55.2, "windSpeedMax": 12.3}
    base.update(values)
    return [{"time": "2026-06-22T06:00:00Z", "values": base}]


def test_tomorrow_prefers_the_max_variant():
    rows = tomorrow_daily(_tomorrow_day(precipitationProbabilityMax=65,
                                        precipitationProbabilityAvg=20,
                                        precipitationProbability=5))
    assert rows[0]["precip_prob"] == 65


def test_tomorrow_falls_back_through_avg_to_the_bare_key():
    """The exact spelling varies by plan tier and API version, same as the
    accumulation fields — read whichever the payload actually carries."""
    assert tomorrow_daily(_tomorrow_day(precipitationProbabilityAvg=20,
                                        precipitationProbability=5))[0]["precip_prob"] == 20
    assert tomorrow_daily(_tomorrow_day(precipitationProbability=5))[0]["precip_prob"] == 5


def test_tomorrow_forfeits_when_no_probability_key_is_present():
    assert tomorrow_daily(_tomorrow_day())[0]["precip_prob"] is None


def test_tomorrow_treats_a_present_key_with_a_null_value_as_a_forfeit():
    rows = tomorrow_daily(_tomorrow_day(precipitationProbabilityMax=None))
    assert rows[0]["precip_prob"] is None


def test_tomorrow_keeps_a_present_zero_rather_than_falling_through():
    """0 is a real forecast, so the first present key wins even at zero — the
    fallback chain must key off presence, not truthiness."""
    rows = tomorrow_daily(_tomorrow_day(precipitationProbabilityMax=0,
                                        precipitationProbabilityAvg=40))
    assert rows[0]["precip_prob"] == 0


def test_tomorrow_clamps_an_out_of_range_probability():
    assert tomorrow_daily(_tomorrow_day(precipitationProbabilityMax=110))[0]["precip_prob"] == 100


# ══════════════════════════════════════════════════════════════════
# Google Weather — {daytime,nighttime}Forecast.precipitation.probability.percent
# ══════════════════════════════════════════════════════════════════

def _google_part(percent=None, ptype="RAIN"):
    prob = {"type": ptype}
    if percent is not None:
        prob["percent"] = percent
    return {"wind": {"speed": {"value": 8.0}},
            "precipitation": {"probability": prob,
                              "qpf": {"quantity": 0.0}}}


def _google_day(day_pct=None, night_pct=None, with_night=True):
    fd = {
        "displayDate": {"year": 2026, "month": 6, "day": 22},
        "maxTemperature": {"degrees": 74.0},
        "minTemperature": {"degrees": 55.0},
        "daytimeForecast": _google_part(day_pct),
    }
    if with_night:
        fd["nighttimeForecast"] = _google_part(night_pct)
    return [fd]


def test_google_takes_the_max_across_the_day_and_night_parts():
    """The API publishes no whole-day figure, only day parts."""
    assert google_days(_google_day(30, 70))[0]["precip_prob"] == 70
    assert google_days(_google_day(70, 30))[0]["precip_prob"] == 70


def test_google_uses_the_daytime_part_when_there_is_no_night():
    assert google_days(_google_day(45, with_night=False))[0]["precip_prob"] == 45


def test_google_forfeits_when_neither_part_publishes_a_percent():
    assert google_days(_google_day())[0]["precip_prob"] is None


def test_google_keeps_a_genuine_zero():
    assert google_days(_google_day(0, 0))[0]["precip_prob"] == 0


def test_google_clamps_an_out_of_range_percent():
    assert google_days(_google_day(130, 10))[0]["precip_prob"] == 100


# ══════════════════════════════════════════════════════════════════
# The contract itself
# ══════════════════════════════════════════════════════════════════

# (adapter callable, minimal payload) for every registered source.
_ADAPTERS = [
    ("nws", nws_periods, _nws_pair(54, 38)),
    ("metno", metno_series, [_metno_entry("2026-06-22T09:00:00Z")]),
    ("openweathermap", owm_list, [_owm_entry("2026-06-22 06:00:00", 0.5)]),
    ("weatherapi", weatherapi_days, _weatherapi_day(daily_chance_of_rain=40)),
    ("visualcrossing", vc_days, _vc_day(precipprob=40)),
    ("tomorrowio", tomorrow_daily, _tomorrow_day(precipitationProbabilityMax=40)),
    ("googleweather", google_days, _google_day(40, 10)),
]


@pytest.mark.parametrize("key,normalize,payload", _ADAPTERS, ids=[a[0] for a in _ADAPTERS])
def test_every_adapter_emits_the_key(key, normalize, payload):
    """A new adapter that forgets precip_prob fails here, not silently in the UI
    six weeks later — which is exactly how the towns ended up saying only "dry"."""
    for row in normalize(payload):
        assert "precip_prob" in row, f"{key} dropped precip_prob"


@pytest.mark.parametrize("key,normalize,payload", _ADAPTERS, ids=[a[0] for a in _ADAPTERS])
def test_every_adapter_emits_an_int_percent_or_none(key, normalize, payload):
    for row in normalize(payload):
        prob = row["precip_prob"]
        assert prob is None or (isinstance(prob, int) and 0 <= prob <= 100), \
            f"{key} emitted {prob!r}"


@pytest.mark.parametrize("key,normalize,payload", _ADAPTERS, ids=[a[0] for a in _ADAPTERS])
def test_no_adapter_claims_the_probability_as_a_scored_field(key, normalize, payload):
    """precip_prob is never scored, so it must stay out of fields_provided or it
    changes every source's coverage index."""
    for row in normalize(payload):
        assert "precip_prob" not in row["fields_provided"]
        assert "precip_probability" not in row["fields_provided"]
