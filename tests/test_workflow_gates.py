"""Structural tests for the Argon 11/16 workflow fixes (D7, D8, D9). The
workflows can't run locally, so these pin the gates that make each failure loud
or self-healing; a regression edit fails here instead of silently in Actions."""

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

WF = Path(__file__).resolve().parent.parent / ".github" / "workflows"


def _steps(name):
    doc = yaml.safe_load((WF / name).read_text())
    (job,) = doc["jobs"].values()
    return {s.get("id") or s.get("name"): s for s in job["steps"]}, job["steps"]


# --- D7: grading gated on its own output -------------------------------------

def test_traffic_grading_gated_on_yesterdays_comparison():
    by_id, _ = _steps("traffic_actuals.yml")
    grade = by_id["grade"]["run"]
    assert "traffic/comparisons/${yesterday}.json" in grade
    assert "compare_traffic.py" in grade
    # The old bug: grading was gated on TODAY's forecast file being absent.
    assert "traffic/forecast/" not in grade
    forecast = by_id["forecast"]["run"]
    assert "traffic/forecast/${today}.json" in forecast
    assert "compare_traffic.py" not in forecast


def test_traffic_model_failures_are_not_swallowed():
    by_id, steps = _steps("traffic_actuals.yml")
    for sid in ("grade", "forecast"):
        assert "|| true" not in by_id[sid]["run"]
    names = [s.get("name", "") for s in steps]
    loud = next(s for s in steps if "Fail loudly when the traffic model" in s.get("name", ""))
    assert "steps.grade.outcome == 'failure'" in loud["if"]
    assert "steps.forecast.outcome == 'failure'" in loud["if"]
    assert "exit 1" in loud["run"]
    # Runs after the commit so the sample still lands.
    assert names.index(loud["name"]) > next(i for i, n in enumerate(names) if n.startswith("Commit"))


# --- D8: traffic freshness lives in the independent sentinel -----------------

def test_traffic_freshness_check_moved_to_sentinel():
    _, traffic_steps = _steps("traffic_actuals.yml")
    assert not any("--traffic-only" in (s.get("run") or "") for s in traffic_steps)

    _, steps = _steps("freshness_sentinel.yml")
    runs = [s.get("run") or "" for s in steps]
    mount = next(i for i, r in enumerate(runs) if "git clone" in r and "PRIVATE_DATA_REPO" in r)
    check = next(i for i, r in enumerate(runs) if "check_freshness.py --traffic-only" in r)
    assert mount < check
    # Both report even if the weather check before them failed.
    assert steps[mount]["if"] == "always()" and steps[check]["if"] == "always()"
    # Read-only: the sentinel never pushes.
    assert not any("git push" in r or "git commit" in r for r in runs)


def test_sentinel_points_scripts_at_the_mounted_store():
    doc = yaml.safe_load((WF / "freshness_sentinel.yml").read_text())
    assert doc["env"]["DS_PRIVATE_DATA_DIR"].endswith("/private-data")


# --- D9: periodic pulls fail loudly ------------------------------------------

def test_periodic_pull_failures_turn_the_capture_run_red():
    by_id, steps = _steps("daily_capture.yml")
    assert by_id["nps"]["continue-on-error"] is True
    assert by_id["races"]["continue-on-error"] is True
    names = [s.get("name", "") for s in steps]
    loud = next(s for s in steps if "Fail loudly on missed periodic pulls" in s.get("name", ""))
    assert "steps.nps.outcome == 'failure'" in loud["if"]
    assert "steps.races.outcome == 'failure'" in loud["if"]
    assert loud["if"].startswith("always()")
    assert "exit 1" in loud["run"]
    assert names.index(loud["name"]) > names.index("Commit captures")
