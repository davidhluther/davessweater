"""Argon D9 (2026-11-16): NPS (monthly, 3rd) and races (weekly, Monday) pulls
catch up after a missed or failed slot, and a failed fetch exits non-zero
without clobbering the last good file. No network: fetches are monkeypatched."""

import json
import sys
from datetime import date, datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import capture_nps_visits as nps
import capture_races as races


class _FrozenNow(datetime):
    """datetime whose now() returns a fixed NY date."""
    frozen = None

    @classmethod
    def now(cls, tz=None):
        return cls.frozen.replace(tzinfo=tz)


def _freeze(monkeypatch, module, day):
    _FrozenNow.frozen = datetime(day.year, day.month, day.day, 6, 0)
    monkeypatch.setattr(module, "datetime", _FrozenNow)


# --- NPS gate -----------------------------------------------------------------

@pytest.mark.parametrize("today,last,due", [
    (date(2026, 11, 2), date(2026, 10, 3), False),   # before the slot: nothing due
    (date(2026, 11, 3), date(2026, 10, 3), True),    # slot day
    (date(2026, 11, 4), date(2026, 10, 3), True),    # missed the 3rd: catch up
    (date(2026, 11, 20), date(2026, 10, 3), True),   # still due weeks later
    (date(2026, 11, 4), date(2026, 11, 3), False),   # succeeded on the 3rd
    (date(2026, 11, 4), date(2026, 11, 2), True),    # a pre-slot pull does not count
    (date(2026, 11, 4), None, True),                 # no file yet
])
def test_nps_is_due(today, last, due):
    assert nps.is_due(today, last) is due


def test_nps_fetch_failure_exits_1_and_keeps_file(monkeypatch, tmp_path):
    out = tmp_path / "nps.json"
    good = {"fetched_at": "2026-10-03T06:00:00-04:00", "months": [{"month_key": "2026-08"}]}
    out.write_text(json.dumps(good))
    monkeypatch.setattr(nps, "OUT_PATH", out)
    monkeypatch.setattr(nps, "OUT_DIR", tmp_path)
    monkeypatch.setattr(nps, "fetch_history", lambda year: None)
    monkeypatch.setattr(sys, "argv", ["capture_nps_visits.py"])
    _freeze(monkeypatch, nps, date(2026, 11, 4))  # the 3rd was missed
    assert nps.main() == 1
    assert json.loads(out.read_text()) == good


def test_nps_catchup_pull_writes(monkeypatch, tmp_path):
    out = tmp_path / "nps.json"
    out.write_text(json.dumps({"fetched_at": "2026-10-03T06:00:00-04:00", "months": []}))
    monkeypatch.setattr(nps, "OUT_PATH", out)
    monkeypatch.setattr(nps, "OUT_DIR", tmp_path)
    monkeypatch.setattr(nps, "fetch_history", lambda year: [
        {"month_key": "2026-10", "year": 2026, "month": 10,
         "recreation_visitors": 2_000_000, "nonrecreation_visitors": 0}])
    monkeypatch.setattr(sys, "argv", ["capture_nps_visits.py"])
    _freeze(monkeypatch, nps, date(2026, 11, 5))
    assert nps.main() == 0
    assert nps.last_success_date(out) == date(2026, 11, 5)
    # ...and the next day it is no longer due.
    assert nps.is_due(date(2026, 11, 6), nps.last_success_date(out)) is False


# --- races gate ---------------------------------------------------------------

def test_races_last_slot_is_latest_monday():
    assert races.last_slot(date(2026, 11, 16)) == date(2026, 11, 16)  # Monday
    assert races.last_slot(date(2026, 11, 18)) == date(2026, 11, 16)  # Wednesday
    assert races.last_slot(date(2026, 11, 15)) == date(2026, 11, 9)   # Sunday


@pytest.mark.parametrize("today,last,due", [
    (date(2026, 11, 16), date(2026, 11, 9), True),   # Monday slot
    (date(2026, 11, 17), date(2026, 11, 9), True),   # missed Monday: catch up Tuesday
    (date(2026, 11, 17), date(2026, 11, 16), False), # Monday succeeded
    (date(2026, 11, 22), date(2026, 11, 17), False), # caught up Tuesday, quiet till next Monday
    (date(2026, 11, 17), None, True),
])
def test_races_is_due(today, last, due):
    assert races.is_due(today, last) is due


def test_races_legacy_failed_file_is_not_a_success(tmp_path):
    f = tmp_path / "races.json"
    f.write_text(json.dumps({"fetched_at": "2026-11-16T06:00:00-05:00", "fetch_ok": False}))
    assert races.last_success_date(f) is None
    f.write_text(json.dumps({"fetched_at": "2026-11-16T06:00:00-05:00", "fetch_ok": True}))
    assert races.last_success_date(f) == date(2026, 11, 16)


def test_races_fetch_failure_exits_1_and_keeps_file(monkeypatch, tmp_path):
    out = tmp_path / "races.json"
    good = {"fetched_at": "2026-11-09T06:00:00-05:00", "fetch_ok": True,
            "races": [{"name": "Kept", "date": "2026-12-01"}]}
    out.write_text(json.dumps(good))
    monkeypatch.setattr(races, "OUT_PATH", out)
    monkeypatch.setattr(races, "OUT_DIR", tmp_path)
    monkeypatch.setattr(races, "fetch_races", lambda end: None)
    monkeypatch.setattr(sys, "argv", ["capture_races.py"])
    _freeze(monkeypatch, races, date(2026, 11, 16))
    assert races.main() == 1
    # The old code overwrote this with an empty list.
    assert json.loads(out.read_text()) == good


def test_races_not_due_skips_without_fetching(monkeypatch, tmp_path):
    out = tmp_path / "races.json"
    out.write_text(json.dumps({"fetched_at": "2026-11-16T06:00:00-05:00", "fetch_ok": True}))
    monkeypatch.setattr(races, "OUT_PATH", out)

    def boom(end):
        raise AssertionError("fetched when not due")

    monkeypatch.setattr(races, "fetch_races", boom)
    monkeypatch.setattr(sys, "argv", ["capture_races.py"])
    _freeze(monkeypatch, races, date(2026, 11, 18))
    assert races.main() == 0
