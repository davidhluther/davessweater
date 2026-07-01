"""Tests for the auto-backfill sweep's date logic (backfill_missing).

The sweep recovers a day that was captured (predictions dir exists) but never
scored (no comparison), which happens when the Open-Meteo archive lagged past the
day's compare run. It must skip already-scored days, never-captured days,
yesterday (the main compare's job), and anything outside the window."""
import datetime
import backfill_missing as bm


def _mk(tmp, date, predictions=True, comparison=False):
    if predictions:
        (tmp / "predictions" / date).mkdir(parents=True, exist_ok=True)
    if comparison:
        (tmp / "comparisons").mkdir(parents=True, exist_ok=True)
        (tmp / "comparisons" / f"{date}.json").write_text("{}")


def test_finds_captured_but_unscored_days(tmp_path, monkeypatch):
    monkeypatch.setattr(bm, "DATA_DIR", tmp_path)
    today = datetime.date(2026, 7, 15)
    _mk(tmp_path, "2026-07-10", predictions=True, comparison=False)   # captured, unscored -> recover
    _mk(tmp_path, "2026-07-11", predictions=True, comparison=True)    # already scored -> skip
    _mk(tmp_path, "2026-07-12", predictions=False)                    # never captured -> skip
    out = bm.dates_needing_recovery(today, window=14)
    assert "2026-07-10" in out
    assert "2026-07-11" not in out
    assert "2026-07-12" not in out


def test_yesterday_is_excluded(tmp_path, monkeypatch):
    # today-1 is the main daily compare's job, not the sweep's.
    monkeypatch.setattr(bm, "DATA_DIR", tmp_path)
    today = datetime.date(2026, 7, 15)
    _mk(tmp_path, "2026-07-14", predictions=True, comparison=False)
    assert bm.dates_needing_recovery(today, window=14) == []


def test_outside_window_is_excluded(tmp_path, monkeypatch):
    monkeypatch.setattr(bm, "DATA_DIR", tmp_path)
    today = datetime.date(2026, 7, 15)
    _mk(tmp_path, "2026-06-01", predictions=True, comparison=False)
    assert bm.dates_needing_recovery(today, window=14) == []
