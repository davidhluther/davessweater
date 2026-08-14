#!/usr/bin/env python3
"""
compare_traffic.py — grade yesterday's traffic forecast against the actuals.

Runs daily BEFORE forecast_traffic.py (grade yesterday, then predict today).
Reads yesterday's forecast + yesterday's actuals; per corridor-window it scores:

  ratio abs error : |predicted_ratio - observed_ratio|
  jammed Brier    : (jammed_prob - observed_jammed)^2, observed = actual < 0.55

Writes {private}/traffic/comparisons/{yesterday}.json and folds the results into
a running {private}/traffic/scores.json (overall, per corridor, split by condition:
event-day vs ordinary, and per weekday-class). scores.json guards against
double-counting via a graded_dates list, so a re-run is a no-op for the totals.

Skips gracefully (exit 0, writes nothing) when either input is missing — on
day one there is nothing to grade yet.

Fail-soft, stdlib only: always exits 0.
"""

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import traffic_model as tm
import traffic_paths as tp

BASE_DIR = Path(__file__).resolve().parent.parent
# The traffic dataset is private and lives outside this public repo — every
# layer of it derives from TomTom Results. See scripts/traffic_paths.py.
FORECAST_DIR = tp.traffic_subdir("forecast")
ACTUALS_DIR = tp.traffic_subdir("actuals")
COMPARISONS_DIR = tp.traffic_subdir("comparisons")
SCORES_PATH = tp.traffic_dir() / "scores.json"


def _load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def grade(forecast: dict, actual_day: dict, iso_date: str) -> dict | None:
    """Build the comparison for one date. Returns None if the forecast holds no
    target for the date (nothing to grade)."""
    target = (forecast.get("targets") or {}).get(iso_date)
    if not target:
        return None

    observed = tm.observed_window_ratios(actual_day)  # {corridor: {window: ratio}}
    corridor_blocks = target.get("corridors") or {}

    per_corridor = {}
    total = {"n": 0, "sum_abs_error": 0.0, "sum_brier": 0.0}

    for slug, block in corridor_blocks.items():
        obs_windows = observed.get(slug, {})
        window_rows = {}
        c_n, c_sa, c_sb = 0, 0.0, 0.0
        for label, pred in (block.get("windows") or {}).items():
            obs_ratio = obs_windows.get(label)
            if obs_ratio is None:
                continue  # no sample landed in this window — nothing to grade
            pred_ratio = pred.get("ratio")
            prob = pred.get("jammed_prob")
            if pred_ratio is None or prob is None:
                continue
            observed_jammed = obs_ratio < tm.JAM_THRESHOLD
            ae = tm.abs_error(pred_ratio, obs_ratio)
            br = tm.brier(prob, observed_jammed)
            window_rows[label] = {
                "predicted_ratio": pred_ratio,
                "observed_ratio": obs_ratio,
                "abs_error": ae,
                "jammed_prob": prob,
                "predicted_jammed": bool(pred.get("jammed")),
                "observed_jammed": observed_jammed,
                "brier": br,
            }
            c_n += 1
            c_sa += ae
            c_sb += br
        if c_n:
            per_corridor[slug] = {
                "n": c_n,
                "ratio_mae": round(c_sa / c_n, 4),
                "brier": round(c_sb / c_n, 4),
                "windows": window_rows,
            }
            total["n"] += c_n
            total["sum_abs_error"] += c_sa
            total["sum_brier"] += c_sb

    n = total["n"]
    return {
        "date": iso_date,
        "graded_at": datetime.now(tm.NY).isoformat(),
        "weekday_class": target.get("weekday_class"),
        "event_day": bool(target.get("event_day")),
        "n_pairs": n,
        "overall": {
            "ratio_mae": round(total["sum_abs_error"] / n, 4) if n else None,
            "brier": round(total["sum_brier"] / n, 4) if n else None,
        },
        "corridors": per_corridor,
    }


def _empty_scores() -> dict:
    return {
        "updated_at": None,
        "graded_dates": [],
        "overall": tm.new_bucket(),
        "by_corridor": {},
        "by_condition": {"event_day": tm.new_bucket(), "ordinary": tm.new_bucket()},
        "by_weekday_class": {wc: tm.new_bucket() for wc in tm.WEEKDAY_CLASSES},
    }


def update_scores(scores: dict, comparison: dict) -> dict:
    """Fold a date's graded pairs into the running scores. Idempotent: a date
    already in graded_dates is skipped (no double counting)."""
    scores = scores or _empty_scores()
    iso_date = comparison["date"]
    if iso_date in scores.get("graded_dates", []):
        return scores  # already counted

    condition = "event_day" if comparison["event_day"] else "ordinary"
    wclass = comparison.get("weekday_class")

    for slug, cblock in comparison["corridors"].items():
        by_corr = scores["by_corridor"].setdefault(slug, tm.new_bucket())
        for row in cblock["windows"].values():
            ae, br = row["abs_error"], row["brier"]
            scores["overall"] = tm.add_to_bucket(scores["overall"], ae, br)
            scores["by_corridor"][slug] = tm.add_to_bucket(by_corr, ae, br)
            by_corr = scores["by_corridor"][slug]
            scores["by_condition"][condition] = tm.add_to_bucket(
                scores["by_condition"][condition], ae, br)
            if wclass in scores["by_weekday_class"]:
                scores["by_weekday_class"][wclass] = tm.add_to_bucket(
                    scores["by_weekday_class"][wclass], ae, br)

    scores["graded_dates"] = sorted(set(scores.get("graded_dates", []) + [iso_date]))
    scores["updated_at"] = datetime.now(tm.NY).isoformat()
    return scores


def main() -> int:
    ap = argparse.ArgumentParser(description="Grade yesterday's traffic forecast.")
    ap.add_argument("--date", help="Grade this date (YYYY-MM-DD); default = yesterday in NY.")
    args = ap.parse_args()

    if args.date:
        target_date = date.fromisoformat(args.date)
    else:
        target_date = datetime.now(tm.NY).date() - timedelta(days=1)
    iso = target_date.isoformat()

    forecast = _load_json(FORECAST_DIR / f"{iso}.json")
    actual_day = _load_json(ACTUALS_DIR / f"{iso}.json")
    if not forecast or not actual_day:
        missing = ", ".join(x for x, ok in (("forecast", forecast), ("actuals", actual_day)) if not ok)
        print(f"Nothing to grade for {iso} (missing: {missing}); exit 0.")
        return 0

    comparison = grade(forecast, actual_day, iso)
    if not comparison or comparison["n_pairs"] == 0:
        print(f"No overlapping corridor-windows to grade for {iso}; exit 0.")
        return 0

    COMPARISONS_DIR.mkdir(parents=True, exist_ok=True)
    (COMPARISONS_DIR / f"{iso}.json").write_text(json.dumps(comparison, indent=2) + "\n")

    scores = update_scores(_load_json(SCORES_PATH), comparison)
    SCORES_PATH.write_text(json.dumps(scores, indent=2) + "\n")

    ov = comparison["overall"]
    print(f"Graded {iso}: {comparison['n_pairs']} pairs, "
          f"ratio MAE {ov['ratio_mae']}, Brier {ov['brier']} "
          f"({'event day' if comparison['event_day'] else 'ordinary'}, "
          f"{comparison['weekday_class']}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
