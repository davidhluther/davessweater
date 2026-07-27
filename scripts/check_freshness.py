#!/usr/bin/env python3
"""Freshness sentinel: fail loudly when the daily cron simply never ran.

`check_capture_health.py` validates the DATA a run produced, but it only runs
*inside* a Daily Compare job — if a cron is skipped entirely (GitHub Actions
outage, workflow disabled, a bad edit to the schedule) nothing runs at all, so
nothing fails, so the site quietly goes stale with every check still green.
This is a standalone, independently-scheduled workflow that reads the
committed data and complains if the pipeline appears to have stopped running.

Two checks, both must pass:

1. **Today's prediction capture exists** — `data/predictions/{today}/` (America/
   New_York) has an `openmeteo_forecast.json`. That capture step in
   `daily_capture.yml` is the one step that isn't `continue-on-error`, so its
   presence is the sharpest available signal that today's Daily Capture job
   actually executed (as opposed to a source-specific hiccup downstream).
2. **The comparisons directory isn't stale** — the newest file in
   `data/comparisons/` is dated no more than 2 days ago. Daily Compare scores
   *yesterday*, so a healthy pipeline has a comparison dated yesterday every
   day; the extra day of slack absorbs the Open-Meteo archive's 1-5 day lag
   (handled by the backfill sweep) without false-alarming on a merely-delayed
   backfill.

Read-only: this workflow must never commit anything, it just goes red loudly
so the owner notices a skipped run instead of a slowly staling site.

Usage: python scripts/check_freshness.py [--date YYYY-MM-DD]
Default date ("today") is the current date in America/New_York.
"""
import os
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EST = ZoneInfo("America/New_York")

STALE_COMPARISON_DAYS = 2  # yesterday's comparison + 1 day of archive-lag slack


def check_today_capture(today: str):
    """True if today's prediction capture ran (the mandatory openmeteo_forecast.json
    is present under data/predictions/{today}/)."""
    marker = DATA_DIR / "predictions" / today / "openmeteo_forecast.json"
    if marker.exists():
        return True, f"today's capture ({today}): ok — openmeteo_forecast.json present"
    pred_dir = DATA_DIR / "predictions" / today
    if not pred_dir.is_dir():
        return False, f"today's capture ({today}): MISSING — no predictions/{today}/ directory at all"
    return False, f"today's capture ({today}): MISSING — predictions/{today}/ exists but has no openmeteo_forecast.json"


def newest_comparison_date():
    """Return the newest YYYY-MM-DD stem in data/comparisons/, or None if empty/missing."""
    comp_dir = DATA_DIR / "comparisons"
    if not comp_dir.is_dir():
        return None
    stems = sorted(p.stem for p in comp_dir.glob("*.json"))
    return stems[-1] if stems else None


def check_comparison_freshness(today: str):
    """True if the newest comparisons/*.json is within STALE_COMPARISON_DAYS of today."""
    newest = newest_comparison_date()
    if newest is None:
        return False, "comparisons: MISSING — data/comparisons/ has no files at all"
    try:
        today_d = date.fromisoformat(today)
        newest_d = date.fromisoformat(newest)
    except ValueError:
        return False, f"comparisons: newest file '{newest}' is not a parseable date"
    age = (today_d - newest_d).days
    if age < 0:
        # A comparison dated in the future relative to "today" — clock skew or a
        # manual --date override pointed at the past; not a staleness problem.
        return True, f"comparisons: newest is {newest} (dated after the reference date {today}) — ok"
    if age > STALE_COMPARISON_DAYS:
        return False, (f"comparisons: STALE — newest is {newest}, {age} days old "
                        f"(reference date {today}, allowed up to {STALE_COMPARISON_DAYS})")
    return True, f"comparisons: newest is {newest}, {age} day(s) old — ok"


def check_town_captures(today: str):
    """True if every registered town has today's openmeteo_forecast.json.

    Added 2026-07-27 after a five-day silent partial-sweep: capture_locations
    died mid-loop on one fetch (a sys.exit inside fetch_json) and the
    continue-on-error step kept the workflow green, so most towns scored only
    Ray (his 7-day capture coasts over gaps) while the other nine sources went
    dark. The sentinel is the backstop that makes that loud within hours.
    Strict on purpose: with per-fetch retries now in the capture path, a
    missing town marker means something real broke, not a blip.
    """
    loc_root = DATA_DIR / "locations"
    if not loc_root.is_dir():
        return True, "towns: no locations registry — nothing to check"
    towns = sorted(p.name for p in loc_root.iterdir()
                   if p.is_dir() and (p / "predictions").is_dir())
    if not towns:
        return True, "towns: no town prediction dirs yet — nothing to check"
    missing = [t for t in towns
               if not (loc_root / t / "predictions" / today / "openmeteo_forecast.json").exists()]
    if missing:
        return False, (f"towns: MISSING today's ({today}) capture for {len(missing)}/{len(towns)}: "
                       + ", ".join(missing))
    return True, f"towns: all {len(towns)} towns captured today ({today})"


def run_checks(today: str):
    """Pure check: given a reference date string, return (problems, report_lines)."""
    problems, lines = [], []
    for ok, msg in (check_today_capture(today), check_comparison_freshness(today),
                    check_town_captures(today)):
        lines.append(("  OK   " if ok else "  FAIL ") + msg)
        if not ok:
            problems.append(msg)
    return problems, lines


def _target_date(argv):
    if "--date" in argv:
        i = argv.index("--date")
        if i + 1 < len(argv):
            return argv[i + 1]
    return datetime.now(EST).strftime("%Y-%m-%d")


def main():
    today = _target_date(sys.argv[1:])
    problems, lines = run_checks(today)
    report = f"### Freshness sentinel — reference date {today}\n\n" + "\n".join(lines)
    print(report)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        footer = "**FAIL**" if problems else "**OK**"
        with open(step_summary, "a") as f:
            f.write(report + "\n\n" + footer + "\n")
    if problems:
        print("\nFRESHNESS SENTINEL: FAIL — the daily pipeline may not have run.")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"\nFRESHNESS SENTINEL: OK ({today})")


if __name__ == "__main__":
    main()
