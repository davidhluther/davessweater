"""Tests for the Dave's Sweater Index (DSI) — the composite consensus scored in
compare.py. Mirrors the intent of src/lib/__tests__/composite.test.ts on the
data-pipeline side, plus the scoring-parity guarantees that only exist here."""
from compare import (
    build_composite, add_composite_source, COMPOSITE_KEY, COMPOSITE_EXCLUDE,
)

ACT = {"high_f": 80, "low_f": 60, "wind_mph": 8, "rain_in": 0.0, "snow_in": 0.0}


def C(**kw):
    """A scored-contract-shaped member (post _to_contract)."""
    base = {"high_f": None, "low_f": None, "wind_mph": None,
            "wind_lo": None, "wind_hi": None, "precip_type": None,
            "rain_in": None, "snow_in": None, "fields_provided": []}
    base.update(kw)
    return base


def full(high, low, wind, ptype="none", rain=0.0, snow=0.0):
    return C(high_f=high, low_f=low, wind_mph=wind, precip_type=ptype,
             rain_in=rain, snow_in=snow,
             fields_provided=["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"])


def test_fewer_than_two_members_returns_none():
    assert build_composite({}, ACT) is None
    assert build_composite({"a": full(80, 60, 8)}, ACT) is None


def test_means_high_low_wind():
    c = build_composite({"a": full(80, 60, 6), "b": full(84, 64, 10)}, ACT)
    p = c["prediction"]
    assert p["high_f"] == 82.0 and p["low_f"] == 62.0 and p["wind_mph"] == 8.0
    assert p["member_count"] == 2


def test_scored_on_full_contract_not_just_temps():
    # A consensus that nails all five fields must score 100 — proving wind and
    # precip amount are aggregated and graded, not silently forfeited (which
    # would cap the DSI at 70 and slander it on the board).
    c = build_composite({"a": full(80, 60, 8), "b": full(80, 60, 8)}, ACT)
    assert c["score"]["score"] == 100.0
    assert all(c["score"]["coverage"].values())


def test_majority_precip_vote_and_none_tiebreak():
    # 2 rain vs 1 none -> rain leads.
    c = build_composite({"a": full(70, 50, 5, "rain", rain=0.2),
                         "b": full(72, 52, 6, "rain", rain=0.3),
                         "c": full(71, 51, 5, "none")}, ACT)
    assert c["prediction"]["precip_type"] == "rain"
    # A tie that includes "none" stays "none".
    c2 = build_composite({"a": full(70, 50, 5, "rain", rain=0.2),
                          "b": full(71, 51, 5, "none")}, ACT)
    assert c2["prediction"]["precip_type"] == "none"


def test_tie_between_precip_types_reads_mixed():
    c = build_composite({"a": full(30, 20, 5, "rain", rain=0.2),
                         "b": full(31, 21, 6, "snow", snow=2.0)}, ACT)
    assert c["prediction"]["precip_type"] == "mixed"


def test_add_composite_excludes_rays_and_apple():
    comp = {"actuals": ACT, "sources": {
        "openmeteo": {"prediction": {"high_f": 80, "low_f": 60, "wind_mph": 8,
                                     "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
                                     "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]},
                      "score": {"score": 1}},
        "metno": {"prediction": {"high_f": 82, "low_f": 62, "wind_mph": 8,
                                 "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
                                 "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]},
                  "score": {"score": 1}},
        "raysweather": {"prediction": {"today_high_f": 200, "tonight_low_f": 200}, "score": {"score": 1}},
        "apple_weather": {"prediction": {"high_f": 200, "low_f": 200}, "score": {"score": 1}},
    }}
    add_composite_source(comp)
    p = comp["sources"][COMPOSITE_KEY]["prediction"]
    assert p["members"] == ["metno", "openmeteo"]  # rays + apple excluded
    assert p["high_f"] == 81.0  # not dragged by Ray's/Apple's 200s


def test_add_composite_is_idempotent_and_self_cleaning():
    comp = {"actuals": ACT, "sources": {
        "openmeteo": {"prediction": {"high_f": 80, "low_f": 60, "wind_mph": 8,
                                     "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
                                     "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]},
                      "score": {"score": 1}},
        "metno": {"prediction": {"high_f": 82, "low_f": 62, "wind_mph": 8,
                                 "precip_type": "none", "rain_in": 0.0, "snow_in": 0.0,
                                 "fields_provided": ["high", "low", "wind", "precip_type", "rain_amount", "snow_amount"]},
                  "score": {"score": 1}},
    }}
    add_composite_source(comp)
    first = comp["sources"][COMPOSITE_KEY]
    add_composite_source(comp)  # re-run must reproduce, not stack
    assert comp["sources"][COMPOSITE_KEY] == first
    # Drop a member below the 2-source floor -> composite removed, not stale.
    del comp["sources"]["metno"]
    add_composite_source(comp)
    assert COMPOSITE_KEY not in comp["sources"]


def test_exclude_set_is_the_headline_rivalry_minus_openmeteo():
    assert COMPOSITE_EXCLUDE == {"raysweather", "apple_weather"}
