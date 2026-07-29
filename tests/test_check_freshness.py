"""Tests for the freshness sentinel (check_freshness).

The sentinel must catch a skipped cron (the 2026-07-02 failure mode — no run
happened, so nothing failed, so the site went stale in silence) while NOT
false-alarming on the Open-Meteo archive's benign 1-5 day lag."""
import check_freshness as f


def _touch(p):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{}")


# ── check_today_capture ─────────────────────────────────────────────────
def test_todays_capture_present_passes(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-25" / "openmeteo_forecast.json")
    ok, msg = f.check_today_capture("2026-07-25")
    assert ok
    assert "ok" in msg


def test_todays_capture_missing_directory_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_today_capture("2026-07-25")
    assert not ok
    assert "no predictions/2026-07-25/ directory" in msg


def test_todays_capture_dir_without_openmeteo_fails(tmp_path, monkeypatch):
    # Folder exists (maybe another source captured) but the one non-continue-on-error
    # step never ran — that's exactly the partial-crash case worth catching.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-25" / "rays_boone.json")
    ok, msg = f.check_today_capture("2026-07-25")
    assert not ok
    assert "no openmeteo_forecast.json" in msg


# ── newest_comparison_date / check_comparison_freshness ────────────────
def test_newest_comparison_date_empty_dir_is_none(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    (tmp_path / "comparisons").mkdir()
    assert f.newest_comparison_date() is None


def test_newest_comparison_date_missing_dir_is_none(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    assert f.newest_comparison_date() is None


def test_newest_comparison_date_picks_the_latest(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    for d in ("2026-07-20", "2026-07-24", "2026-07-22"):
        _touch(tmp_path / "comparisons" / f"{d}.json")
    assert f.newest_comparison_date() == "2026-07-24"


def test_comparison_from_yesterday_is_fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-24.json")
    ok, msg = f.check_comparison_freshness("2026-07-25")
    assert ok
    assert "1 day" in msg


def test_comparison_two_days_old_is_still_allowed(tmp_path, monkeypatch):
    # The archive-lag slack day.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-23.json")
    ok, _ = f.check_comparison_freshness("2026-07-25")
    assert ok


def test_comparison_three_days_old_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-22.json")
    ok, msg = f.check_comparison_freshness("2026-07-25")
    assert not ok
    assert "STALE" in msg


def test_no_comparisons_at_all_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_comparison_freshness("2026-07-25")
    assert not ok
    assert "MISSING" in msg


def test_future_dated_comparison_is_not_flagged(tmp_path, monkeypatch):
    # A --date override pointed at the past relative to real data shouldn't read
    # as staleness (clock-skew guard, not a real-world daily case).
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-25.json")
    ok, _ = f.check_comparison_freshness("2026-07-20")
    assert ok


# ── run_checks: the combined red/green verdict ──────────────────────────
def test_healthy_pipeline_has_no_problems(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-25" / "openmeteo_forecast.json")
    _touch(tmp_path / "comparisons" / "2026-07-24.json")
    # Healthy traffic loop too (three feeds added 2026-07-28).
    _touch(tmp_path / "traffic" / "forecast" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "comparisons" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "actuals" / "2026-07-24.json")
    problems, lines = f.run_checks("2026-07-25")
    assert problems == []
    assert len(lines) == 6  # capture + comparisons + towns + 3 traffic (loop added 2026-07-28)


def test_skipped_cron_fails_both_checks(tmp_path, monkeypatch):
    # The exact failure mode this sentinel exists for: the cron simply never ran,
    # so both today's capture and the comparisons directory are empty/stale.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-18.json")  # last run was a week ago
    # Traffic loop healthy — isolate the two weather problems this test is about.
    _touch(tmp_path / "traffic" / "forecast" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "comparisons" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "actuals" / "2026-07-24.json")
    problems, lines = f.run_checks("2026-07-25")
    assert len(problems) == 2
    assert any("capture" in p or "MISSING" in p for p in problems)
    assert any("STALE" in p for p in problems)


def test_partial_failure_flags_only_the_broken_check(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-25" / "openmeteo_forecast.json")
    # No comparisons committed yet today, but yesterday's is well within slack.
    _touch(tmp_path / "comparisons" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "forecast" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "comparisons" / "2026-07-24.json")
    _touch(tmp_path / "traffic" / "actuals" / "2026-07-24.json")
    problems, _ = f.run_checks("2026-07-25")
    assert problems == []


# ── check_town_captures (added 2026-07-27 after the partial-sweep incident) ──
def test_town_captures_all_present_passes(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    for t in ("banner-elk", "todd"):
        _touch(tmp_path / "locations" / t / "predictions" / "2026-07-27" / "openmeteo_forecast.json")
    ok, msg = f.check_town_captures("2026-07-27")
    assert ok
    assert "all 2 towns" in msg


def test_town_captures_partial_sweep_fails_and_names_towns(tmp_path, monkeypatch):
    # The exact 2026-07-27 failure: some towns captured before the sweep died,
    # the rest silently got nothing (Ray-only scoring for five days).
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "locations" / "bakersville" / "predictions" / "2026-07-27" / "openmeteo_forecast.json")
    _touch(tmp_path / "locations" / "banner-elk" / "predictions" / "2026-07-26" / "openmeteo_forecast.json")
    ok, msg = f.check_town_captures("2026-07-27")
    assert not ok
    assert "1/2" in msg
    assert "banner-elk" in msg


def test_town_captures_no_registry_is_ok(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_town_captures("2026-07-27")
    assert ok


def test_run_checks_includes_town_check(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-27" / "openmeteo_forecast.json")
    _touch(tmp_path / "comparisons" / "2026-07-26.json")
    _touch(tmp_path / "locations" / "vilas" / "predictions" / "2026-07-20" / "openmeteo_forecast.json")
    problems, lines = f.run_checks("2026-07-27")
    assert any("towns" in p for p in problems)


# ── traffic predict→grade loop (added 2026-07-28 after the silent-skip incident) ──
def _traffic(tmp_path, subdir, *dates):
    for d in dates:
        _touch(tmp_path / "traffic" / subdir / f"{d}.json")


def test_newest_traffic_date_picks_latest(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "forecast", "2026-07-25", "2026-07-27", "2026-07-26")
    assert f.newest_traffic_date("forecast") == "2026-07-27"


def test_newest_traffic_date_missing_dir_is_none(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    assert f.newest_traffic_date("forecast") is None


# forecast: yesterday ok (in-flight cron), two consecutive missing days = red
def test_traffic_forecast_yesterday_is_fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "forecast", "2026-07-27")
    ok, msg = f.check_traffic_forecast_freshness("2026-07-28")
    assert ok
    assert "1 day" in msg


def test_traffic_forecast_two_days_old_is_stale(tmp_path, monkeypatch):
    # The incident: forecast stuck at 2026-07-25, so by 07-27 it is two days stale.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "forecast", "2026-07-25")
    ok, msg = f.check_traffic_forecast_freshness("2026-07-27")
    assert not ok
    assert "STALE" in msg


def test_traffic_forecast_missing_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_traffic_forecast_freshness("2026-07-28")
    assert not ok
    assert "MISSING" in msg


# comparisons: gap-day slack must not false-alarm; >3 days = red; none at all = red
def test_traffic_comparison_gap_day_does_not_false_alarm(tmp_path, monkeypatch):
    # Real 2026-07-28 state: newest comparison is 2026-07-25 because 07-26 had no
    # forecast (the incident gap) so it never got a comparison, and 07-27 grading
    # lands later today. 3 days old — must stay green.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "comparisons", "2026-07-25")
    ok, msg = f.check_traffic_comparison_freshness("2026-07-28")
    assert ok
    assert "3 day" in msg


def test_traffic_comparison_four_days_old_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "comparisons", "2026-07-24")
    ok, msg = f.check_traffic_comparison_freshness("2026-07-28")
    assert not ok
    assert "STALE" in msg


def test_traffic_comparison_none_at_all_is_stale(tmp_path, monkeypatch):
    # The incident state: no traffic comparisons ever landed.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_traffic_comparison_freshness("2026-07-27")
    assert not ok
    assert "MISSING" in msg


# actuals: yesterday ok, two days = red, none = red
def test_traffic_actuals_yesterday_is_fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "actuals", "2026-07-27")
    ok, msg = f.check_traffic_actuals_freshness("2026-07-28")
    assert ok
    assert "1 day" in msg


def test_traffic_actuals_two_days_old_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "actuals", "2026-07-25")
    ok, msg = f.check_traffic_actuals_freshness("2026-07-27")
    assert not ok
    assert "STALE" in msg


def test_traffic_actuals_missing_is_stale(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    ok, msg = f.check_traffic_actuals_freshness("2026-07-28")
    assert not ok
    assert "MISSING" in msg


def test_traffic_future_dated_is_not_flagged(tmp_path, monkeypatch):
    # A --date override in the past relative to the data isn't staleness.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _traffic(tmp_path, "forecast", "2026-07-27")
    ok, _ = f.check_traffic_forecast_freshness("2026-07-20")
    assert ok


# ── run_checks now carries all six checks, and the real+incident states verify ──
def test_run_checks_has_six_checks_all_healthy(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-28" / "openmeteo_forecast.json")
    _touch(tmp_path / "comparisons" / "2026-07-27.json")
    _touch(tmp_path / "locations" / "vilas" / "predictions" / "2026-07-28" / "openmeteo_forecast.json")
    _traffic(tmp_path, "forecast", "2026-07-27")
    _traffic(tmp_path, "comparisons", "2026-07-25")  # gap-day state, still fresh
    _traffic(tmp_path, "actuals", "2026-07-27")
    problems, lines = f.run_checks("2026-07-28")
    assert problems == []
    assert len(lines) == 6  # weather capture + comparisons + towns + 3 traffic


def test_run_checks_flags_traffic_silent_skip(tmp_path, monkeypatch):
    # The 2026-07-26/27 incident: weather kept running, but the traffic loop
    # silently stopped — forecast stuck at 07-25, no comparisons at all.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-27" / "openmeteo_forecast.json")
    _touch(tmp_path / "comparisons" / "2026-07-26.json")
    _touch(tmp_path / "locations" / "vilas" / "predictions" / "2026-07-27" / "openmeteo_forecast.json")
    _traffic(tmp_path, "forecast", "2026-07-25")   # stuck two days back
    _traffic(tmp_path, "actuals", "2026-07-27")    # sampling crons still fired
    # no traffic comparisons at all
    problems, _ = f.run_checks("2026-07-27")
    assert any("traffic forecast" in p and "STALE" in p for p in problems)
    assert any("traffic comparisons" in p and "MISSING" in p for p in problems)
