"""Tests for the capture-drop health guard (check_capture_health).

The guard must fail loudly on a genuine capture drop (a mandatory source absent,
or Open-Meteo dropping a field) while NOT firing on the benign, self-correcting
cases: the Open-Meteo archive lagging (no actuals yet), or Ray's honestly
forfeiting his qualitative wind / missing precip type."""
import json
import check_capture_health as h


def _sd(*fields):
    """A scored source that covers exactly the given coverage fields."""
    all_fields = ["high_temp", "low_temp", "wind", "precip_type", "precip_amount"]
    return {"score": {"coverage": {f: (f in fields) for f in all_fields}}}


FULL = ("high_temp", "low_temp", "wind", "precip_type", "precip_amount")
HEALTHY = {
    "sources": {
        "openmeteo": _sd(*FULL),
        "raysweather": _sd("high_temp", "low_temp", "wind", "precip_type"),  # no amount = expected
        "metno": _sd("high_temp", "low_temp", "wind", "precip_type"),
    }
}


# ── evaluate(): capture-drop detection vs honest forfeits ──────────────────
def test_healthy_day_has_no_problems():
    assert h.evaluate(HEALTHY)[0] == []


def test_rays_qualitative_wind_or_missing_precip_type_is_allowed():
    # Ray gives only a high/low that day (no number-wind, no precip type) — an
    # honest forfeit the scoring engine records as coverage=False, not a drop.
    comp = {"sources": {**HEALTHY["sources"], "raysweather": _sd("high_temp", "low_temp")}}
    assert h.evaluate(comp)[0] == []


def test_rays_missing_high_is_flagged():
    comp = {"sources": {**HEALTHY["sources"], "raysweather": _sd("low_temp", "wind", "precip_type")}}
    assert any("raysweather" in p and "high" in p for p in h.evaluate(comp)[0])


def test_openmeteo_field_drop_is_flagged():
    # Open-Meteo is a machine source; a dropped field is a real capture/parse fail.
    comp = {"sources": {**HEALTHY["sources"],
                        "openmeteo": _sd("high_temp", "low_temp", "precip_type", "precip_amount")}}
    assert any("openmeteo" in p and "wind" in p for p in h.evaluate(comp)[0])


def test_missing_mandatory_source_is_flagged():
    comp = {"sources": {"openmeteo": HEALTHY["sources"]["openmeteo"]}}  # no raysweather
    assert any("raysweather" in p and "not scored" in p for p in h.evaluate(comp)[0])


def test_source_present_but_unscored_is_flagged():
    comp = {"sources": {**HEALTHY["sources"], "raysweather": {"note": "screenshot only"}}}
    assert any("raysweather" in p for p in h.evaluate(comp)[0])


def test_empty_comparison_flags_both_mandatory_sources():
    assert len(h.evaluate({"sources": {}})[0]) == 2


def test_malformed_shapes_do_not_crash():
    assert h.evaluate({"sources": None})[0]  # -> both mandatory missing, no crash
    assert h.evaluate({"sources": {"openmeteo": {"score": None}, "raysweather": {"score": None}}})[0]


# ── check(): actuals gating (the archive-lag false-positive fix) ───────────
def _write(tmp, date, actuals=True, comparison=None):
    (tmp / "actuals").mkdir(exist_ok=True)
    (tmp / "comparisons").mkdir(exist_ok=True)
    if actuals:
        (tmp / "actuals" / f"{date}.json").write_text("{}")
    if comparison is not None:
        (tmp / "comparisons" / f"{date}.json").write_text(json.dumps(comparison))


def test_missing_actuals_is_a_benign_skip(tmp_path, monkeypatch):
    monkeypatch.setattr(h, "DATA_DIR", tmp_path)
    _write(tmp_path, "2026-07-01", actuals=False)
    assert h.check("2026-07-01")[0] == []  # archive lag -> skip, not fail


def test_actuals_present_but_no_comparison_is_flagged(tmp_path, monkeypatch):
    monkeypatch.setattr(h, "DATA_DIR", tmp_path)
    _write(tmp_path, "2026-07-01", actuals=True, comparison=None)
    problems = h.check("2026-07-01")[0]
    assert problems and "no comparison" in problems[0].lower()


def test_healthy_comparison_with_actuals_passes(tmp_path, monkeypatch):
    monkeypatch.setattr(h, "DATA_DIR", tmp_path)
    _write(tmp_path, "2026-07-01", actuals=True, comparison=HEALTHY)
    assert h.check("2026-07-01")[0] == []


# ── Apple-fallback detection (screenshot uploaded but scored as Open-Meteo) ──
def _with_screenshot(tmp, date, apple_source):
    (tmp / "predictions" / date).mkdir(parents=True, exist_ok=True)
    (tmp / "predictions" / date / "iphone_screenshot.png").write_text("png")
    comp = {"sources": {**HEALTHY["sources"],
                        "apple_weather": {"source": apple_source, "score": {"coverage": {}}}}}
    _write(tmp, date, actuals=True, comparison=comp)


def test_apple_fallback_with_screenshot_is_noted_but_not_failed(tmp_path, monkeypatch):
    monkeypatch.setattr(h, "DATA_DIR", tmp_path)
    _with_screenshot(tmp_path, "2026-07-02", apple_source="Open-Meteo")
    problems, lines = h.check("2026-07-02")
    assert problems == []  # non-fatal — the fallback is an accepted stand-in
    assert any("fallback" in l.lower() for l in lines)


def test_real_apple_with_screenshot_is_not_noted(tmp_path, monkeypatch):
    monkeypatch.setattr(h, "DATA_DIR", tmp_path)
    _with_screenshot(tmp_path, "2026-07-02", apple_source="iPhone Shortcut")
    _, lines = h.check("2026-07-02")
    assert not any("fallback" in l.lower() for l in lines)


# ── Rolling drift detection (drift_findings) ───────────────────────────────
def _rays_series(**override):
    """A raysweather series with every field reliably provided, minus overrides."""
    return {"raysweather": {f: override.get(f, [True] * 40) for f in h.FIELD_LABEL}}


def test_sustained_dark_run_of_a_reliable_field_is_flagged():
    # Ray's wind was provided for a month, then vanished for 8 straight days.
    s = _rays_series(wind=[True] * 30 + [False] * 8)
    out = h.drift_findings(s)
    assert any("raysweather" in d and "wind" in d for d in out)


def test_a_one_off_forfeit_is_not_flagged():
    s = _rays_series(wind=[True] * 38 + [False] * 2)  # 2-day gap, below the 7-day run
    assert h.drift_findings(s) == []


def test_a_field_the_source_never_reliably_provides_is_not_flagged():
    # Ray never gives a numeric precip amount — a permanent forfeit, not a drift.
    s = _rays_series(precip_amount=[False] * 40)
    assert h.drift_findings(s) == []


def test_thin_baseline_is_not_flagged():
    # Only 10 days of history before the dark run — not enough to judge "normally provided".
    s = _rays_series(wind=[True] * 10 + [False] * 8)
    assert h.drift_findings(s) == []


def test_healthy_series_has_no_drift():
    s = {src: {f: [True] * 40 for f in h.FIELD_LABEL} for src in h.DRIFT_SOURCES}
    assert h.drift_findings(s) == []
