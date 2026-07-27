"""fetch_json must retry transient failures and RAISE (never sys.exit).

The 2026-07-27 incident: a sys.exit(1) inside fetch_json escaped
capture_locations' per-source `except Exception` as SystemExit and killed the
whole 33-capture town sweep on one SSL handshake timeout — five days of towns
scored Ray-only before anyone noticed."""
import json
from urllib.error import URLError

import pytest

import capture_openmeteo as co


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload
    def read(self):
        return json.dumps(self._payload).encode()
    def __enter__(self):
        return self
    def __exit__(self, *a):
        return False


def test_fetch_json_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}
    def fake_urlopen(req, timeout=None):
        calls["n"] += 1
        if calls["n"] < 3:
            raise URLError("handshake timed out")
        return _FakeResp({"ok": True})
    monkeypatch.setattr(co, "urlopen", fake_urlopen)
    monkeypatch.setattr(co.time, "sleep", lambda s: None)
    assert co.fetch_json("http://x", attempts=3) == {"ok": True}
    assert calls["n"] == 3


def test_fetch_json_raises_not_exits_after_exhausting_attempts(monkeypatch):
    def fake_urlopen(req, timeout=None):
        raise URLError("down")
    monkeypatch.setattr(co, "urlopen", fake_urlopen)
    monkeypatch.setattr(co.time, "sleep", lambda s: None)
    # URLError (an Exception), NOT SystemExit — catchable by per-source loops.
    with pytest.raises(URLError):
        co.fetch_json("http://x", attempts=2)


def test_fetch_json_failure_is_catchable_by_except_exception(monkeypatch):
    def fake_urlopen(req, timeout=None):
        raise URLError("down")
    monkeypatch.setattr(co, "urlopen", fake_urlopen)
    monkeypatch.setattr(co.time, "sleep", lambda s: None)
    caught = False
    try:
        co.fetch_json("http://x", attempts=1)
    except Exception:
        caught = True
    assert caught
