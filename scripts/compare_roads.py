#!/usr/bin/env python3
"""
compare_roads.py — score the road-condition forecast for a date vs the captured
actual, updating data/road_scores.json (the running road-forecast scoreboard).

The forecast level for date D was issued the day before, so we re-derive it from
D-1's committed Open-Meteo prediction using the same rubric (no separate archive
needed — mirrors how compare.py reads prior predictions). The actual is
worst_actual_level from data/road_conditions/{D}.json.

Fail-closed, stdlib only: always exits 0. Missing forecast or actual prints a
clean skip and leaves the scoreboard untouched.

Usage: python scripts/compare_roads.py [YYYY-MM-DD]   (default: yesterday)
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from roads import road_condition_forecast, score_road_forecast  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def forecast_level_for(target: str) -> str | None:
    """Road-surface level forecast for `target`, derived from the prior day's
    Open-Meteo prediction row. None if that prediction is missing."""
    prior = (date.fromisoformat(target) - timedelta(days=1)).isoformat()
    f = DATA_DIR / "predictions" / prior / "openmeteo_forecast.json"
    if not f.exists():
        return None
    try:
        rows = json.loads(f.read_text()).get("daily", [])
    except ValueError:
        return None
    for row in rows:
        if row.get("date") == target:
            return road_condition_forecast(row)["level"]
    return None


def compare(target: str) -> int:
    actual_f = DATA_DIR / "road_conditions" / f"{target}.json"
    if not actual_f.exists():
        print(f"no captured actual for {target}; skipping", file=sys.stderr)
        return 0
    try:
        actual = json.loads(actual_f.read_text()).get("worst_actual_level", "Clear")
    except ValueError:
        print(f"unreadable actual for {target}; skipping", file=sys.stderr)
        return 0

    fl = forecast_level_for(target)
    if fl is None:
        print(f"no prior forecast for {target}; skipping", file=sys.stderr)
        return 0

    result = {"date": target, **score_road_forecast(fl, actual)}
    scores_f = DATA_DIR / "road_scores.json"
    scores = {"days": []}
    if scores_f.exists():
        try:
            scores = json.loads(scores_f.read_text())
        except ValueError:
            scores = {"days": []}
    scores["days"] = [d for d in scores.get("days", []) if d.get("date") != target] + [result]
    scores["days"].sort(key=lambda d: d["date"])
    n = len(scores["days"])
    scores["average"] = round(sum(d["score"] for d in scores["days"]) / n, 1) if n else None
    scores["updated_at"] = target
    scores_f.write_text(json.dumps(scores, indent=2) + "\n")
    print(f"scored {target}: forecast={fl} actual={actual} score={result['score']}")
    return 0


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else (date.today() - timedelta(days=1)).isoformat()
    sys.exit(compare(target))
