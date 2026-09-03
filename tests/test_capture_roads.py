"""test_capture_roads.py — nps_fetch_ok must distinguish an NPS auth/fetch
failure from a genuine zero-alert response.

The 2026-09-03 leaf-benchmark finding: parkway_alerts was [] in every daily
roads file for 25 straight days while NPS's own closure page listed five
closed Blue Ridge Parkway segments. A missing/invalid NPS_API_KEY and a
no-closures response wrote identical files (no nps_fetch_ok field existed),
and the DriveNC-only `fetch_ok` covered neither case. Live verification
2026-09-03: NPS_API_KEY is a configured GitHub Actions secret and the live
`daily_capture` run fetched successfully with 0 alerts (confirmed against
the public API directly: parkCode=blri genuinely returns `data: []` right
now) — our feed was correct; NPS's road-closures page draws from a separate
system than the general Alerts API. This test locks in the visibility fix
so a *future* auth failure doesn't silently masquerade as "no closures"
again.
"""
import json

import capture_roads as cr


class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _no_drivenc_key(monkeypatch):
    # Keep the DriveNC leg out of scope for these NPS-focused tests.
    monkeypatch.setattr(cr, "DRIVENC_API_KEY", "")


def test_nps_fetch_ok_true_on_genuine_empty_result(monkeypatch, tmp_path):
    """Key present, API reachable, zero alerts -> ok=True, alerts=[]."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "real-key")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)

    def fake_urlopen(req, timeout=None):
        return _FakeResp({"total": "0", "data": []})

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()

    out = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert out["nps_fetch_ok"] is True
    assert out["parkway_alerts"] == []


def test_nps_fetch_ok_false_on_key_missing(monkeypatch, tmp_path):
    """No key at all -> ok=False, alerts=[] (never attempted)."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)

    def fake_urlopen(req, timeout=None):
        raise AssertionError("should not fetch NPS without a key")

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()

    out = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert out["nps_fetch_ok"] is False
    assert out["parkway_alerts"] == []


def test_nps_fetch_ok_false_on_fetch_failure(monkeypatch, tmp_path):
    """Key present but the request fails (bad/expired key, network) -> ok=False, alerts=[]."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "bad-key")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)

    from urllib.error import URLError

    def fake_urlopen(req, timeout=None):
        raise URLError("403 forbidden")

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()

    out = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert out["nps_fetch_ok"] is False
    assert out["parkway_alerts"] == []


def test_nps_fetch_ok_distinguishes_failure_from_empty(monkeypatch, tmp_path):
    """The core regression check: failure and genuine-empty must not collapse
    to the same record."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)
    cr.main()
    missing_key_out = json.loads(next(tmp_path.glob("*.json")).read_text())

    monkeypatch.setattr(cr, "NPS_API_KEY", "real-key")

    def fake_urlopen(req, timeout=None):
        return _FakeResp({"total": "0", "data": []})

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()
    empty_result_out = json.loads(next(tmp_path.glob("*.json")).read_text())

    assert missing_key_out["parkway_alerts"] == empty_result_out["parkway_alerts"] == []
    assert missing_key_out["nps_fetch_ok"] != empty_result_out["nps_fetch_ok"]


# --- roadevents (WZDx) leg -------------------------------------------------
# 2026-09-03: `alerts` was verified correct (genuinely empty); NPS's public
# BRP closures page draws from a separate system. That system is the
# `roadevents` endpoint (developer.nps.gov swagger: /roadevents, WZDx-shaped
# FeatureCollection list). These tests cover that second leg with the same
# fetch-ok/genuine-empty distinguishability pattern as the alerts tests above.

_SAMPLE_FEATURE_COLLECTION = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "13a5ed88-e452-440f-8daf-98707ed728b5",
            "properties": {
                "core_details": {
                    "name": "MP 261.2-276.4 Closure",
                    "description": "Closed for seasonal maintenance.",
                    "event_type": "work-zone",
                    "road_names": ["Blue Ridge Parkway"],
                },
                "start_date": "2026-08-01T00:00:00Z",
                "end_date": "2026-09-15T00:00:00Z",
                "vehicle_impact": "all-lanes-closed",
            },
        }
    ],
}


def test_roadevents_fetch_ok_true_with_closures(monkeypatch, tmp_path):
    """Key present, roadevents reachable, features present -> ok=True, parsed events."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "real-key")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)

    def fake_urlopen(req, timeout=None):
        return _FakeResp([_SAMPLE_FEATURE_COLLECTION])

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()

    out = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert out["nps_roadevents_fetch_ok"] is True
    assert len(out["parkway_road_events"]) == 1
    ev = out["parkway_road_events"][0]
    assert ev["road"] == "Blue Ridge Parkway"
    assert ev["description"] == "Closed for seasonal maintenance."
    assert ev["event_type"] == "work-zone"


def test_roadevents_fetch_ok_false_on_key_missing(monkeypatch, tmp_path):
    """No key at all -> ok=False, events=[] (never attempted)."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)

    def fake_urlopen(req, timeout=None):
        raise AssertionError("should not fetch NPS without a key")

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()

    out = json.loads(next(tmp_path.glob("*.json")).read_text())
    assert out["nps_roadevents_fetch_ok"] is False
    assert out["parkway_road_events"] == []


def test_roadevents_fetch_ok_distinguishes_failure_from_empty(monkeypatch, tmp_path):
    """The core regression check, mirrored for the roadevents leg."""
    _no_drivenc_key(monkeypatch)
    monkeypatch.setattr(cr, "NPS_API_KEY", "")
    monkeypatch.setattr(cr, "OUT_DIR", tmp_path)
    cr.main()
    missing_key_out = json.loads(next(tmp_path.glob("*.json")).read_text())

    monkeypatch.setattr(cr, "NPS_API_KEY", "real-key")

    def fake_urlopen(req, timeout=None):
        return _FakeResp([{"type": "FeatureCollection", "features": []}])

    monkeypatch.setattr(cr, "urlopen", fake_urlopen)
    cr.main()
    empty_result_out = json.loads(next(tmp_path.glob("*.json")).read_text())

    assert missing_key_out["parkway_road_events"] == empty_result_out["parkway_road_events"] == []
    assert missing_key_out["nps_roadevents_fetch_ok"] != empty_result_out["nps_roadevents_fetch_ok"]
