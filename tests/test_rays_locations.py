"""M5 P0.5: Ray's blurbs normalization — per-town numbers + sky-icon precip type,
honest forfeits for wind and numeric amount."""
import pytest

from capture_rays_locations import (
    ICON_FAMILY_TO_TYPE,
    _find_station_rows,
    icon_precip_type,
    normalize_station,
)

BLURB_STATION = {
    "stationId": "2", "stationName": "Blowing Rock",
    "forecastContent": {
        "26-07-18": {"high": 81, "low": 63, "date": "26-07-18", "golfballs": 3,
                     "iconDay": "Day/03_Lightning/02_Sct_Thundershowers_PM.png",
                     "iconNight": "Night/03_Lightning/06_Night_TShrsPMSct.png"},
        "26-07-19": {"high": 79, "low": 62, "date": "26-07-19", "golfballs": 4,
                     "iconDay": "Day/01_Dry/02_Few_Clouds.png",
                     "iconNight": "Night/01_Dry/03_Sct_Clouds.png"},
    },
}


def test_normalize_station_dates_and_numbers():
    rows = normalize_station(BLURB_STATION)
    assert [r["date"] for r in rows] == ["2026-07-18", "2026-07-19"]
    assert rows[0]["high_f"] == 81 and rows[0]["low_f"] == 63
    assert rows[0]["golfballs"] == 3


def test_normalize_station_derives_precip_from_icon():
    rows = normalize_station(BLURB_STATION)
    # Lightning family -> rain claim; icon stored raw; precip_type in fields.
    assert rows[0]["precip_type"] == "rain"
    assert rows[0]["icon_day"] == "Day/03_Lightning/02_Sct_Thundershowers_PM.png"
    assert rows[0]["icon_night"] == "Night/03_Lightning/06_Night_TShrsPMSct.png"
    assert rows[0]["fields_provided"] == ["high", "low", "precip_type"]
    # Dry family -> "none" claim (earns the implied-zero amount on dry days).
    assert rows[1]["precip_type"] == "none"
    assert rows[1]["fields_provided"] == ["high", "low", "precip_type"]
    # Wind and numeric amount are never claimed per-town.
    assert "wind_mph" not in rows[0]
    assert "rain_amount" not in rows[0]["fields_provided"]


def test_normalize_station_unmapped_icon_forfeits_and_stores_raw(capsys):
    station = {
        "stationId": "9", "stationName": "Nowhere",
        "forecastContent": {
            "26-07-18": {"high": 70, "low": 50, "date": "26-07-18",
                         "iconDay": "Day/09_Volcano/01_Ashfall.png"},
        },
    }
    rows = normalize_station(station)
    assert "precip_type" not in rows[0]           # unknown family -> no guess
    assert rows[0]["fields_provided"] == ["high", "low"]
    assert rows[0]["icon_day"] == "Day/09_Volcano/01_Ashfall.png"  # raw kept
    assert "UNMAPPED" in capsys.readouterr().out  # logged loudly


def test_normalize_station_missing_icon_is_plain_forfeit():
    station = {
        "stationId": "9", "stationName": "Nowhere",
        "forecastContent": {"26-07-18": {"high": 70, "low": 50, "date": "26-07-18"}},
    }
    rows = normalize_station(station)
    assert rows[0]["icon_day"] is None
    assert "precip_type" not in rows[0]
    assert rows[0]["fields_provided"] == ["high", "low"]


@pytest.mark.parametrize("icon,expected", [
    ("Day/01_Dry/02_Few_Clouds.png", "none"),
    ("Day/01_Dry/08_Brk_Clouds_PM.png", "none"),
    ("Day/02_Rain/06_Ovc_Rain_Light.png", "rain"),
    ("Day/03_Lightning/04_Ovc_Thunderstorms.png", "rain"),
    ("Day/03_Lightning/07_Sct_ThunderShowers.png", "rain"),
    ("Day/04_Snow/04_Sct_ShSn_Light.png", "snow"),
    ("Night/04_Snow/01_Sct_Flurries.png", "snow"),
    ("Day/09_Volcano/01_Ashfall.png", None),   # unknown family -> no guess
    ("", None),
    (None, None),
    ("garbage", None),
])
def test_icon_precip_type_mapping(icon, expected):
    assert icon_precip_type(icon) == expected


def test_icon_vocabulary_families_are_the_vetted_four():
    assert set(ICON_FAMILY_TO_TYPE) == {"01_Dry", "02_Rain", "03_Lightning", "04_Snow"}


def test_find_station_rows_survives_trpc_nesting():
    nested = {"result": {"data": {"json": [BLURB_STATION]}}}
    assert _find_station_rows(nested)[0]["stationId"] == "2"
    assert _find_station_rows({"result": {}}) is None
