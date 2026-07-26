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
    problems, lines = f.run_checks("2026-07-25")
    assert problems == []
    assert len(lines) == 2


def test_skipped_cron_fails_both_checks(tmp_path, monkeypatch):
    # The exact failure mode this sentinel exists for: the cron simply never ran,
    # so both today's capture and the comparisons directory are empty/stale.
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "comparisons" / "2026-07-18.json")  # last run was a week ago
    problems, lines = f.run_checks("2026-07-25")
    assert len(problems) == 2
    assert any("capture" in p or "MISSING" in p for p in problems)
    assert any("STALE" in p for p in problems)


def test_partial_failure_flags_only_the_broken_check(tmp_path, monkeypatch):
    monkeypatch.setattr(f, "DATA_DIR", tmp_path)
    _touch(tmp_path / "predictions" / "2026-07-25" / "openmeteo_forecast.json")
    # No comparisons committed yet today, but yesterday's is well within slack.
    _touch(tmp_path / "comparisons" / "2026-07-24.json")
    problems, _ = f.run_checks("2026-07-25")
    assert problems == []
