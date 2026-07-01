#!/usr/bin/env python3
"""Fail the daily run loudly when a mandatory capture silently drops.

Ray's Weather deflated for weeks because a dropped or misparsed field scores 0,
indistinguishable from a genuinely bad forecast, while every workflow stayed
green. This guard asserts that the mandatory sources actually produced their
required fields for the compared date, and exits non-zero when they didn't. Wired
as a step after compare.py and BEFORE the commit step (and not continue-on-error),
so a coverage drop on the headline comparison becomes a red run + notification and
the questionable day is never committed, instead of a silent bad day.

Usage: python scripts/check_capture_health.py [--date YYYY-MM-DD]
Default date is yesterday (America/New_York), matching compare.py.
"""
import json
import os
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EST = ZoneInfo("America/New_York")

# Sources that must be captured and scored every day, with the coverage fields
# each one must provide.
#
# Open-Meteo is a machine API: every one of these is always present, so a missing
# field is a genuine capture/parse failure.
#
# Ray's reliably posts a high/low strip, so those prove his capture worked. His
# precip_type and (qualitative) wind are HONEST FORFEITS — the scoring engine
# already records them as coverage=False on days he gives no number — so requiring
# them would misread a forfeit as a drop and fail a legitimate day. A total Ray
# capture failure still trips the guard because the source is then unscored.
# (Catching a subtle *sustained* wind-parser regression, vs a one-off forfeit,
# needs a rolling coverage-delta check — a worthwhile follow-up, not this guard.)
MANDATORY = {
    "openmeteo": ["high_temp", "low_temp", "wind", "precip_type"],
    "raysweather": ["high_temp", "low_temp"],
}

FIELD_LABEL = {"high_temp": "high", "low_temp": "low", "wind": "wind",
               "precip_type": "precip type", "precip_amount": "precip amount"}


def evaluate(comp):
    """Pure check: given a parsed comparison dict, return (problems, report_lines).

    `problems` is a list of human-readable failures (empty == healthy)."""
    problems, lines = [], []
    sources = (comp.get("sources") if isinstance(comp, dict) else None) or {}
    scored = sorted(k for k, v in sources.items() if isinstance(v, dict) and isinstance(v.get("score"), dict))
    lines.append(f"Sources scored: {len(scored)} ({', '.join(scored) or 'none'})")
    for key, required in MANDATORY.items():
        sd = sources.get(key)
        if not isinstance(sd, dict) or not isinstance(sd.get("score"), dict):
            problems.append(f"{key}: not scored (capture drop?)")
            lines.append(f"  {key}: NOT SCORED")
            continue
        cov = sd["score"].get("coverage", {})
        missing = [f for f in required if not cov.get(f)]
        got = [FIELD_LABEL[f] for f in required if cov.get(f)]
        if missing:
            problems.append(f"{key}: missing {', '.join(FIELD_LABEL[m] for m in missing)} (parse/capture drop?)")
            lines.append(f"  {key}: MISSING {', '.join(FIELD_LABEL[m] for m in missing)} "
                         f"(has {', '.join(got) or 'nothing'})")
        else:
            lines.append(f"  {key}: ok ({', '.join(got)})")
    return problems, lines


def check(date):
    # The Open-Meteo archive lags 1-5 days, so yesterday's actuals may simply not
    # be posted yet. That is a benign, self-correcting delay (not a capture drop),
    # so skip the check rather than failing the run red. A backfill sweep, once
    # built, re-scores the day when its actuals land.
    if not (DATA_DIR / "actuals" / f"{date}.json").exists():
        return [], [f"actuals for {date} not available yet (archive lag) — health check skipped"]
    cpath = DATA_DIR / "comparisons" / f"{date}.json"
    if not cpath.exists():
        # Actuals ARE present but compare wrote no comparison: a real failure, not lag.
        return ([f"Actuals exist for {date} but no comparison was written (compare failure?)."],
                [f"comparison for {date}: MISSING despite actuals"])
    try:
        comp = json.load(open(cpath))
    except (json.JSONDecodeError, OSError) as e:
        return ([f"Comparison for {date} is unreadable: {e}"], [f"comparison for {date}: UNREADABLE"])
    return evaluate(comp)


def _target_date(argv):
    if "--date" in argv:
        i = argv.index("--date")
        if i + 1 < len(argv):
            return argv[i + 1]
    return (datetime.now(EST) - timedelta(days=1)).strftime("%Y-%m-%d")


def main():
    date = _target_date(sys.argv[1:])
    problems, lines = check(date)
    report = f"### Capture health — {date}\n\n" + "\n".join(lines)
    print(report)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a") as f:
            f.write(report + "\n\n" + ("**FAIL**\n" if problems else "**OK**\n"))
    if problems:
        print("\nCAPTURE HEALTH: FAIL")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"\nCAPTURE HEALTH: OK ({date})")


if __name__ == "__main__":
    main()
