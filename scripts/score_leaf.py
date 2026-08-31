#!/usr/bin/env python3
"""
score_leaf.py — grade the published peak-color windows against what actually
happened.

Reads the predictions the model wrote (data/leaf/predictions.json) and the
observations recorded by hand from the fall-color grading sources
(data/leaf/observations.json), scores every town we have an observation for,
and writes data/leaf/scores.json.

The scoring rules live in leaf_model.score_prediction and were fixed in July,
before a single 2026 observation existed — full credit within 3 days of the
observed peak, then -6 points per day, on the site's own Right / Meh / Wrong
bands. Nothing here re-tunes them. This script only joins the two files.

An observation names either one town (`slug`) or an elevation band
(`applies_to_elevation_ft`), because the published reports describe the season
by band rather than town by town. A band observation scores every tracked town
inside it, and each score records which observation produced it.

The summary's mean SIGNED error is the number worth watching across seasons: it
says whether the model runs systematically early or late, which is the only
honest basis for changing a constant later. Mean absolute error says how far off
we were; signed error says which way, and which way is what calibration needs.

Stdlib only. Exits 0 with an empty scoreboard when no observations exist yet,
which is the correct state for most of the year.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from leaf_model import score_prediction  # noqa: E402

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
LEAF_DIR = BASE_DIR / "data" / "leaf"
PREDICTIONS_PATH = LEAF_DIR / "predictions.json"
OBSERVATIONS_PATH = LEAF_DIR / "observations.json"
OUT_PATH = LEAF_DIR / "scores.json"


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def observation_covers(observation: dict, prediction: dict) -> bool:
    """Does this observation apply to this town — by name, or by elevation band."""
    slug = observation.get("slug")
    if slug:
        return slug == prediction.get("slug")
    band = observation.get("applies_to_elevation_ft")
    if not band:
        return False
    elevation = prediction.get("elevation_ft")
    if elevation is None:
        return False
    low = band.get("min")
    high = band.get("max")
    if low is not None and elevation < low:
        return False
    if high is not None and elevation > high:
        return False
    return True


def score_all(predictions: dict, observations: dict) -> list[dict]:
    """One scored row per (town, observation) pair we can actually match.

    A town observed by two sources is scored twice, deliberately: the sources
    disagree sometimes, and averaging them away before scoring would hide the
    disagreement inside a single number.
    """
    rows = []
    for observation in observations.get("observations") or []:
        observed = observation.get("observed")
        if not observed:
            continue
        for prediction in predictions.get("predictions") or []:
            if not observation_covers(observation, prediction):
                continue
            result = score_prediction(prediction, observed)
            rows.append({
                "slug": prediction["slug"],
                "name": prediction["name"],
                "elevation_ft": prediction["elevation_ft"],
                "predicted_start": prediction["peak_start"],
                "predicted_end": prediction["peak_end"],
                "observed": observed,
                "source_id": observation.get("source_id"),
                "observed_on": observation.get("observed_on"),
                **result,
            })
    rows.sort(key=lambda r: (-r["elevation_ft"], r["slug"]))
    return rows


def summarize(rows: list[dict]) -> dict:
    """Season totals. Empty in, empty out — no zero-row averages."""
    if not rows:
        return {
            "scored_rows": 0,
            "towns_scored": 0,
            "mean_score": None,
            "mean_abs_error_days": None,
            "mean_signed_error_days": None,
            "window_hit_rate": None,
        }
    n = len(rows)
    return {
        "scored_rows": n,
        "towns_scored": len({r["slug"] for r in rows}),
        "mean_score": round(sum(r["score"] for r in rows) / n, 1),
        "mean_abs_error_days": round(sum(r["abs_error_days"] for r in rows) / n, 2),
        "mean_signed_error_days": round(sum(r["signed_error_days"] for r in rows) / n, 2),
        "window_hit_rate": round(sum(1 for r in rows if r["window_hit"]) / n, 3),
    }


def build(predictions: dict, observations: dict, now: datetime) -> dict:
    rows = score_all(predictions, observations)
    return {
        "scored_at": now.isoformat(),
        "model_version": predictions.get("model_version"),
        "target_year": predictions.get("target_year"),
        "grading": predictions.get("grading"),
        "observations_updated": observations.get("updated"),
        "summary": summarize(rows),
        "scores": rows,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true", help="suppress the per-run summary line")
    args = ap.parse_args()

    predictions = load_json(PREDICTIONS_PATH)
    observations = load_json(OBSERVATIONS_PATH)
    if not predictions or not (predictions.get("predictions")):
        print(f"No predictions at {PREDICTIONS_PATH}; nothing to score.", file=sys.stderr)
        return 0
    if observations is None:
        print(f"No observations file at {OBSERVATIONS_PATH}; nothing to score.", file=sys.stderr)
        return 0

    out = build(predictions, observations, datetime.now(NY))
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    if not args.quiet:
        s = out["summary"]
        if s["scored_rows"]:
            print(f"Wrote {OUT_PATH}: {s['scored_rows']} scored row(s) across "
                  f"{s['towns_scored']} town(s); mean score {s['mean_score']}, "
                  f"mean signed error {s['mean_signed_error_days']} days.")
        else:
            print(f"Wrote {OUT_PATH}: no observations recorded yet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
