"""M5 P0.5: Ray's blurbs normalization — per-town numbers, honest forfeits."""
from capture_rays_locations import _find_station_rows, normalize_station

BLURB_STATION = {
    "stationId": "2", "stationName": "Blowing Rock",
    "forecastContent": {
        "26-07-18": {"high": 81, "low": 63, "date": "26-07-18", "golfballs": 3,
                     "iconDay": "Day/03_Lightning/02_Sct_Thundershowers_PM.png"},
        "26-07-19": {"high": 79, "low": 62, "date": "26-07-19", "golfballs": 4},
    },
}


def test_normalize_station_dates_and_fields():
    rows = normalize_station(BLURB_STATION)
    assert [r["date"] for r in rows] == ["2026-07-18", "2026-07-19"]
    assert rows[0]["high_f"] == 81 and rows[0]["low_f"] == 63
    assert rows[0]["golfballs"] == 3
    # numbers only: everything Ray doesn't publish per-town is an honest forfeit
    assert rows[0]["fields_provided"] == ["high", "low"]
    assert "wind_mph" not in rows[0] and "precip_type" not in rows[0]


def test_find_station_rows_survives_trpc_nesting():
    nested = {"result": {"data": {"json": [BLURB_STATION]}}}
    assert _find_station_rows(nested)[0]["stationId"] == "2"
    assert _find_station_rows({"result": {}}) is None
