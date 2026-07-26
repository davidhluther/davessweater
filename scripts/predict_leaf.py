#!/usr/bin/env python3
"""
predict_leaf.py — per-town fall peak-color forecast (leaf model v0-draft).

Runs on demand (NOT wired into the GitHub Actions yet — the model is validating
during its first live fall). For each of the 18 tracked places it emits a
predicted peak-color window (start / center / end) for the target fall, plus the
`basis` provenance that produced it, to data/leaf/predictions.json.

The pure model lives in leaf_model.py; this file is the I/O shell: it loads the
town registry (+ Boone), pulls Open-Meteo archive temperatures per coordinate to
compute an early-fall thermal anomaly, caches those pulls under data/leaf/inputs/
so reruns don't refetch, and writes the prediction file.

Fail-soft, stdlib only: a town with no thermal signal degrades to pure
elevation climatology (basis says so); network errors leave the cache untouched.

Usage:
    python3 scripts/predict_leaf.py                 # predict target fall (default: this year)
    python3 scripts/predict_leaf.py --year 2026
    python3 scripts/predict_leaf.py --refresh       # force re-fetch archive temps
    python3 scripts/predict_leaf.py --hindcast      # grade 2024/2025 vs documented ground truth
"""

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
import leaf_model as lm

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
LOCATIONS_PATH = BASE_DIR / "data" / "locations" / "locations.json"
OUT_PATH = BASE_DIR / "data" / "leaf" / "predictions.json"
INPUTS_DIR = BASE_DIR / "data" / "leaf" / "inputs"
REGISTRY_PATH = BASE_DIR / "data" / "events" / "registry.json"

# Boone is not in the multi-location registry (legacy top-level paths, homepage).
# Elevation 3,333 ft is the town's published/USGS figure; coords from CLAUDE.md.
BOONE = {
    "slug": "boone",
    "name": "Boone",
    "lat": 36.2168,
    "lon": -81.6746,
    "elevation_ft": 3333,
    "county": "Watauga",
    "provenance": "CLAUDE.md reference coords; elevation 3,333 ft (town's published figure)",
}

# ── thermal-anomaly window ───────────────────────────────────────────────────
# Senescence responds mostly to early-autumn coolness. We compare each town's
# Sep 1–25 mean daily temperature this year against its own multi-year normal.
EARLY_FALL_START = (9, 1)
EARLY_FALL_END = (9, 25)
CLIMATOLOGY_YEARS = 6          # prior years averaged into the "normal"
MIN_DAYS_FOR_ANOMALY = 12      # need this many captured Sep days to trust a signal
ARCHIVE_LAG_DAYS = 6           # Open-Meteo archive trails ~5 days; pad to be safe

ARCHIVE_URL = (
    "https://archive-api.open-meteo.com/v1/archive?"
    "latitude={lat}&longitude={lon}"
    "&start_date={start}&end_date={end}"
    "&daily=temperature_2m_max,temperature_2m_min"
    "&temperature_unit=fahrenheit&timezone=America/New_York"
)

# ── hindcast ground truth (documented, human-judged — NOT exact dated peaks) ──
# The public NC-mountains fall-color reports (Grandfather Mountain dated
# galleries, RomanticAsheville, High Country Host) describe peak by elevation
# BAND, the same language in both 2024 and 2025 — they do not publish a
# year-specific calendar peak date. So these are observed *bands*, and the
# hindcast validates the elevation gradient's SHAPE, not interannual skill.
# Valley peaks ("late October and beyond") are too vague to grade and are
# recorded as ungraded rather than invented.
HINDCAST_TRUTH = {
    "high-5000": {
        "elevation_ft": 5000,
        "observed": {"start": "10-01", "end": "10-07"},
        "source": "Grandfather Mountain: 5,000 ft+ turns 'the first week of October'",
    },
    "mid-4250": {
        "elevation_ft": 4250,
        "observed": {"start": "10-07", "end": "10-13"},
        "source": "Blue Ridge Parkway near Grandfather: peak drops to the 4,000–4,500 ft level ~Oct 10",
    },
    "boone-3333": {
        "elevation_ft": 3333,
        "observed": {"start": "10-15", "end": "10-25"},
        "source": "Boone-elevation reports: 'mid-to-late October' (WataugaOnline / High Country Host)",
    },
}
HINDCAST_UNGRADED = {
    "valley-1000": "Valley peaks documented only as 'late October and beyond' — too vague to grade.",
}
HINDCAST_YEARS = (2024, 2025)


def _load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def load_places() -> list[dict]:
    """The 18 tracked places: Boone + the 17 registry towns."""
    reg = _load_json(LOCATIONS_PATH) or {}
    towns = reg.get("locations", [])
    return [BOONE] + towns


def fetch_archive(lat: float, lon: float, start: date, end: date):
    """Daily tmax/tmin (°F) for a coordinate over [start, end]. Returns a
    {date: {tmax, tmin}} dict, or None on any network/parse failure (fail-soft)."""
    url = ARCHIVE_URL.format(lat=lat, lon=lon, start=start.isoformat(), end=end.isoformat())
    req = Request(url, headers={"User-Agent": "DavesSweater/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read().decode())
    except (URLError, ValueError, OSError) as e:
        print(f"  archive fetch failed ({lat},{lon}): {e}")
        return None
    daily = raw.get("daily", {})
    times = daily.get("time", [])
    tmax = daily.get("temperature_2m_max", [])
    tmin = daily.get("temperature_2m_min", [])
    out = {}
    for i, d in enumerate(times):
        hi = tmax[i] if i < len(tmax) else None
        lo = tmin[i] if i < len(tmin) else None
        out[d] = {"tmax": hi, "tmin": lo}
    return out


def cache_path(slug: str) -> Path:
    return INPUTS_DIR / f"{slug}.json"


def load_or_fetch_series(place: dict, need_start: date, need_end: date,
                         refresh: bool = False) -> dict:
    """Return the town's cached daily temp series, extending the cache from the
    Open-Meteo archive only when it doesn't already cover [need_start, need_end].
    Cache file: data/leaf/inputs/{slug}.json."""
    INPUTS_DIR.mkdir(parents=True, exist_ok=True)
    path = cache_path(place["slug"])
    cached = _load_json(path) if not refresh else None
    daily = (cached or {}).get("daily", {}) if isinstance(cached, dict) else {}

    have_start = cached.get("range", {}).get("start") if cached else None
    have_end = cached.get("range", {}).get("end") if cached else None
    covers = (have_start and have_end
              and have_start <= need_start.isoformat()
              and have_end >= need_end.isoformat())

    if covers and daily and not refresh:
        return daily

    fetched = fetch_archive(place["lat"], place["lon"], need_start, need_end)
    if fetched is None:
        return daily  # keep whatever we had; fail-soft
    daily.update(fetched)
    payload = {
        "slug": place["slug"],
        "lat": place["lat"],
        "lon": place["lon"],
        "range": {"start": need_start.isoformat(), "end": need_end.isoformat()},
        "fetched_at": datetime.now(NY).isoformat(),
        "daily": daily,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return daily


def _early_fall_mean(daily: dict, year: int):
    """Mean of daily mean temp over Sep 1–25 of `year`. Returns (mean, n_days).
    n_days is how many days actually had data — the caller decides if it's enough."""
    start = date(year, *EARLY_FALL_START)
    end = date(year, *EARLY_FALL_END)
    vals = []
    d = start
    while d <= end:
        rec = daily.get(d.isoformat())
        if rec and rec.get("tmax") is not None and rec.get("tmin") is not None:
            vals.append((rec["tmax"] + rec["tmin"]) / 2.0)
        d += timedelta(days=1)
    if not vals:
        return None, 0
    return sum(vals) / len(vals), len(vals)


def compute_anomaly(daily: dict, year: int):
    """Early-fall temperature anomaly for `year`: this year's Sep-to-date mean
    minus the normal (mean of the prior CLIMATOLOGY_YEARS with data). Returns
    (anomaly_f | None, detail dict) — None when the current year lacks enough
    captured September days to trust a signal."""
    normals = []
    for y in range(year - CLIMATOLOGY_YEARS, year):
        m, n = _early_fall_mean(daily, y)
        if m is not None and n >= MIN_DAYS_FOR_ANOMALY:
            normals.append(m)
    if not normals:
        return None, {"reason": "no climatological normal available"}
    normal = sum(normals) / len(normals)

    cur_mean, cur_n = _early_fall_mean(daily, year)
    if cur_mean is None or cur_n < MIN_DAYS_FOR_ANOMALY:
        return None, {
            "reason": f"insufficient {year} September data ({cur_n} days)",
            "normal_f": round(normal, 2),
            "normal_years": len(normals),
        }
    return round(cur_mean - normal, 2), {
        "normal_f": round(normal, 2),
        "normal_years": len(normals),
        "current_mean_f": round(cur_mean, 2),
        "current_days": cur_n,
    }


def build_prediction(place: dict, year: int, refresh: bool) -> dict:
    """Predict one town's peak window and record its full basis provenance."""
    # We want prior years for the normal + this year's Sep-to-date if it exists.
    need_start = date(year - CLIMATOLOGY_YEARS, *EARLY_FALL_START)
    today = datetime.now(NY).date()
    want_end = date(year, *EARLY_FALL_END)
    need_end = min(want_end, today - timedelta(days=ARCHIVE_LAG_DAYS))
    if need_end < need_start:
        need_end = need_start

    daily = load_or_fetch_series(place, need_start, need_end, refresh=refresh)
    anomaly, detail = compute_anomaly(daily, year)

    pred = lm.predict_window(place["elevation_ft"], year, temp_anomaly_f=anomaly)

    if anomaly is None:
        basis = ("elevation-climatology (photoperiod anchor + elevation lapse); "
                 "no thermal signal yet — " + detail.get("reason", ""))
    else:
        warmer = "warmer→later" if anomaly > 0 else "cooler→earlier"
        basis = (f"elevation-climatology + thermal anomaly {anomaly:+.1f}°F "
                 f"vs {detail['normal_years']}-yr normal ({warmer})")

    return {
        "slug": place["slug"],
        "name": place["name"],
        "elevation_ft": place["elevation_ft"],
        "county": place.get("county"),
        **pred,
        "thermal": detail,
        "basis": basis,
    }


def predict(year: int, refresh: bool) -> dict:
    places = load_places()
    predictions = [build_prediction(p, year, refresh) for p in places]
    # Sort earliest-peak first — a readable, sanity-checkable ordering.
    predictions.sort(key=lambda p: p["peak_center"])
    return {
        "model_version": lm.MODEL_VERSION,
        "generated_at": datetime.now(NY).isoformat(),
        "target_year": year,
        "place_count": len(predictions),
        "method": ("peak = Oct-6 photoperiod anchor at 5,000 ft "
                   f"+ {lm.DAYS_PER_1000FT} days/1,000 ft elevation lapse "
                   "+ bounded early-fall thermal anomaly; window ±"
                   f"{lm.HALF_WINDOW_DAYS} days. See docs/leaf-model.md."),
        "grading": ("Scored once observed peaks arrive: abs/signed day error, "
                    "window-hit bool, 0–100 (full within "
                    f"{lm.GRADE_TOL_DAYS} days, −{lm.GRADE_PENALTY_PER_DAY}/day beyond)."),
        "predictions": predictions,
    }


def hindcast(refresh: bool) -> dict:
    """Grade the model against documented elevation-band peaks for 2024/2025.

    Ground truth is human-judged bands (not exact dates), identical across years
    in the sources — so this checks the elevation gradient's shape, not
    interannual skill. Valley peaks are recorded ungraded (too vague)."""
    # A synthetic 'place' per band so we can reuse the archive/anomaly machinery
    # against Grandfather's coordinate for the thermal term.
    grandfather = {"slug": "_hindcast-grandfather", "lat": 36.0956, "lon": -81.8309}
    results = {"model_version": lm.MODEL_VERSION, "years": {}, "ungraded": HINDCAST_UNGRADED}
    for year in HINDCAST_YEARS:
        need_start = date(year - CLIMATOLOGY_YEARS, *EARLY_FALL_START)
        need_end = date(year, *EARLY_FALL_END)
        daily = load_or_fetch_series(grandfather, need_start, need_end, refresh=refresh)
        anomaly, detail = compute_anomaly(daily, year)
        band_rows = []
        for band, truth in HINDCAST_TRUTH.items():
            pred = lm.predict_window(truth["elevation_ft"], year, temp_anomaly_f=anomaly)
            observed = {
                "start": f"{year}-{truth['observed']['start']}",
                "end": f"{year}-{truth['observed']['end']}",
            }
            score = lm.score_prediction(pred, observed)
            band_rows.append({
                "band": band,
                "elevation_ft": truth["elevation_ft"],
                "predicted": {k: pred[k] for k in ("peak_start", "peak_center", "peak_end")},
                "observed": observed,
                "source": truth["source"],
                **score,
            })
        results["years"][str(year)] = {
            "thermal_anomaly_f": anomaly,
            "thermal_detail": detail,
            "bands": band_rows,
        }
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description="Fall leaf-color forecast (v0-draft).")
    ap.add_argument("--year", type=int, default=datetime.now(NY).year,
                    help="target fall year (default: current year)")
    ap.add_argument("--refresh", action="store_true",
                    help="force re-fetch of archive temperatures")
    ap.add_argument("--hindcast", action="store_true",
                    help="grade 2024/2025 vs documented ground truth, print, and exit")
    args = ap.parse_args()

    if args.hindcast:
        out = hindcast(refresh=args.refresh)
        print(json.dumps(out, indent=2))
        return 0

    out = predict(args.year, refresh=args.refresh)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"[{out['generated_at']}] wrote {len(out['predictions'])} predictions "
          f"for fall {args.year} → {OUT_PATH.relative_to(BASE_DIR)}")
    for p in out["predictions"]:
        print(f"  {p['peak_center']}  {p['name']:<18} {p['elevation_ft']:>5} ft   {p['basis']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
