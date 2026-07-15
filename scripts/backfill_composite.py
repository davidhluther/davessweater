#!/usr/bin/env python3
"""Backfill the Dave's Sweater Index (composite consensus) across all history.

Every committed comparison already stores each member source's raw prediction,
so the DSI can be reconstructed for past days without re-fetching anything: for
each comparison file, rebuild sources['composite'] from the members on disk and
re-score it, then rebuild data/scores.json from the full set.

One-shot companion to compare.add_composite_source (which handles the live daily
run). Idempotent — recomputes the composite from the members each run, and drops
the composite on any day with fewer than two scoreable members.
"""
import json
from pathlib import Path

import compare

DATA = Path(__file__).resolve().parent.parent / "data"


def backfill(path):
    """Recompute the composite for one comparison file. Returns True if the file
    changed on disk."""
    d = json.load(open(path))
    before = d.get("sources", {}).get(compare.COMPOSITE_KEY)
    compare.add_composite_source(d)
    after = d.get("sources", {}).get(compare.COMPOSITE_KEY)
    if after == before:
        return False
    with open(path, "w") as f:
        json.dump(d, f, indent=2)
    return True


def main():
    files = sorted((DATA / "comparisons").glob("*.json"))
    changed = sum(backfill(p) for p in files)
    scored = 0
    for p in files:
        try:
            d = json.load(open(p))
        except (json.JSONDecodeError, OSError):
            continue
        if compare.COMPOSITE_KEY in d.get("sources", {}):
            scored += 1
    compare._update_running_scores(None, None)  # rebuild scores.json from all comparisons
    print(f"composite: updated {changed} file(s); present on {scored}/{len(files)} scored days")


if __name__ == "__main__":
    main()
