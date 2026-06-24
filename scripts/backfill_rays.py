#!/usr/bin/env python3
"""
backfill_rays.py — rebuild Ray's era from saved raw_text (stdlib-only, no Playwright)

The original ``data/predictions/<date>/rays_boone.json`` files in the Ray era
were produced by the OLD capture code, which (a) mis-anchored the daily strip by
one day (an off-by-one in the day-name math) and (b) never recovered the wind
*interval* or precip *type*. That makes historical scores unfair.

This backfill re-parses each era file's SAVED ``raw_text`` (and the existing
per-day ``daytime_desc``/``overnight_desc``) through the FIXED parsers in
``capture_rays.py``, rebuilding ``daily[]`` with:
  * dates anchored to ``<date>`` taken from the directory name (never now()),
  * ``wind_lo``/``wind_hi``/``wind_mph`` (= interval midpoint), and
  * ``precip_type``.

It writes the result to a SIBLING ``rays_boone.rebuilt.json`` — the original
``rays_boone.json`` is NEVER overwritten (auditability). ``compare.py`` prefers
the rebuilt file when present.

Per-day safety: the off-by-one canary (``daily[0].high_f == forecast.today_high_f``)
is validated. On failure we LOG and SKIP that date — no rebuilt file is written,
so ``compare.py`` falls back to the (untouched) original. We never guess.

Run: ``python scripts/backfill_rays.py``
"""

import json
import sys
from pathlib import Path

# Import the FIXED parsers from the capture module. These are pure stdlib (the
# Playwright import in capture_rays.py is lazy), so this works in a stdlib-only
# runtime with no browser installed.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from capture_rays import _parse_daily_forecast, _check_day0_canary  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PRED_DIR = ROOT / "data" / "predictions"

# The Ray era — the window over which Ray's forecasts were captured. Anything
# before this is pre-era and is left alone.
ERA_START = "2026-03-04"


def _era_dates():
    """Yield (date_str, rays_json_path) for every era dir with a rays capture."""
    if not PRED_DIR.exists():
        return
    for d in sorted(PRED_DIR.iterdir()):
        if not d.is_dir():
            continue
        date = d.name
        if date < ERA_START:
            continue
        rays = d / "rays_boone.json"
        if rays.exists():
            yield date, rays


def rebuild_one(date, rays_path):
    """
    Rebuild a single era file. Returns one of:
      ("rebuilt", out_path)  — wrote rays_boone.rebuilt.json
      ("skipped", reason)    — canary failed or no raw_text; original left as-is
      ("error", reason)      — unreadable/unparseable; original left as-is
    """
    try:
        data = json.loads(rays_path.read_text())
    except (json.JSONDecodeError, OSError) as e:
        return ("error", f"unreadable: {e}")

    raw_text = data.get("raw_text") or ""
    if not raw_text:
        return ("skipped", "no raw_text to re-parse")

    # Re-parse the saved narrative with dates anchored to the directory date.
    daily = _parse_daily_forecast(raw_text, capture_date=date)
    if not daily:
        return ("skipped", "parser produced no daily entries")

    forecast = data.get("forecast") or {}

    # Off-by-one canary. _check_day0_canary returns False only when both highs
    # are present AND disagree (a true label shift); a missing day-0 high — the
    # normal mid-morning-capture case — returns True (indeterminate, not a fault).
    if not _check_day0_canary(daily, forecast):
        d0 = daily[0].get("high_f")
        fh = forecast.get("today_high_f")
        return ("skipped", f"day-0 canary failed (daily[0].high_f={d0} != forecast.today_high_f={fh})")

    # Build the rebuilt document: a copy of the original with daily[] replaced.
    # Everything else (current, forecast, narrative, raw_text, captured_at) is
    # preserved verbatim so the rebuilt file is a faithful, audit-friendly
    # superset of the original.
    rebuilt = dict(data)
    rebuilt["daily"] = daily
    rebuilt["rebuilt_from"] = "rays_boone.json"
    rebuilt["rebuilt_note"] = (
        "daily[] re-parsed from saved raw_text via fixed capture_rays parsers; "
        "dates anchored to capture date; wind interval + precip_type recovered."
    )

    out_path = rays_path.parent / "rays_boone.rebuilt.json"
    out_path.write_text(json.dumps(rebuilt, indent=2))
    return ("rebuilt", out_path)


def main():
    rebuilt = skipped = errored = 0
    skip_detail = []
    print(f"Backfilling Ray's era (>= {ERA_START}) from saved raw_text...\n")
    for date, rays_path in _era_dates():
        status, info = rebuild_one(date, rays_path)
        if status == "rebuilt":
            rebuilt += 1
        elif status == "skipped":
            skipped += 1
            skip_detail.append((date, info))
            print(f"  SKIP {date}: {info}")
        else:  # error
            errored += 1
            skip_detail.append((date, info))
            print(f"  ERROR {date}: {info}")

    print(f"\n{'='*60}")
    print(f"  Backfill complete")
    print(f"{'='*60}")
    print(f"  rebuilt: {rebuilt}")
    print(f"  skipped: {skipped}")
    print(f"  errored: {errored}")
    if skip_detail:
        print("\n  Skipped/errored dates (left as-is):")
        for date, info in skip_detail:
            print(f"    {date}: {info}")


if __name__ == "__main__":
    main()
