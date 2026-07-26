#!/usr/bin/env python3
"""Re-score every committed comparison from its stored prediction + actuals using
the current scoring engine, then rebuild data/scores.json AND every town board.

Needed whenever the scoring logic changes in a way that alters the per-field
breakdown or points (e.g. the implied-zero precip rule; the 2026-07-26
recalibration: 1°F temp window + merged 20-pt precip). Re-scores the stored
prediction in place — the stored prediction already carries any capture-day
transforms (bucket-low recovery), so it is not re-derived. Full-coverage sources
(Open-Meteo, the Apple fallback) move only on the temp change; forfeit-prone
sources also move on precip. Idempotent; originals (predictions/actuals) untouched.

Covers the towns under data/locations/{slug}/ too, so the per-town scoreboards
stay consistent with Boone's after a rubric change."""
import json
from pathlib import Path

import compare
import compare_locations
from locations import load_locations

DATA = Path(__file__).resolve().parent.parent / "data"


def rescore(path):
    d = json.load(open(path))
    actuals = d.get("actuals")
    if not actuals:
        return False
    norm = compare._normalize_actual(actuals)
    changed = False
    for sd in d.get("sources", {}).values():
        pred = sd.get("prediction")
        if pred is None or "score" not in sd:
            continue
        new = compare.score_prediction(compare._to_contract(pred), norm)
        if new != sd["score"]:
            sd["score"] = new
            changed = True
    if changed:
        with open(path, "w") as f:
            json.dump(d, f, indent=2)
    return changed


def rescore_towns():
    """Re-score every town's committed comparisons and rebuild each town's
    scores.json. Uses the same in-place rescore as Boone; the town composite is a
    stored prediction re-scored like any other source."""
    locs = {l["slug"]: l for l in load_locations()}
    total_changed, towns = 0, 0
    for loc_dir in sorted((DATA / "locations").glob("*/comparisons")):
        slug = loc_dir.parent.name
        loc = locs.get(slug)
        if loc is None:
            continue
        changed = sum(rescore(p) for p in sorted(loc_dir.glob("*.json")))
        compare_locations.rebuild_scores(loc)
        total_changed += changed
        towns += 1
    print(f"Re-scored {total_changed} town comparison file(s) across {towns} town(s)")


def main():
    n = sum(rescore(p) for p in sorted((DATA / "comparisons").glob("*.json")))
    print(f"Re-scored {n} Boone comparison file(s)")
    compare._update_running_scores(None, None)  # rebuild scores.json from all comparisons
    rescore_towns()


if __name__ == "__main__":
    main()
