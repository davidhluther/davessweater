#!/usr/bin/env python3
"""Backfill sweep: re-score any recent day that was captured but never scored.

When the Open-Meteo archive lags (it posts a day 1-5 days late), compare.py finds
no actuals for that day and writes no comparison. Once the archive catches up,
nothing revisits the day on its own, so it becomes a permanent gap (that is how
2026-05-22 was lost). Run each day after the main comparison, this sweep looks back
over a window for any date that has a predictions/ capture but no comparison,
fetches its now-available actuals, and scores it.

Idempotent: a day that already has a comparison, or whose actuals still aren't
posted, is left alone (and retried on a later run until it ages out of the window).

Usage: python scripts/backfill_missing.py [--window N]  (default 14 days)
"""
import subprocess
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SCRIPTS = BASE_DIR / "scripts"
EST = ZoneInfo("America/New_York")
WINDOW = 14


def dates_needing_recovery(today, window=WINDOW):
    """Dates in [today-window, today-2] that were captured (a predictions dir
    exists) but never scored (no comparison file). `today` is a date object.

    Starts at today-2 because yesterday (today-1) is the main daily compare's job,
    not the sweep's."""
    out = []
    for i in range(2, window + 1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        if (DATA_DIR / "predictions" / d).is_dir() and not (DATA_DIR / "comparisons" / f"{d}.json").exists():
            out.append(d)
    return out


def _window_arg(argv):
    if "--window" in argv:
        i = argv.index("--window")
        if i + 1 < len(argv):
            try:
                return int(argv[i + 1])
            except ValueError:
                pass
    return WINDOW


def main():
    window = _window_arg(sys.argv[1:])
    today = datetime.now(EST).date()
    todo = dates_needing_recovery(today, window)
    if not todo:
        print(f"Backfill sweep: no captured-but-unscored days in the last {window} days.")
        return
    print(f"Backfill sweep: {len(todo)} captured-but-unscored day(s) to try: {', '.join(todo)}")
    recovered = []
    for d in todo:
        actuals = DATA_DIR / "actuals" / f"{d}.json"
        if not actuals.exists():
            subprocess.run([sys.executable, str(SCRIPTS / "capture_openmeteo.py"), "--actuals", "--date", d])
        if not actuals.exists():
            print(f"  {d}: actuals still not posted — will retry next run")
            continue
        subprocess.run([sys.executable, str(SCRIPTS / "compare.py"), "--date", d])
        if (DATA_DIR / "comparisons" / f"{d}.json").exists():
            recovered.append(d)
            print(f"  {d}: recovered")
    print(f"Backfill sweep: recovered {len(recovered)}/{len(todo)} — {', '.join(recovered) or 'none'}")


if __name__ == "__main__":
    main()
