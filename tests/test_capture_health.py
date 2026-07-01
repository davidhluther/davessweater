"""Tests for the capture-drop health guard (check_capture_health.evaluate).

The guard must fail loudly when a mandatory source (Open-Meteo, Ray's) is absent
or missing a required field for the day — the exact Ray-deflation failure mode,
where a dropped field scores 0 and looks like a bad forecast."""
import check_capture_health as h


def _sd(*fields):
    """A scored source that covers exactly the given coverage fields."""
    all_fields = ["high_temp", "low_temp", "wind", "precip_type", "precip_amount"]
    return {"score": {"coverage": {f: (f in fields) for f in all_fields}}}


HEALTHY = {
    "sources": {
        "openmeteo": _sd("high_temp", "low_temp", "wind", "precip_type", "precip_amount"),
        "raysweather": _sd("high_temp", "low_temp", "wind", "precip_type"),  # no amount = expected
        "metno": _sd("high_temp", "low_temp", "wind", "precip_type"),
    }
}


def test_healthy_day_has_no_problems():
    problems, _ = h.evaluate(HEALTHY)
    assert problems == []


def test_rays_wind_drop_is_flagged():
    comp = {"sources": {**HEALTHY["sources"], "raysweather": _sd("high_temp", "low_temp", "precip_type")}}
    problems, _ = h.evaluate(comp)
    assert any("raysweather" in p and "wind" in p for p in problems)


def test_missing_mandatory_source_is_flagged():
    comp = {"sources": {"openmeteo": HEALTHY["sources"]["openmeteo"]}}  # no raysweather
    problems, _ = h.evaluate(comp)
    assert any("raysweather" in p and "not scored" in p for p in problems)


def test_source_present_but_unscored_is_flagged():
    comp = {"sources": {**HEALTHY["sources"], "raysweather": {"note": "screenshot only"}}}
    problems, _ = h.evaluate(comp)
    assert any("raysweather" in p for p in problems)


def test_rays_without_precip_amount_is_not_a_problem():
    # Ray's genuinely never gives a numeric amount; that forfeiture must not trip the guard.
    problems, _ = h.evaluate(HEALTHY)
    assert not any("precip amount" in p for p in problems)


def test_empty_comparison_flags_both_mandatory_sources():
    problems, _ = h.evaluate({"sources": {}})
    assert len(problems) == 2
