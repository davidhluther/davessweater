#!/usr/bin/env python3
"""Backfill lead-time scoring across all history, then rebuild the aggregate.

One-shot companion to leadtime.py: builds data/leadtime/{date}.json for every
date with committed actuals, then rolls them up into data/leadtime_scores.json.
Safe to re-run — both builders overwrite their outputs deterministically.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leadtime import DATA_DIR, build_leadtime, build_leadtime_scores


def main():
    dates = sorted(p.stem for p in (DATA_DIR / "actuals").glob("*.json"))
    built = 0
    skipped = []
    for d in dates:
        if build_leadtime(d):
            built += 1
        else:
            skipped.append(d)
    agg = build_leadtime_scores()
    n_cells = sum(len(v) for v in agg["by_source"].values())
    print(f"backfilled {built}/{len(dates)} dates; "
          f"aggregate has {n_cells} source×lead cells")
    # A skip means build_leadtime returned None for a date that HAS an actuals
    # file — i.e. the file is corrupt/unreadable. Name it instead of letting it
    # hide inside the built/total counts.
    for d in skipped:
        print(f"skipped: {d}")


if __name__ == "__main__":
    main()
