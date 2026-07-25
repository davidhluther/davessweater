#!/usr/bin/env python3
"""
forecast_traffic.py — daily corridor-congestion forecast (traffic model v0).

Runs once a day (with the first actuals sample). For TODAY and TOMORROW it
predicts each corridor's congestion ratio at each of the four sample windows
(~08:00 / 12:00 / 17:00 / 19:00 NY), plus a jammed probability, and writes
data/traffic/forecast/{today}.json.

    ratio_hat = baseline_cell x event_multiplier x weather_multiplier  (clamped)

The pure model lives in traffic_model.py; this file is the I/O shell. Every
prediction carries its baseline, both multipliers, and the fallback 'basis' so
a reader can see exactly how a cold-start number was reached.

Fail-soft, stdlib only: missing inputs degrade to fallbacks; always exits 0.
"""

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import traffic_model as tm

BASE_DIR = Path(__file__).resolve().parent.parent
ACTUALS_DIR = BASE_DIR / "data" / "traffic" / "actuals"
OUT_DIR = BASE_DIR / "data" / "traffic" / "forecast"
REGISTRY_PATH = BASE_DIR / "data" / "events" / "registry.json"
ATHLETICS_PATH = BASE_DIR / "data" / "events" / "athletics.json"
FORECAST_5DAY_PATH = BASE_DIR / "data" / "forecast_5day.json"
DEMAND_INDEX_DIR = BASE_DIR / "data" / "demand" / "index"

# Corridor slug → human name. Sourced from the actuals file's own corridor map
# when present (single source of truth); this is the fallback if none is loaded.
FALLBACK_CORRIDOR_NAMES = {
    "bypass-321": "US-321 Blowing Rock Rd (Boone bypass)",
    "king-st": "King St / US-421 downtown Boone",
    "nc105-split": "NC-105 at the US-321 split",
    "nc105-foscoe": "NC-105 South at Foscoe (ski approach)",
    "us321-blowing-rock": "US-321 Valley Blvd, Blowing Rock",
    "us421-deep-gap": "US-421 Doc & Merle Watson Hwy, Deep Gap",
}

MODEL_NOTE = ("v0 priors, corrected by grading — baseline x event x weather, "
              "clamped to (0.05, 1.0]. 'basis' names the baseline fallback level.")


def _load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def load_actual_days() -> list[dict]:
    """Every accumulated actuals day file (they seed the baseline cells)."""
    if not ACTUALS_DIR.is_dir():
        return []
    days = []
    for p in sorted(ACTUALS_DIR.glob("*.json")):
        d = _load_json(p)
        if d:
            days.append(d)
    return days


def corridor_names(actual_days: list[dict]) -> dict:
    """Prefer the corridor map carried in the newest actuals file."""
    for day in reversed(actual_days):
        names = day.get("corridors")
        if names:
            return names
    return dict(FALLBACK_CORRIDOR_NAMES)


def latest_demand_index() -> dict | None:
    if not DEMAND_INDEX_DIR.is_dir():
        return None
    dated = sorted(DEMAND_INDEX_DIR.glob("20*.json"))
    return _load_json(dated[-1]) if dated else None


def band_for_date(demand_index: dict | None, iso_date: str) -> tuple[str | None, int | None]:
    if not demand_index:
        return None, None
    for row in demand_index.get("horizon", []):
        if row.get("date") == iso_date:
            return row.get("band"), row.get("score")
    return None, None


def forecast_day_entry(forecast_5day: dict | None, iso_date: str) -> dict | None:
    if not forecast_5day:
        return None
    return next((d for d in forecast_5day.get("days", []) if d.get("date") == iso_date), None)


def build_target(iso_date: str, corridors: dict, baselines: dict,
                 registry, athletics, demand_index, forecast_5day) -> dict:
    """Per-corridor, per-window predictions for one target date."""
    d = date.fromisoformat(iso_date)
    wclass = tm.weekday_class(d)
    matched = tm.match_events(registry, athletics, iso_date)
    band, score = band_for_date(demand_index, iso_date)
    wmult, wreason = tm.weather_multiplier(forecast_day_entry(forecast_5day, iso_date))

    corridor_blocks = {}
    for slug in corridors:
        emult = tm.event_multiplier(slug, matched, band)
        windows = {}
        for hour in tm.WINDOWS:
            baseline, basis = tm.baseline_lookup(baselines, slug, wclass, hour)
            ratio = tm.predict_ratio(baseline, emult, wmult)
            pj = tm.jammed_probability(ratio)
            windows[tm.window_label(hour)] = {
                "ratio": ratio,
                "basis": basis,
                "baseline": round(baseline, 4),
                "event_multiplier": emult,
                "weather_multiplier": wmult,
                "jammed_prob": pj,
                "jammed": ratio < tm.JAM_THRESHOLD,
            }
        corridor_blocks[slug] = {"event_multiplier": emult, "windows": windows}

    return {
        "weekday_class": wclass,
        "event_day": bool(matched["ids"]),
        "events": matched["ids"],
        "event_labels": matched["labels"],
        "busyness": {"band": band, "score": score},
        "weather": {"multiplier": wmult, "reason": wreason},
        "corridors": corridor_blocks,
    }


def build_forecast(today: date, actual_days, registry, athletics,
                   demand_index, forecast_5day) -> dict:
    baselines = tm.accumulate_baselines(actual_days)
    corridors = corridor_names(actual_days)
    targets = {}
    for offset in (0, 1):  # today, tomorrow
        iso = (today + timedelta(days=offset)).isoformat()
        targets[iso] = build_target(iso, corridors, baselines, registry,
                                     athletics, demand_index, forecast_5day)
    n_cells = len(baselines["cell"])
    return {
        "generated_at": datetime.now(tm.NY).isoformat(),
        "model": "traffic-model-v0",
        "note": MODEL_NOTE,
        "windows": list(tm.WINDOW_LABELS),
        "corridors": corridors,
        "baseline_cells_observed": n_cells,
        "targets": targets,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Traffic congestion forecast (v0).")
    ap.add_argument("--date", help="Override 'today' (YYYY-MM-DD); default = now in NY.")
    args = ap.parse_args()

    today = date.fromisoformat(args.date) if args.date else datetime.now(tm.NY).date()

    actual_days = load_actual_days()
    registry = _load_json(REGISTRY_PATH)
    athletics = _load_json(ATHLETICS_PATH)
    demand_index = latest_demand_index()
    forecast_5day = _load_json(FORECAST_5DAY_PATH)

    out = build_forecast(today, actual_days, registry, athletics, demand_index, forecast_5day)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{today.isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")

    n_days = len(actual_days)
    cold = out["baseline_cells_observed"] == 0
    print(f"Wrote {out_path} — {len(out['targets'])} target dates x "
          f"{len(out['corridors'])} corridors x {len(tm.WINDOWS)} windows; "
          f"{n_days} actuals day(s) seed the baselines"
          f"{' (COLD START — all fallbacks)' if cold else ''}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
