#!/usr/bin/env python3
"""Historical repair: correct the capture-day low for Met.no + OpenWeatherMap in
every already-scored comparison.

Both adapters derived the daily low as min() over a partially-elapsed capture
day, biasing it warm by 5–17°F and unfairly tanking the low-temp score on every
scored day. This replaces each stored prediction's low_f with the day-ahead
forecast low (recovered from the prior day's capture via compare._fix_bucket_low)
— or forfeits the low when no prior capture exists (the first tracked day) — then
rebuilds data/scores.json through rescore_history.

Scans all comparison files so it catches any day written before the forward fix
in compare.py landed. Idempotent: a day whose stored low already matches the
recovery is left untouched."""
import json
from pathlib import Path

import compare
import rescore_history

DATA = Path(__file__).resolve().parent.parent / "data"
KEYS = sorted(compare._BUCKET_LOW_SOURCES)


def main():
    fixed = 0
    for cpath in sorted((DATA / "comparisons").glob("*.json")):
        date = cpath.stem
        comp = json.load(open(cpath))
        changed = False
        for key in KEYS:
            sd = comp.get("sources", {}).get(key)
            if not sd or "prediction" not in sd:
                continue
            pred = sd["prediction"]
            fp = pred.get("fields_provided", [])
            before = (pred.get("low_f"), "low" in fp)
            compare._fix_bucket_low(key, date, pred)  # mutates pred in place
            after = (pred.get("low_f"), "low" in pred.get("fields_provided", []))
            if after != before:
                changed = True
                fixed += 1
                tag = " (forfeit — no prior capture)" if after[0] is None else ""
                print(f"  {date} {key}: low {before[0]} -> {after[0]}{tag}")
        if changed:
            with open(cpath, "w") as f:
                json.dump(comp, f, indent=2)

    print(f"  Corrected {fixed} source-day low(s)")
    # Re-score every comparison from its (now-corrected) prediction + rebuild scores.json
    rescore_history.main()


if __name__ == "__main__":
    main()
