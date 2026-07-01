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


def _apple_fallback_note(date, comp):
    """A screenshot uploaded but scored as the Open-Meteo fallback means the iPhone
    Shortcut sent a PNG without scoreable numbers — the silent real-Apple regression.
    Surface it (non-fatal: the fallback is an owner-accepted stand-in, so it must not
    fail the run — but a lost real-Apple day should still show up)."""
    apple = comp.get("sources", {}).get("apple_weather", {})
    if not isinstance(apple, dict) or "score" not in apple:
        return []
    screenshot = (DATA_DIR / "predictions" / date / "iphone_screenshot.png").exists()
    if screenshot and apple.get("source") != "iPhone Shortcut":
        return [f"  NOTE apple: scored on the Open-Meteo fallback though a screenshot was uploaded "
                f"for {date} — the Shortcut may be sending a PNG but no scoreable data (real Apple lost)."]
    return []


# ── Rolling drift detection ──────────────────────────────────────────────
# The point-in-time check above lets a source forfeit a soft field on any single
# day (Ray's qualitative wind, say). What it can't see is a field that was
# reliably provided for months and then quietly goes dark for weeks — the exact
# shape of the Ray wind-parser regression that deflated his scores unnoticed.
# This flags a source+field that has provided NOTHING for DRIFT_DARK_RUN straight
# scored days despite being provided on most of the prior DRIFT_BASELINE_DAYS.
#
# Scoped to the two stable-coverage sources: Open-Meteo (the machine API) and
# Ray's (the graded competitor, where deflation is the credibility risk). The 7
# new sources lack the history; Apple's coverage is intentionally shifting as real
# screenshots replace the fallback. Non-fatal by default (a heuristic on live
# data) — set DRIFT_FATAL = True to make a drift finding fail the run instead.
DRIFT_SOURCES = {"openmeteo", "raysweather"}
DRIFT_DARK_RUN = 7          # consecutive recent scored days a field is absent
DRIFT_BASELINE_DAYS = 30    # scored days before that run used to judge "normally provided"
DRIFT_MIN_BASELINE = 15     # need at least this many baseline days to judge
DRIFT_BASELINE_MIN = 0.7    # ...and the field must have been provided >= this fraction
DRIFT_FATAL = False


def _drift_series(as_of_date):
    """Build {source: {field: [covered_bool ... oldest->newest]}} for the drift
    sources over the comparison files up to and including as_of_date (only days the
    source was actually scored are recorded)."""
    cov_fields = list(FIELD_LABEL)
    series = {s: {f: [] for f in cov_fields} for s in DRIFT_SOURCES}
    files = sorted(p for p in (DATA_DIR / "comparisons").glob("*.json") if p.stem <= as_of_date)
    for p in files[-(DRIFT_DARK_RUN + DRIFT_BASELINE_DAYS + 10):]:
        try:
            comp = json.load(open(p))
        except (json.JSONDecodeError, OSError):
            continue
        srcs = comp.get("sources", {}) if isinstance(comp, dict) else {}
        for s in DRIFT_SOURCES:
            sd = srcs.get(s)
            if not isinstance(sd, dict) or not isinstance(sd.get("score"), dict):
                continue  # source not scored that day — that's the point-in-time check's job
            cov = sd["score"].get("coverage", {})
            for f in cov_fields:
                series[s][f].append(bool(cov.get(f)))
    return series


def drift_findings(series):
    """series: {source: {field: [covered_bool ... oldest->newest]}}. Flag a field
    that has gone dark for a sustained run despite normally being provided."""
    out = []
    for src in sorted(series):
        for field, covered in series[src].items():
            dark = 0
            for c in reversed(covered):
                if c:
                    break
                dark += 1
            if dark < DRIFT_DARK_RUN:
                continue
            baseline = covered[:-dark][-DRIFT_BASELINE_DAYS:]
            if len(baseline) < DRIFT_MIN_BASELINE:
                continue
            ratio = sum(baseline) / len(baseline)
            if ratio >= DRIFT_BASELINE_MIN:
                out.append(f"{src} {FIELD_LABEL[field]}: absent for the last {dark} scored days, but "
                           f"provided {ratio * 100:.0f}% of the prior {len(baseline)} — likely a capture/parse regression.")
    return out


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
    problems, lines = evaluate(comp)
    lines += _apple_fallback_note(date, comp)
    return problems, lines


def _target_date(argv):
    if "--date" in argv:
        i = argv.index("--date")
        if i + 1 < len(argv):
            return argv[i + 1]
    return (datetime.now(EST) - timedelta(days=1)).strftime("%Y-%m-%d")


def main():
    date = _target_date(sys.argv[1:])
    problems, lines = check(date)
    drift = drift_findings(_drift_series(date))
    if drift:
        lines.append("\nRolling coverage drift:")
        lines += [f"  DRIFT {d}" for d in drift]
        if DRIFT_FATAL:
            problems += drift
    report = f"### Capture health — {date}\n\n" + "\n".join(lines)
    print(report)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        footer = "**FAIL**" if problems else ("**OK (drift warning)**" if drift else "**OK**")
        with open(step_summary, "a") as f:
            f.write(report + "\n\n" + footer + "\n")
    if problems:
        print("\nCAPTURE HEALTH: FAIL")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"\nCAPTURE HEALTH: OK{' with drift warning(s)' if drift else ''} ({date})")


if __name__ == "__main__":
    main()
