"""Tests for compare.build_forecast_5day — the per-source 5-day outlook feed.

The builder reads the newest unscored capture folder (same anchor idiom as
build_latest_forecasts) and emits data/forecast_5day.json: one days[] entry per
date in [anchor, anchor+5] found in any source's daily[] rows, each day shaped
exactly like latest_forecasts.json's {sources: {key: {...}}} so the TS
compositeForecast() consumes each day unchanged. Everything the builder reads
and writes lives under compare.DATA_DIR, so a single monkeypatch of DATA_DIR
points the whole thing at tmp_path."""
import json

import compare

ANCHOR = "2026-07-08"


def _om_day(date, high, prob=None):
    """An Open-Meteo-shaped daily row (carries precip_prob when given)."""
    d = {
        "date": date, "high_f": high, "low_f": high - 15.0, "wind_mph": 9.2,
        "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
        "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
    }
    if prob is not None:
        d["precip_prob"] = prob
    return d


def _src_day(date, high, precip="none"):
    """A registry-source daily row that carries no precip_prob (NWS-shaped)."""
    return {
        "date": date, "high_f": high, "low_f": high - 15.0, "wind_mph": 5.0,
        "precip_type": precip, "rain_in": (0.1 if precip == "rain" else 0.0),
        "snow_in": 0.0,
        "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"],
    }


def _setup(tmp_path, monkeypatch, files, anchor=ANCHOR):
    """Point compare.DATA_DIR at tmp_path and write capture files under anchor."""
    monkeypatch.setattr(compare, "DATA_DIR", tmp_path)
    pred = tmp_path / "predictions" / anchor
    pred.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (pred / name).write_text(content if isinstance(content, str) else json.dumps(content))
    return tmp_path


def _standard_fixture(tmp_path, monkeypatch):
    """2 well-formed sources x 3 days (one with precip_prob, one without),
    1 corrupt capture file, every other source file missing."""
    return _setup(tmp_path, monkeypatch, {
        "openmeteo_forecast.json": {"daily": [
            _om_day("2026-07-08", 79.0, prob=31),
            _om_day("2026-07-09", 81.0, prob=55),
            _om_day("2026-07-10", 83.0, prob=0),
        ]},
        "nws_forecast.json": {"daily": [
            _src_day("2026-07-08", 80.0),
            _src_day("2026-07-09", 82.0, precip="rain"),
            _src_day("2026-07-10", 84.0),
        ]},
        "weatherapi_forecast.json": "{this is not json",
    })


def test_one_day_entry_per_forecast_date(tmp_path, monkeypatch):
    _standard_fixture(tmp_path, monkeypatch)
    out = compare.build_forecast_5day()
    assert [d["date"] for d in out["days"]] == ["2026-07-08", "2026-07-09", "2026-07-10"]
    assert out["location"] == "Boone"
    assert out["generated_at"]


def test_per_source_values_per_day(tmp_path, monkeypatch):
    _standard_fixture(tmp_path, monkeypatch)
    out = compare.build_forecast_5day()
    d0, d1, d2 = (day["sources"] for day in out["days"])
    # exact-dict compares pin the latest_forecasts.json per-source shape
    assert d0["openmeteo"] == {"high_f": 79.0, "low_f": 64.0, "wind": "9 mph",
                               "precip_type": "none", "precip_prob": 31, "label": "Open-Meteo"}
    assert d0["nws"] == {"high_f": 80.0, "low_f": 65.0, "wind": "5 mph",
                         "precip_type": "none", "label": "NWS"}
    assert d1["openmeteo"]["high_f"] == 81.0
    assert d1["nws"]["precip_type"] == "rain"
    assert d2["openmeteo"]["high_f"] == 83.0
    assert d2["nws"]["high_f"] == 84.0


def test_precip_prob_only_where_the_row_carries_it(tmp_path, monkeypatch):
    _standard_fixture(tmp_path, monkeypatch)
    out = compare.build_forecast_5day()
    probs = [day["sources"]["openmeteo"].get("precip_prob") for day in out["days"]]
    assert probs == [31, 55, 0]  # 0% is information, not absence
    assert all("precip_prob" not in day["sources"]["nws"] for day in out["days"])


def test_corrupt_and_missing_sources_are_skipped(tmp_path, monkeypatch):
    _standard_fixture(tmp_path, monkeypatch)
    out = compare.build_forecast_5day()  # must not raise on the corrupt weatherapi file
    for day in out["days"]:
        assert set(day["sources"]) == {"openmeteo", "nws"}  # corrupt + missing both absent


def test_output_file_written_and_roundtrips(tmp_path, monkeypatch):
    _standard_fixture(tmp_path, monkeypatch)
    out = compare.build_forecast_5day()
    path = tmp_path / "forecast_5day.json"
    assert path.exists()
    assert json.loads(path.read_text()) == out


def test_window_caps_at_anchor_plus_5(tmp_path, monkeypatch):
    dates = [f"2026-07-{d:02d}" for d in range(8, 16)]  # 8 rows: anchor..anchor+7
    _setup(tmp_path, monkeypatch,
           {"openmeteo_forecast.json": {"daily": [_om_day(d, 80.0) for d in dates]}})
    out = compare.build_forecast_5day()
    assert [d["date"] for d in out["days"]] == dates[:6]  # capped at anchor+5


def test_rays_strip_governs_day0_and_rows_govern_beyond(tmp_path, monkeypatch):
    """Day 0 mirrors build_latest_forecasts (_best_rays_prediction merges the
    capture-day strip over daily[]); beyond day 0 the strip describes the wrong
    day, so only an exact daily[] row counts (leadtime._rays_row's rule) and a
    date with no row gets no raysweather entry."""
    _setup(tmp_path, monkeypatch, {
        "openmeteo_forecast.json": {"daily": [
            _om_day("2026-07-08", 79.0), _om_day("2026-07-09", 81.0), _om_day("2026-07-10", 83.0)]},
        "rays_boone.json": {
            "forecast": {"today_high_f": 81.0, "tonight_low_f": 64.0},
            "daily": [
                {"date": "2026-07-08", "high_f": 90.0, "low_f": 60.0, "wind_lo": 0, "wind_hi": 7,
                 "precip_type": "rain", "precip_in": None},
                {"date": "2026-07-09", "high_f": 82.0, "low_f": 63.0, "wind_lo": 4, "wind_hi": 8,
                 "precip_type": "rain", "precip_in": 0.0},
            ],
        },
    })
    out = compare.build_forecast_5day()
    by_date = {d["date"]: d["sources"] for d in out["days"]}
    day0 = by_date["2026-07-08"]["raysweather"]
    assert day0["high_f"] == 81.0 and day0["low_f"] == 64.0  # strip, not the 90/60 row
    assert day0["wind"] == "0–7 mph"                         # interval carried from the row
    assert day0["precip_type"] == "rain"                     # non-temp fields still flow from the row
    assert day0["label"] == "Ray's Weather"
    day1 = by_date["2026-07-09"]["raysweather"]
    assert day1["high_f"] == 82.0 and day1["low_f"] == 63.0  # the row, not the strip
    assert day1["precip_type"] == "rain"
    assert "raysweather" not in by_date["2026-07-10"]        # no row -> no entry


def test_apple_slot_is_day0_only(tmp_path, monkeypatch):
    """The Apple slot is a flat single-day capture (the fallback's scoreable
    fields live under its nested `forecast` key), so it only ever contributes
    day 0 — its daily[] must not fabricate future Apple days."""
    _setup(tmp_path, monkeypatch, {
        "openmeteo_forecast.json": {"daily": [
            _om_day("2026-07-08", 79.0), _om_day("2026-07-09", 81.0)]},
        "iphone_forecast.json": {
            "date": ANCHOR,
            "forecast": {"today_high_f": 79.4, "tonight_low_f": 62.4, "wind_mph": 9.2,
                         "precip_in": 0.0, "snow_in": 0.0, "conditions": "Fog", "category": "fog"},
            "daily": [
                {"date": "2026-07-08", "high_f": 79.4, "low_f": 62.4, "wind_mph": 9.2,
                 "precip_in": 0.0, "snow_in": 0.0, "category": "fog"},
                {"date": "2026-07-09", "high_f": 81.0, "low_f": 63.0, "wind_mph": 8.0,
                 "precip_in": 0.0, "snow_in": 0.0, "category": "clear"},
            ],
        },
    })
    out = compare.build_forecast_5day()
    by_date = {d["date"]: d["sources"] for d in out["days"]}
    apple = by_date["2026-07-08"]["apple_weather"]
    assert apple["high_f"] == 79.4 and apple["low_f"] == 62.4
    assert apple["label"] == "Apple Weather"
    assert "apple_weather" not in by_date["2026-07-09"]


def test_bucket_low_recovery_applies_to_day0_only(tmp_path, monkeypatch):
    """Met.no's capture-day low is recovered from the day-ahead capture (same as
    the daily comparison); rows beyond day 0 already span their full day and
    must keep their own lows — neither overwritten nor forfeited."""
    _setup(tmp_path, monkeypatch, {
        "metno_forecast.json": {"daily": [
            _src_day("2026-07-08", 80.0),   # capture-day low (65.0) is biased warm
            _src_day("2026-07-09", 82.0),
            _src_day("2026-07-10", 84.0),
        ]},
    })
    prev = tmp_path / "predictions" / "2026-07-07"
    prev.mkdir()
    day_ahead = dict(_src_day("2026-07-08", 80.0))
    day_ahead["low_f"] = 58.3
    (prev / "metno_forecast.json").write_text(json.dumps({"daily": [day_ahead]}))
    out = compare.build_forecast_5day()
    lows = [day["sources"]["metno"]["low_f"] for day in out["days"]]
    assert lows == [58.3, 67.0, 69.0]


def test_anchors_on_newest_unscored_capture(tmp_path, monkeypatch):
    """A capture folder that already has a comparison is scored history, not the
    upcoming day — same anchor rule as build_latest_forecasts."""
    _setup(tmp_path, monkeypatch,
           {"openmeteo_forecast.json": {"daily": [_om_day("2026-07-07", 78.0)]}},
           anchor="2026-07-07")
    pred8 = tmp_path / "predictions" / "2026-07-08"
    pred8.mkdir()
    (pred8 / "openmeteo_forecast.json").write_text(
        json.dumps({"daily": [_om_day("2026-07-08", 90.0)]}))
    comp = tmp_path / "comparisons"
    comp.mkdir()
    (comp / "2026-07-08.json").write_text("{}")  # 07-08 already scored
    out = compare.build_forecast_5day()
    assert [d["date"] for d in out["days"]] == ["2026-07-07"]


def test_returns_none_without_prediction_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(compare, "DATA_DIR", tmp_path)
    assert compare.build_forecast_5day() is None            # no predictions/ at all
    (tmp_path / "predictions").mkdir()
    assert compare.build_forecast_5day() is None            # predictions/ but no capture dirs
    assert not (tmp_path / "forecast_5day.json").exists()   # and nothing was written
