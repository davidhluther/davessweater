#!/usr/bin/env python3
"""
fit_leaf_v1.py -- calibrate the leaf model's thermal and anchor constants against
the published High Country peak-color record, using OUR OWN temperature series.

What this does, in order:

1. Loads the training set (data/leaf/training/fcg-historical.json): per-year
   observed peak date at the 3,300 ft reference elevation, 2008-2025, plus the
   September mean temperature the original analyst published for that year.
2. Pulls the Open-Meteo archive September means for Boone (the model's own
   thermal source) for the same years and cross-checks them against the
   published means -- correlation, mean offset, per-year deltas.
3. Fits the thermal coefficient (days of peak delay per degF of September
   anomaly) on OUR temperature series against THEIR observed peaks, with:
     - leave-one-year-out validation (MAE, vs a climatology-only baseline)
     - the with/without-2018-2019 sensitivity the source analysis warns about
     - a full-September vs Sep 1-25 window comparison
4. Tests clamp choices (+-7 vs +-10 days) against the historical extremes.
5. Back-solves the reference peak date at REF_ELEVATION_FT implied by the
   observed 3,300 ft record under the model's declared elevation lapse.

Prints a report. Writes nothing except (optionally) the Open-Meteo cache. The
fitted numbers are transcribed by hand into leaf_model.py's V1 parameter block,
so the shipped constants stay declared constants a reader can trace.

Usage:
    python3 scripts/fit_leaf_v1.py
    python3 scripts/fit_leaf_v1.py --refresh    # re-fetch the archive series
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import leaf_model as lm

BASE_DIR = Path(__file__).resolve().parent.parent
TRAINING_PATH = BASE_DIR / "data" / "leaf" / "training" / "fcg-historical.json"
CACHE_PATH = BASE_DIR / "data" / "leaf" / "inputs" / "boone-september-archive.json"

BOONE_LAT, BOONE_LON = 36.2168, -81.6746
REFERENCE_ELEV_FT = 3300  # the elevation the observed peak record describes

ARCHIVE_URL = (
    "https://archive-api.open-meteo.com/v1/archive?"
    "latitude={lat}&longitude={lon}&start_date={start}&end_date={end}"
    "&daily=temperature_2m_max,temperature_2m_min"
    "&temperature_unit=fahrenheit&timezone=America/New_York"
)


# ── small stats helpers (stdlib only, same house rule as the rest of scripts/) ──

def mean(xs):
    return sum(xs) / len(xs)


def linreg(xs, ys):
    """Ordinary least squares. Returns (slope, intercept, r2, n)."""
    n = len(xs)
    mx, my = mean(xs), mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx
    intercept = my - slope * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys))
    r2 = 1.0 - ss_res / ss_tot if ss_tot else float("nan")
    return slope, intercept, r2, n


def pearson(xs, ys):
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return num / den if den else float("nan")


# ── data ─────────────────────────────────────────────────────────────────────

def load_training():
    payload = json.loads(TRAINING_PATH.read_text())
    return payload["years"]


def september_series(refresh=False):
    """{year: {"full": mean, "first25": mean}} from the Open-Meteo archive."""
    if CACHE_PATH.exists() and not refresh:
        return json.loads(CACHE_PATH.read_text())["september_mean_f"]
    url = ARCHIVE_URL.format(lat=BOONE_LAT, lon=BOONE_LON,
                             start="2008-01-01", end="2025-12-31")
    with urlopen(Request(url, headers={"User-Agent": "DavesSweater/1.0"}), timeout=90) as r:
        daily = json.loads(r.read().decode())["daily"]
    full, first25 = {}, {}
    for t, hi, lo in zip(daily["time"], daily["temperature_2m_max"],
                         daily["temperature_2m_min"]):
        if hi is None or lo is None:
            continue
        y, m, d = (int(p) for p in t.split("-"))
        if m != 9:
            continue
        full.setdefault(str(y), []).append((hi + lo) / 2.0)
        if d <= 25:
            first25.setdefault(str(y), []).append((hi + lo) / 2.0)
    out = {y: {"full": round(mean(v), 3), "first25": round(mean(first25[y]), 3),
               "days": len(v)}
           for y, v in sorted(full.items())}
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps({
        "source": "Open-Meteo archive (archive-api.open-meteo.com), Boone NC 36.2168/-81.6746",
        "note": "September daily-mean temperatures, degF. Cached input to fit_leaf_v1.py.",
        "september_mean_f": out,
    }, indent=2) + "\n")
    return out


def october_day(iso):
    """Peak date -> day-of-October number (the record's native unit)."""
    d = date.fromisoformat(iso)
    return (d - date(d.year, 10, 1)).days + 1


# ── the report ───────────────────────────────────────────────────────────────

def loyo_mae(xs, ys, fit_fn):
    """Leave-one-year-out mean absolute error, in days."""
    errs = []
    for i in range(len(xs)):
        tx = xs[:i] + xs[i + 1:]
        ty = ys[:i] + ys[i + 1:]
        pred = fit_fn(tx, ty, xs[i])
        errs.append(abs(pred - ys[i]))
    return mean(errs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    years = load_training()
    om = september_series(refresh=args.refresh)

    graded = [y for y in years if y.get("observed_peak")]
    print(f"Training set: {len(years)} years on record, "
          f"{len(graded)} with an observed peak date.")

    # ── 1. temperature cross-check ───────────────────────────────────────────
    pub, ours, deltas = [], [], []
    for y in years:
        key = str(y["year"])
        if y.get("september_mean_f") is None or key not in om:
            continue
        pub.append(y["september_mean_f"])
        ours.append(om[key]["full"])
        deltas.append((y["year"], round(om[key]["full"] - y["september_mean_f"], 2)))
    r = pearson(pub, ours)
    off = mean([d for _, d in deltas])
    print("\n== September temperature cross-check (published record vs Open-Meteo) ==")
    print(f"n={len(pub)}  r={r:.3f}  r2={r*r:.3f}")
    print(f"mean offset (ours - theirs) = {off:+.2f} degF; "
          f"mean |delta| = {mean([abs(d) for _, d in deltas]):.2f} degF; "
          f"max |delta| = {max(abs(d) for _, d in deltas):.2f} degF")
    print("  per-year delta:", ", ".join(f"{yy}:{dd:+.1f}" for yy, dd in deltas))

    # ── 2. the fit, on our series ────────────────────────────────────────────
    def rows(window):
        out = []
        for y in graded:
            key = str(y["year"])
            if key not in om:
                continue
            out.append((y["year"], om[key][window], october_day(y["observed_peak"])))
        return out

    print("\n== Thermal coefficient, fitted on OUR temperature series ==")
    fits = {}
    for window in ("full", "first25"):
        rs = rows(window)
        xs = [t for _, t, _ in rs]
        ys = [d for _, _, d in rs]
        slope, icept, r2, n = linreg(xs, ys)
        fits[window] = (slope, icept, r2, n, rs)
        label = "full September" if window == "full" else "September 1-25"
        print(f"  {label:16s} n={n}  slope={slope:.3f} days/degF  "
              f"intercept={icept:.2f}  R2={r2:.3f}")

    # their own published regression, for reference
    pxs = [y["september_mean_f"] for y in graded if y.get("september_mean_f")]
    pys = [october_day(y["observed_peak"]) for y in graded if y.get("september_mean_f")]
    ps, pi, pr2, pn = linreg(pxs, pys)
    print(f"  {'published series':16s} n={pn}  slope={ps:.3f} days/degF  "
          f"intercept={pi:.2f}  R2={pr2:.3f}   (their stated: 1.90, R2 0.62)")

    # ── 3. sensitivity: drop the two warm years ──────────────────────────────
    print("\n== Sensitivity: the two anomalously warm years (2018, 2019) ==")
    for window in ("full", "first25"):
        rs = [r_ for r_ in fits[window][4] if r_[0] not in (2018, 2019)]
        slope, icept, r2, n = linreg([t for _, t, _ in rs], [d for _, _, d in rs])
        label = "full September" if window == "full" else "September 1-25"
        print(f"  {label:16s} without 2018/2019: n={n} slope={slope:.3f} R2={r2:.3f}")
    prs = [(y["year"], y["september_mean_f"], october_day(y["observed_peak"]))
           for y in graded if y.get("september_mean_f") and y["year"] not in (2018, 2019)]
    s2, _, r22, n2 = linreg([t for _, t, _ in prs], [d for _, _, d in prs])
    print(f"  {'published series':16s} without 2018/2019: n={n2} slope={s2:.3f} "
          f"R2={r22:.3f}   (their stated: R2 0.25, p=.056)")

    # ── 4. leave-one-year-out validation ─────────────────────────────────────
    print("\n== Leave-one-year-out validation (mean absolute error, days) ==")
    rs = fits["full"][4]
    xs = [t for _, t, _ in rs]
    ys = [d for _, _, d in rs]

    def fit_ols(tx, ty, x):
        s, i, _, _ = linreg(tx, ty)
        return s * x + i

    def fit_fixed(coef):
        def f(tx, ty, x):
            return mean(ty) + coef * (x - mean(tx))
        return f

    def fit_clim(tx, ty, x):
        return mean(ty)

    print(f"  climatology only (no thermal term) : {loyo_mae(xs, ys, fit_clim):.2f}")
    print(f"  OLS refit each fold                : {loyo_mae(xs, ys, fit_ols):.2f}")
    for coef in (1.0, 1.2, 1.5, 1.9, fits['full'][0]):
        print(f"  fixed coefficient {coef:4.2f}             : "
              f"{loyo_mae(xs, ys, fit_fixed(coef)):.2f}")

    # ── 5. clamp test ────────────────────────────────────────────────────────
    print("\n== Clamp test: implied thermal shift at the historical extremes ==")
    norm = mean(xs)
    coef = fits["full"][0]
    for yr, t, d in sorted(rs, key=lambda r_: r_[1]):
        anom = t - norm
        raw = coef * anom
        if abs(raw) > 6.0:
            print(f"  {yr}: anomaly {anom:+.2f} degF -> raw shift {raw:+.2f} d "
                  f"(clamped at 7: {max(-7, min(7, raw)):+.1f}; "
                  f"at 10: {max(-10, min(10, raw)):+.1f}); "
                  f"observed peak Oct {d}, climatological mean Oct {mean(ys):.1f} "
                  f"-> observed shift {d - mean(ys):+.1f} d")

    # ── 6. anchor ────────────────────────────────────────────────────────────
    print("\n== Reference peak-date anchor ==")
    mean_day = mean(ys)
    print(f"  observed mean peak at {REFERENCE_ELEV_FT} ft = October {mean_day:.2f} "
          f"(n={len(ys)}, sd={ (sum((y-mean_day)**2 for y in ys)/(len(ys)-1))**0.5 :.2f} d)")
    lapse_days = (lm.REF_ELEVATION_FT - REFERENCE_ELEV_FT) * lm.DAYS_PER_1000FT / 1000.0
    print(f"  elevation lapse {lm.DAYS_PER_1000FT} d/1000ft over "
          f"{lm.REF_ELEVATION_FT - REFERENCE_ELEV_FT} ft = {lapse_days:+.2f} d")
    # The reference elevation (5,000 ft) is HIGHER and so peaks EARLIER: the
    # anchor is the observed 3,300 ft date minus the lapse across those 1,700 ft.
    implied = mean_day - lapse_days
    print(f"  => implied reference peak at {lm.REF_ELEVATION_FT} ft = October {implied:.2f} "
          f"(v0 ships October {lm.REF_PEAK_DAY})")
    recent = [d for yr, _, d in rs if yr >= 2017]
    print(f"  recent-era (2017+) mean peak at {REFERENCE_ELEV_FT} ft = "
          f"October {mean(recent):.2f} (n={len(recent)}) "
          f"=> implied reference October {mean(recent) - lapse_days:.2f}")
    print(f"  long-term September normal, our series (2008-2025 full September): "
          f"{mean([om[str(y)]['full'] for y in range(2008, 2026)]):.2f} degF; "
          f"Sep 1-25: {mean([om[str(y)]['first25'] for y in range(2008, 2026)]):.2f} degF")
    print(f"  6-year rolling normal for a 2026 run (2020-2025 full September): "
          f"{mean([om[str(y)]['full'] for y in range(2020, 2026)]):.2f} degF "
          f"-- the v0 climatology window, shown because the gap between it and the "
          f"long-term normal is a bias the fitted coefficient would multiply.")


if __name__ == "__main__":
    main()
