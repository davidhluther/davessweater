#!/usr/bin/env python3
"""Re-score every committed comparison from its stored prediction + actuals using
the current scoring engine, then rebuild data/scores.json.

Needed whenever the scoring logic changes in a way that alters the per-field
breakdown (e.g. the implied-zero precip rule, where a "no rain" forecast now earns
the amount points on dry days). Full-coverage sources (Open-Meteo, the Apple
fallback) are unaffected; only sources that forfeit a field move. Idempotent."""
import json
from pathlib import Path

import compare

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


def main():
    n = sum(rescore(p) for p in sorted((DATA / "comparisons").glob("*.json")))
    print(f"Re-scored {n} comparison file(s)")
    compare._update_running_scores(None, None)  # rebuild scores.json from all comparisons


if __name__ == "__main__":
    main()
