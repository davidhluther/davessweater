#!/usr/bin/env python3
"""
predict_leaf.py — per-town fall peak-color forecast.

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

VERSIONS. The model has two parameter sets (see leaf_model.PARAMS): the frozen
July constants `leaf-v0-draft`, and the calibrated `leaf-v1` adopted at the
September 2026 refresh. Each version+pass writes its OWN file, and this script
REFUSES to overwrite an existing prediction file unless told to
(--allow-overwrite). data/leaf/predictions.json is the graded July v0 artifact;
regenerating it would destroy the thing being graded.

    version / pass          output file
    leaf-v0-draft           data/leaf/predictions.json          (frozen)
    leaf-v1 / provisional   data/leaf/predictions-v1-provisional.json
    leaf-v1 / final         data/leaf/predictions-v1.json

Usage:
    python3 scripts/predict_leaf.py                              # v1, pass chosen by the calendar
    python3 scripts/predict_leaf.py --model-version leaf-v0-draft
    python3 scripts/predict_leaf.py --pass provisional --year 2026
    python3 scripts/predict_leaf.py --refresh       # force re-fetch archive temps
    python3 scripts/predict_leaf.py --hindcast      # grade 2024/2025 vs documented ground truth
"""

import argparse
import json
import sys
import time
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
LEAF_DIR = BASE_DIR / "data" / "leaf"
OUT_PATH = LEAF_DIR / "predictions.json"          # the frozen v0 artifact
OUT_PATHS = {
    ("leaf-v0-draft", None): LEAF_DIR / "predictions.json",
    ("leaf-v1", "provisional"): LEAF_DIR / "predictions-v1-provisional.json",
    ("leaf-v1", "final"): LEAF_DIR / "predictions-v1.json",
}
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
# September mean daily temperature this year against its own normal. WHICH days
# and WHICH normal are per-version (leaf_model.PARAMS): v0 uses Sep 1–25 against
# a 6-year rolling normal; v1 uses the calendar month (or Sep 1–25 on its
# provisional pass) against a fixed 2008–2025 normal.
EARLY_FALL_START = (9, 1)      # v0's window, kept as module constants for reference
EARLY_FALL_END = (9, 25)
CLIMATOLOGY_YEARS = 6          # v0's rolling normal
MIN_DAYS_FOR_ANOMALY = 12      # need this many captured Sep days to trust a signal
ARCHIVE_LAG_DAYS = 6           # Open-Meteo archive trails ~5 days; pad to be safe
FETCH_ATTEMPTS = 4             # archive retries before a town degrades to climatology
FETCH_BACKOFF_SECONDS = 15
FETCH_PAUSE_SECONDS = 2        # politeness gap between town fetches

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
    # v1 asks for 18 years per town across 18 towns, which is enough volume for
    # the free archive endpoint to rate-limit us. Back off and retry rather than
    # silently degrading a town to pure climatology on a 429.
    raw = None
    for attempt in range(FETCH_ATTEMPTS):
        try:
            with urlopen(req, timeout=60) as resp:
                raw = json.loads(resp.read().decode())
            break
        except (URLError, ValueError, OSError) as e:
            wait = FETCH_BACKOFF_SECONDS * (attempt + 1)
            if attempt == FETCH_ATTEMPTS - 1:
                print(f"  archive fetch failed ({lat},{lon}): {e}")
                return None
            print(f"  archive fetch retry {attempt + 1} ({lat},{lon}): {e}; "
                  f"waiting {wait}s")
            time.sleep(wait)
    time.sleep(FETCH_PAUSE_SECONDS)
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


# The model only ever reads September days, but the archive endpoint is cheapest
# as one contiguous request. We therefore fetch the span and cache ONLY the
# September days out of it: v1's 18-year normal would otherwise commit about
# 6,600 daily rows per town to the repo, and this data tree is what the Vercel
# build traces.
CACHE_MONTHS = {9}


def _september_only(daily: dict) -> dict:
    return {d: v for d, v in daily.items() if int(d.split("-")[1]) in CACHE_MONTHS}


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
    daily = _september_only(daily)
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


def _early_fall_mean(daily: dict, year: int, window=None):
    """Mean of daily mean temp over the model's September window for `year`.
    Returns (mean, n_days). n_days is how many days actually had data — the
    caller decides if it's enough."""
    window = window or {"start": EARLY_FALL_START, "end": EARLY_FALL_END}
    start = date(year, *window["start"])
    end = date(year, *window["end"])
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


def climatology_years(year: int, params: dict) -> range:
    """Which years form the normal, per the version's climatology rule.

    v0: a rolling window of the N years before the target year.
    v1: a FIXED span (2008–2025). The v1 coefficient was fitted against
    anomalies from an 18-year mean, and a short rolling window sits materially
    cooler than that mean, which the coefficient would multiply into a spurious
    delay every year. The target year is always excluded from its own normal.
    """
    clim = params.get("climatology") or {"mode": "rolling", "years": CLIMATOLOGY_YEARS}
    if clim.get("mode") == "fixed_span":
        return range(clim["start_year"], clim["end_year"] + 1)
    return range(year - clim.get("years", CLIMATOLOGY_YEARS), year)


def compute_anomaly(daily: dict, year: int, params=None):
    """September temperature anomaly for `year`: this year's mean over the
    version's window minus its normal. Returns (anomaly_f | None, detail dict) —
    None when the current year lacks enough captured September days to trust a
    signal."""
    params = params or lm.get_params("leaf-v0-draft")
    window = params.get("thermal_window")
    normals = []
    for y in climatology_years(year, params):
        if y == year:
            continue
        m, n = _early_fall_mean(daily, y, window)
        if m is not None and n >= MIN_DAYS_FOR_ANOMALY:
            normals.append(m)
    if not normals:
        return None, {"reason": "no climatological normal available"}
    normal = sum(normals) / len(normals)

    cur_mean, cur_n = _early_fall_mean(daily, year, window)
    if cur_mean is None or cur_n < MIN_DAYS_FOR_ANOMALY:
        return None, {
            "reason": f"insufficient {year} September data ({cur_n} days)",
            "normal_f": round(normal, 2),
            "normal_years": len(normals),
            "window": window,
        }
    return round(cur_mean - normal, 2), {
        "normal_f": round(normal, 2),
        "normal_years": len(normals),
        "current_mean_f": round(cur_mean, 2),
        "current_days": cur_n,
        "window": window,
    }


def build_prediction(place: dict, year: int, refresh: bool, params: dict) -> dict:
    """Predict one town's peak window and record its full basis provenance."""
    # We want the normal's years + this year's September-to-date if it exists.
    clim = climatology_years(year, params)
    window = params["thermal_window"]
    need_start = date(min(clim.start, year), *window["start"])
    today = datetime.now(NY).date()
    want_end = date(year, *window["end"])
    need_end = min(want_end, today - timedelta(days=ARCHIVE_LAG_DAYS))
    if need_end < need_start:
        need_end = need_start

    daily = load_or_fetch_series(place, need_start, need_end, refresh=refresh)
    anomaly, detail = compute_anomaly(daily, year, params)

    pred = lm.predict_window(place["elevation_ft"], year, temp_anomaly_f=anomaly,
                             params=params)

    if anomaly is None:
        basis = ("elevation-climatology (photoperiod anchor + elevation lapse); "
                 "no thermal signal yet — " + detail.get("reason", ""))
    else:
        warmer = "warmer→later" if anomaly > 0 else "cooler→earlier"
        basis = (f"elevation-climatology + thermal anomaly {anomaly:+.1f}°F "
                 f"vs {detail['normal_years']}-yr normal ({warmer}) "
                 f"at {params['days_per_degf']} days/°F")

    return {
        "slug": place["slug"],
        "name": place["name"],
        "elevation_ft": place["elevation_ft"],
        "county": place.get("county"),
        **pred,
        "thermal": detail,
        "basis": basis,
    }


def choose_pass(params: dict, year: int, today: date | None = None) -> str | None:
    """Which pass the calendar can actually support.

    The final pass needs the whole month of September in the archive, which
    trails about six days — so before roughly October 6 the honest answer is the
    provisional pass on Sep 1–25. Versions without passes return None.
    """
    if not params.get("passes"):
        return None
    today = today or datetime.now(NY).date()
    full_month_ready = date(year, 9, 30) + timedelta(days=ARCHIVE_LAG_DAYS)
    return "final" if today >= full_month_ready else "provisional"


def predict(year: int, refresh: bool, version: str, pass_name: str | None) -> dict:
    params = lm.get_params(version, pass_name)
    places = load_places()
    predictions = [build_prediction(p, year, refresh, params) for p in places]
    # Sort earliest-peak first — a readable, sanity-checkable ordering.
    predictions.sort(key=lambda p: p["peak_center"])
    w = params["thermal_window"]
    return {
        "model_version": version,
        "model_pass": pass_name,
        "generated_at": datetime.now(NY).isoformat(),
        "target_year": year,
        "place_count": len(predictions),
        "method": (f"peak = Oct-{params['ref_peak_day']} photoperiod anchor at "
                   f"{params['ref_elevation_ft']:,} ft "
                   f"+ {params['days_per_1000ft']} days/1,000 ft elevation lapse "
                   f"+ September thermal anomaly at {params['days_per_degf']} days/°F "
                   f"(Sep {w['start'][1]}–{w['end'][1]}, clamped ±"
                   f"{params['max_thermal_shift_days']} days); window ±"
                   f"{params['half_window_days']} days. See docs/leaf-model.md."),
        "calibration": params.get("provenance"),
        "grading": ("Scored once observed peaks arrive: abs/signed day error, "
                    "window-hit bool, 0–100 (full within "
                    f"{params['grade_tol_days']} days, "
                    f"−{params['grade_penalty_per_day']}/day beyond)."),
        "predictions": predictions,
    }


def hindcast(refresh: bool, version: str = "leaf-v0-draft",
             pass_name: str | None = None) -> dict:
    """Grade the model against documented elevation-band peaks for 2024/2025.

    Ground truth is human-judged bands (not exact dates), identical across years
    in the sources — so this checks the elevation gradient's shape, not
    interannual skill. Valley peaks are recorded ungraded (too vague)."""
    # A synthetic 'place' per band so we can reuse the archive/anomaly machinery
    # against Grandfather's coordinate for the thermal term.
    grandfather = {"slug": "_hindcast-grandfather", "lat": 36.0956, "lon": -81.8309}
    params = lm.get_params(version, pass_name)
    window = params["thermal_window"]
    results = {"model_version": version, "model_pass": pass_name,
               "years": {}, "ungraded": HINDCAST_UNGRADED}
    for year in HINDCAST_YEARS:
        clim = climatology_years(year, params)
        need_start = date(min(clim.start, year), *window["start"])
        need_end = date(year, *window["end"])
        daily = load_or_fetch_series(grandfather, need_start, need_end, refresh=refresh)
        anomaly, detail = compute_anomaly(daily, year, params)
        band_rows = []
        for band, truth in HINDCAST_TRUTH.items():
            pred = lm.predict_window(truth["elevation_ft"], year,
                                     temp_anomaly_f=anomaly, params=params)
            observed = {
                "start": f"{year}-{truth['observed']['start']}",
                "end": f"{year}-{truth['observed']['end']}",
            }
            score = lm.score_prediction(pred, observed, params=params)
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


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(BASE_DIR))
    except ValueError:
        return str(path)


def output_path(version: str, pass_name: str | None) -> Path:
    """Where this version+pass writes. Unknown combinations get an explicit
    filename rather than silently landing on somebody else's artifact."""
    key = (version, pass_name)
    if key in OUT_PATHS:
        return OUT_PATHS[key]
    suffix = f"-{pass_name}" if pass_name else ""
    return LEAF_DIR / f"predictions-{version}{suffix}.json"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fall leaf-color forecast.")
    ap.add_argument("--year", type=int, default=datetime.now(NY).year,
                    help="target fall year (default: current year)")
    ap.add_argument("--model-version", default=lm.DEFAULT_VERSION,
                    choices=sorted(lm.PARAMS),
                    help=f"parameter set to run (default: {lm.DEFAULT_VERSION})")
    ap.add_argument("--pass", dest="pass_name", default=None,
                    choices=["provisional", "final"],
                    help="which pass of a multi-pass version; default: whichever "
                         "the calendar can support")
    ap.add_argument("--out", type=Path, default=None,
                    help="override the output path")
    ap.add_argument("--allow-overwrite", action="store_true",
                    help="permit overwriting an existing prediction file. Published "
                         "prediction files are graded artifacts; regenerating one "
                         "destroys the record being graded.")
    ap.add_argument("--refresh", action="store_true",
                    help="force re-fetch of archive temperatures")
    ap.add_argument("--hindcast", action="store_true",
                    help="grade 2024/2025 vs documented ground truth, print, and exit")
    args = ap.parse_args()

    version = args.model_version
    params = lm.get_params(version)
    pass_name = args.pass_name or choose_pass(params, args.year)

    if args.hindcast:
        out = hindcast(refresh=args.refresh, version=version, pass_name=pass_name)
        print(json.dumps(out, indent=2))
        return 0

    out_path = args.out or output_path(version, pass_name)
    if out_path.exists() and not args.allow_overwrite:
        print(f"REFUSING to overwrite {_rel(out_path)}: a published "
              f"prediction file is a graded artifact. Pass --allow-overwrite if you "
              f"really mean to replace it, or --out to write elsewhere.", file=sys.stderr)
        return 1

    out = predict(args.year, refresh=args.refresh, version=version, pass_name=pass_name)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"[{out['generated_at']}] wrote {len(out['predictions'])} predictions "
          f"for fall {args.year} ({version}"
          f"{'/' + pass_name if pass_name else ''}) → {_rel(out_path)}")
    for p in out["predictions"]:
        print(f"  {p['peak_center']}  {p['name']:<18} {p['elevation_ft']:>5} ft   {p['basis']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
