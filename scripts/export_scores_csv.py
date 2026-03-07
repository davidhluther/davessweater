#!/usr/bin/env python3
"""
export_scores_csv.py — Export Right Ray / Wrong Ray scoring data as CSV.

Reads all comparison JSON files and produces a flat CSV with one row per
source per date, suitable for spreadsheet import.

Output: data/scores_export.csv
"""

import csv
import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
COMP_DIR = DATA_DIR / "comparisons"
OUTPUT = DATA_DIR / "scores_export.csv"

FIELDS = [
    "date",
    "source",
    # Actuals
    "actual_high_f",
    "actual_low_f",
    "actual_wind_mph",
    "actual_precip_in",
    "actual_conditions",
    # Predictions
    "predicted_high_f",
    "predicted_low_f",
    "predicted_wind_mph",
    "predicted_precip_in",
    "predicted_conditions",
    # Scoring
    "score_total",
    "verdict",
    "ray_count",
    "pts_high_temp",
    "pts_low_temp",
    "pts_wind",
    "pts_precipitation",
    "err_high_f",
    "err_low_f",
    "err_wind_mph",
    "err_precip_in",
    # Sweater weather
    "sweater_answer",
    "sweater_layers",
]


def _get_high(d):
    return d.get("today_high_f", d.get("high_f"))


def _get_low(d):
    return d.get("tonight_low_f", d.get("today_low_f", d.get("low_f")))


def export():
    if not COMP_DIR.exists():
        print(f"No comparisons directory found at {COMP_DIR}")
        sys.exit(1)

    rows = []
    for comp_file in sorted(COMP_DIR.glob("*.json")):
        try:
            with open(comp_file) as f:
                comp = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {comp_file.name}: {e}")
            continue

        date = comp.get("date", comp_file.stem)
        actuals = comp.get("actuals", {})
        sweater = comp.get("sweater_weather", {})

        for source_name, source_data in comp.get("sources", {}).items():
            if "score" not in source_data:
                continue

            pred = source_data.get("prediction", {})
            score = source_data["score"]
            breakdown = score.get("breakdown", {})

            row = {
                "date": date,
                "source": source_name,
                # Actuals
                "actual_high_f": actuals.get("high_f"),
                "actual_low_f": actuals.get("low_f"),
                "actual_wind_mph": actuals.get("wind_mph"),
                "actual_precip_in": actuals.get("precip_in"),
                "actual_conditions": actuals.get("conditions"),
                # Predictions
                "predicted_high_f": _get_high(pred),
                "predicted_low_f": _get_low(pred),
                "predicted_wind_mph": pred.get("wind_mph"),
                "predicted_precip_in": pred.get("precip_in"),
                "predicted_conditions": pred.get("conditions", pred.get("daytime_desc", "")),
                # Scoring
                "score_total": score.get("score"),
                "verdict": score.get("grade", {}).get("verdict"),
                "ray_count": score.get("grade", {}).get("ray_count"),
                "pts_high_temp": breakdown.get("high_temp", {}).get("points"),
                "pts_low_temp": breakdown.get("low_temp", {}).get("points"),
                "pts_wind": breakdown.get("wind", {}).get("points"),
                "pts_precipitation": breakdown.get("precipitation", {}).get("points"),
                "err_high_f": breakdown.get("high_temp", {}).get("error_f"),
                "err_low_f": breakdown.get("low_temp", {}).get("error_f"),
                "err_wind_mph": breakdown.get("wind", {}).get("error_mph"),
                "err_precip_in": breakdown.get("precipitation", {}).get("error_in"),
                # Sweater
                "sweater_answer": sweater.get("answer"),
                "sweater_layers": sweater.get("layers"),
            }
            rows.append(row)

    if not rows:
        print("No scored comparisons found.")
        sys.exit(1)

    with open(OUTPUT, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} rows to {OUTPUT}")


if __name__ == "__main__":
    export()
