"""Score every registry location's captured forecasts against its own actuals
(M5 P0 — silent accrual; nothing renders until the site phase).

Per town: sweeps the last SWEEP_DAYS days for any prediction dir without a
comparison, fetches Open-Meteo archive actuals at the town's own coordinates
(skipping days the archive hasn't posted yet — the same 1-5 day lag rule as
Boone), scores every source through the identical compare/scoring path
(_to_contract + score_prediction, bucket-low recovery, DSI composite), and
rebuilds data/locations/{slug}/scores.json from all of that town's
comparisons. Idempotent; Boone's pipeline is untouched.
"""
import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

import compare  # _to_contract / _normalize_actual / composite / bucket-low set
from capture_openmeteo import WMO_CODES, weather_category
from locations import load_locations, location_dir
from scoring import score_prediction

EST = ZoneInfo("America/New_York")
SWEEP_DAYS = 14
COV_FIELDS = ["high_temp", "low_temp", "wind", "precip_type", "precip_amount"]


def archive_url(lat, lon, date):
    return (
        "https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}"
        f"&start_date={date}&end_date={date}"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,"
        "weather_code,wind_speed_10m_max,wind_gusts_10m_max"
        "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
        "&timezone=America/New_York"
    )


def fetch_actuals(loc, date):
    """Archive actuals at the town's coords, normalized exactly like Boone's.
    Returns None while the archive still lags (high/low missing)."""
    req = Request(archive_url(loc["lat"], loc["lon"], date),
                  headers={"User-Agent": "DavesSweater/1.0"})
    try:
        with urlopen(req, timeout=20) as r:
            raw = json.loads(r.read().decode())
    except (URLError, json.JSONDecodeError, TimeoutError):
        return None
    daily = raw.get("daily", {})
    if not daily.get("time"):
        return None
    high = daily.get("temperature_2m_max", [None])[0]
    low = daily.get("temperature_2m_min", [None])[0]
    if high is None or low is None:
        return None  # archive row exists but is still a stub
    code = daily.get("weather_code", [0])[0]
    rain_in = round(daily.get("precipitation_sum", [0])[0] or 0, 3)
    snow_in = round((daily.get("snowfall_sum", [0])[0] or 0) / 2.54, 3)
    ptype = ("mixed" if rain_in > 0.005 and snow_in > 0.05
             else "snow" if snow_in > 0.05
             else "rain" if rain_in > 0.005 else "none")
    return {
        "date": date, "fetched_at": datetime.now(EST).isoformat(),
        "location": loc["name"], "location_slug": loc["slug"],
        "high_f": high, "low_f": low,
        "wind_mph": daily.get("wind_speed_10m_max", [None])[0],
        "gust_mph": daily.get("wind_gusts_10m_max", [None])[0],
        "precip_type": ptype, "rain_in": rain_in, "snow_in": snow_in,
        "precip_in": round(rain_in + snow_in, 3),
        "weather_code": code, "conditions": WMO_CODES.get(code, "Unknown"),
        "category": weather_category(code),
    }


def _day_ahead_low(loc_dir, key, date):
    """Location-scoped twin of compare._day_ahead_low (same recovery rule)."""
    prev = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    fpath = loc_dir / "predictions" / prev / f"{key}_forecast.json"
    if not fpath.exists():
        return None
    try:
        data = json.load(open(fpath))
    except (json.JSONDecodeError, OSError):
        return None
    for row in data.get("daily", []):
        if row.get("date") == date:
            return row.get("low_f")
    return None


def _fix_bucket_low(loc_dir, key, date, day):
    if key not in compare._BUCKET_LOW_SOURCES:
        return day
    recovered = _day_ahead_low(loc_dir, key, date)
    if recovered is not None:
        day["low_f"] = recovered
    else:
        day["low_f"] = None
        fp = day.get("fields_provided")
        if isinstance(fp, list):
            day["fields_provided"] = [f for f in fp if f != "low"]
    return day


def score_location_date(loc, date, actuals, base=None):
    """Score one town-day from its stored predictions. Writes the comparison
    file (unless no source scored — the no-ghosts rule) and returns it."""
    loc_dir = location_dir(loc["slug"]) if base is None else Path(base) / loc["slug"]
    pred_dir = loc_dir / "predictions" / date
    if not pred_dir.exists():
        return None
    norm = compare._normalize_actual(actuals)
    comparison = {"date": date, "location": loc["name"], "location_slug": loc["slug"],
                  "actuals": actuals, "sources": {}}
    for fpath in sorted(pred_dir.glob("*_forecast.json")):
        key = fpath.name[: -len("_forecast.json")]
        try:
            data = json.load(open(fpath))
        except (json.JSONDecodeError, OSError):
            continue
        day = next((r for r in data.get("daily", []) if r.get("date") == date), None)
        if day is None:
            continue
        day = _fix_bucket_low(loc_dir, key, date, dict(day))
        result = score_prediction(compare._to_contract(day), norm)
        comparison["sources"][key] = {"prediction": day, "score": result}
    if not comparison["sources"]:
        return None  # never write an empty-sources ghost
    try:
        compare.add_composite_source(comparison)
    except Exception as e:  # noqa: BLE001 — composite is derived, never blocks the day
        print(f"  WARN {loc['slug']}/{date}: composite failed: {e}")
    comp_dir = loc_dir / "comparisons"
    comp_dir.mkdir(parents=True, exist_ok=True)
    (comp_dir / f"{date}.json").write_text(json.dumps(comparison, indent=2))
    (loc_dir / "actuals").mkdir(parents=True, exist_ok=True)
    (loc_dir / "actuals" / f"{date}.json").write_text(json.dumps(actuals, indent=2))
    return comparison


def rebuild_scores(loc, base=None):
    """Rebuild the town's scores.json from ALL its comparisons (same shape as
    the Boone scores.json: entries + totals + coverage; no sweater field)."""
    loc_dir = location_dir(loc["slug"]) if base is None else Path(base) / loc["slug"]
    entries, totals, coverage = [], {}, {}
    for comp_file in sorted((loc_dir / "comparisons").glob("*.json")):
        try:
            comp = json.load(open(comp_file))
        except (json.JSONDecodeError, OSError):
            continue
        entry = {"date": comp.get("date") or comp_file.stem}
        for source, data in comp.get("sources", {}).items():
            if "score" not in data:
                continue
            entry[source] = data["score"]["score"]
            t = totals.setdefault(source, {"right": 0, "wrong": 0, "meh": 0,
                                           "total_score": 0, "days": 0})
            t[data["score"]["grade"]["verdict"]] += 1
            t["total_score"] += data["score"]["score"]
            t["days"] += 1
            cov = data["score"].get("coverage", {})
            c = coverage.setdefault(source, {f: {"provided": 0, "days": 0} for f in COV_FIELDS})
            for fld in COV_FIELDS:
                c[fld]["days"] += 1
                if cov.get(fld):
                    c[fld]["provided"] += 1
        entries.append(entry)
    scores = {"location": loc["name"], "location_slug": loc["slug"],
              "entries": entries, "totals": totals, "coverage": coverage}
    (loc_dir / "scores.json").write_text(json.dumps(scores, indent=2))
    return scores


def sweep_location(loc, dates=None):
    """Score every captured-but-unscored day in the window (archive-lag safe)."""
    loc_dir = location_dir(loc["slug"])
    if dates is None:
        today = datetime.now(EST).date()
        dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d")
                 for i in range(1, SWEEP_DAYS + 1)]
    scored = 0
    for date in dates:
        if not (loc_dir / "predictions" / date).exists():
            continue
        if (loc_dir / "comparisons" / f"{date}.json").exists():
            continue
        actuals = fetch_actuals(loc, date)
        if actuals is None:
            print(f"  LAG  {loc['slug']}/{date}: actuals not posted yet (benign)")
            continue
        comp = score_location_date(loc, date, actuals)
        if comp:
            scored += 1
            summary = ", ".join(f"{k} {v['score']['score']}" for k, v in sorted(comp["sources"].items()))
            print(f"  OK   {loc['slug']}/{date}: {summary}")
    if scored:
        rebuild_scores(loc)
    return scored


def main():
    ap = argparse.ArgumentParser(description="Score location forecasts (M5)")
    ap.add_argument("--location", help="single town slug (default: all)")
    ap.add_argument("--date", help="single date YYYY-MM-DD (default: 14-day sweep)")
    args = ap.parse_args()
    locs = load_locations()
    if args.location:
        locs = [l for l in locs if l["slug"] == args.location]
        if not locs:
            sys.exit(f"unknown location {args.location!r}")
    for loc in locs:
        sweep_location(loc, dates=[args.date] if args.date else None)


if __name__ == "__main__":
    main()
