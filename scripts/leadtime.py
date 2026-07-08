#!/usr/bin/env python3
"""leadtime.py — score each source's forecast by lead time (0-5 days ahead).

For target date D and lead L, the forecast is the row for D found in the capture
folder predictions/{D-L}/. Reuses the exact daily-comparison scoring so lead 0 is
identical to the single-day comparison (guarded by tests/test_leadtime.py)."""
from __future__ import annotations
import json
from datetime import date, timedelta
from pathlib import Path

import compare  # reuse helpers + DATA_DIR
from scoring import score_prediction

DATA_DIR = compare.DATA_DIR
MAX_LEAD = 5
LOCATION = "Boone"

# Source key -> capture filename (Ray's uses the rebuilt sibling when present).
# Keys match compare.py's comparison["sources"] / sources.SOURCES. Apple
# ("apple_weather") is deliberately absent: its capture is a flat single-day
# dict (iphone_forecast[_apple].json) with no per-date daily array, so it has
# no lead > 0 rows and needs compare.py's special parsing even at lead 0.
SOURCE_FILES = {
    "openmeteo": "openmeteo_forecast.json",
    "nws": "nws_forecast.json",
    "metno": "metno_forecast.json",
    "openweathermap": "openweathermap_forecast.json",
    "tomorrowio": "tomorrowio_forecast.json",
    "visualcrossing": "visualcrossing_forecast.json",
    "weatherapi": "weatherapi_forecast.json",
    "googleweather": "googleweather_forecast.json",
}


def _load_json(path: Path):
    """Parse a capture file, tolerating corrupt/unreadable files like
    compare.py's source loop does (json.JSONDecodeError/OSError -> skip)."""
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def _rays_row(capture_dir: Path, target_date: str, lead: int):
    """Ray's prediction for target_date from this capture, or None.

    Lead 0 mirrors run_daily_comparison exactly: the merged strip+daily dict
    from _best_rays_prediction. At lead >= 1 the strip forecast
    (today_high_f/tonight_low_f) describes the CAPTURE day, not target_date,
    so only the daily[] row dated target_date counts — and there is no
    nearest-date fallback: a missing row means no forecast at this lead."""
    rebuilt = capture_dir / "rays_boone.rebuilt.json"
    path = rebuilt if rebuilt.exists() else capture_dir / "rays_boone.json"
    if not path.exists():
        return None
    data = _load_json(path)
    if not data:
        return None
    if lead == 0:
        pred = compare._best_rays_prediction(data, target_date)
    else:
        pred = next((d for d in (data.get("daily") or [])
                     if d.get("date") == target_date), None)
        # Drop the scraped precip_in: Ray never publishes a numeric amount
        # (_best_rays_prediction whitelists fields for the same reason —
        # compare.py:157), so the amount stays forfeited at every lead. Old
        # raw captures carry a 0.0 artifact that would otherwise score as an
        # explicit "no rain" forecast.
        pred = {k: v for k, v in pred.items() if k != "precip_in"} if pred else None
    # Mirror compare.py's guard: Ray's is only scored when a high or low
    # exists; otherwise the daily comparison records no score for the day.
    if pred is None or (compare._get_high(pred) is None
                        and compare._get_low(pred) is None):
        return None
    return pred


def _row_for(capture_dir: Path, source: str, target_date: str, lead: int):
    """Return the forecast dict for target_date from a source's capture, or None."""
    if source == "raysweather":
        return _rays_row(capture_dir, target_date, lead)
    fname = SOURCE_FILES.get(source)
    path = capture_dir / fname if fname else None
    if not path or not path.exists():
        return None
    data = _load_json(path)
    if not data:
        return None
    for day in data.get("daily", []):
        if day.get("date") == target_date:
            return day
    return None


def score_lead(target_date: str, source: str, lead: int, norm_actual: dict):
    """Score source's forecast for target_date made `lead` days earlier.

    Returns {score, grade, high_err, low_err, high_bias, low_bias} or None if
    no such capture/row exists."""
    capture_day = (date.fromisoformat(target_date) - timedelta(days=lead)).isoformat()
    capture_dir = DATA_DIR / "predictions" / capture_day
    row = _row_for(capture_dir, source, target_date, lead)
    if not row:
        return None

    # The capture-day-low recovery only applies at lead 0 (the midday-capture
    # problem); at lead >= 1 the row already spans the full day — and the fix
    # always reads predictions/{D-1}, which would overwrite a lead-L low with
    # the lead-1 low. Mirror compare.py by applying it only when lead == 0
    # (a no-op for non-bucket sources, same as the daily run).
    day = dict(row)
    if lead == 0:
        day = compare._fix_bucket_low(source, target_date, day)

    result = score_prediction(compare._to_contract(day), norm_actual)
    ph, pl = compare._get_high(day), compare._get_low(day)
    ah, al = norm_actual.get("high_f"), norm_actual.get("low_f")
    return {
        "score": result["score"],
        "grade": result["grade"],
        "high_err": abs(ph - ah) if ph is not None and ah is not None else None,
        "low_err": abs(pl - al) if pl is not None and al is not None else None,
        "high_bias": (ph - ah) if ph is not None and ah is not None else None,
        "low_bias": (pl - al) if pl is not None and al is not None else None,
    }


def _norm_actual_for(target_date: str):
    """Normalized actuals for target_date from data/actuals, or None.

    Same load + _normalize_actual path as compare.run_daily_comparison."""
    p = DATA_DIR / "actuals" / f"{target_date}.json"
    if not p.exists():
        return None
    data = _load_json(p)
    return compare._normalize_actual(data) if data else None


def _leadtime_dir() -> Path:
    """Per-date lead-time results directory. Factored out so tests can
    redirect writes (and the rollup's reads) without touching the DATA_DIR
    that predictions/actuals are read from."""
    return DATA_DIR / "leadtime"


def build_leadtime(target_date: str):
    """Score every source x lead for target_date -> data/leadtime/{date}.json."""
    norm_actual = _norm_actual_for(target_date)
    if norm_actual is None:
        return None
    rows = []
    # Iterate the mapping's keys (not free-typed strings): score_lead returns
    # None for unknown sources, so a typo would silently drop a source.
    for source in list(SOURCE_FILES) + ["raysweather"]:
        for lead in range(MAX_LEAD + 1):
            r = score_lead(target_date, source, lead, norm_actual)
            if r:
                rows.append({"source": source, "lead": lead, **r})
    out = {"date": target_date, "location": LOCATION, "rows": rows}
    d = _leadtime_dir()
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{target_date}.json").write_text(json.dumps(out, indent=2))
    return out


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(sum(xs) / len(xs), 2) if xs else None


def _aggregate_rows(rows):
    """rows -> {source: {lead(str): {n, avg_score, high_mae, low_mae, high_bias, low_bias}}}.

    Cell keys and the str(lead) keying are a contract with the site's
    LeadCell/LeadtimeScores TypeScript types — do not rename."""
    agg = {}
    keyed = {}
    for r in rows:
        keyed.setdefault((r["source"], r["lead"]), []).append(r)
    for (source, lead), group in keyed.items():
        cell = {
            "n": len(group),
            "avg_score": _mean([g["score"] for g in group]),
            "high_mae": _mean([g["high_err"] for g in group]),
            "low_mae": _mean([g["low_err"] for g in group]),
            "high_bias": _mean([g["high_bias"] for g in group]),
            "low_bias": _mean([g["low_bias"] for g in group]),
        }
        agg.setdefault(source, {})[str(lead)] = cell
    return agg


def build_leadtime_scores():
    """Roll up all data/leadtime/*.json -> data/leadtime_scores.json."""
    all_rows = []
    for f in sorted(_leadtime_dir().glob("*.json")):
        data = _load_json(f)
        if data:
            all_rows += data.get("rows", [])
    out = {"location": LOCATION, "max_lead": MAX_LEAD, "by_source": _aggregate_rows(all_rows)}
    (DATA_DIR / "leadtime_scores.json").write_text(json.dumps(out, indent=2))
    return out
