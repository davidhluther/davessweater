#!/usr/bin/env python3
"""R2 backfill — convert every committed comparison's per-source score to the
coverage-normalized model (score = raw_points / max_available * 100).

Idempotent and re-runnable: it recomputes raw_points and max_available from each
stored per-field breakdown and NEVER trusts the stored score.score, so running it
twice is a no-op. Full-coverage sources (Open-Meteo, the Apple fallback) have
max_available == 100, so their scores stay byte-identical; only sources that forfeit
a field (Ray's precip amount) move. Then rebuilds data/scores.json from the updated
comparison files. Going forward, scoring.py emits normalized scores directly, so the
daily pipeline needs no change — this only fixes the existing history."""
import json
from pathlib import Path

from scoring import normalized_score, _score_grade
import compare

DATA = Path(__file__).resolve().parent.parent / "data"


def renormalize_comparison(path):
    data = json.load(open(path))
    changed = False
    for sd in data.get("sources", {}).values():
        sc = sd.get("score")
        if not sc or "breakdown" not in sc:
            continue
        bd = sc["breakdown"]
        raw = round(sum((bd[f]["points"] or 0) for f in bd if bd[f].get("scored")), 1)
        max_available = sum(bd[f]["max"] for f in bd if bd[f].get("scored"))
        norm = normalized_score(raw, max_available)
        new = {**sc, "score": norm, "raw_points": raw,
               "max_available": max_available, "grade": _score_grade(norm)}
        if new != sc:
            sd["score"] = new
            changed = True
    if changed:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    return changed


def main():
    comp_dir = DATA / "comparisons"
    n = sum(renormalize_comparison(p) for p in sorted(comp_dir.glob("*.json")))
    print(f"Renormalized {n} comparison file(s)")
    compare._update_running_scores(None, None)  # rebuilds scores.json from all comparisons


if __name__ == "__main__":
    main()
