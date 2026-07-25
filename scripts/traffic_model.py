"""
traffic_model.py — pure-function core for the Boone corridor traffic model (v0).

No I/O. Shared by forecast_traffic.py (predict) and compare_traffic.py (grade),
and exercised directly by tests. Same philosophy as scoring.py: transparent,
declared constants; every number a reader can trace.

The model predicts, per corridor per sample window, a CONGESTION RATIO
(current speed / free-flow speed — 1.0 = free flow, lower = slower), the same
quantity the TomTom actuals record. A prediction is:

    ratio_hat = baseline_cell x event_multiplier x weather_multiplier   (clamped)

- baseline_cell: the mean observed ratio for (corridor, weekday-class, window)
  over ALL accumulated actuals, with a documented cold-start fallback chain.
- event_multiplier: DECLARED v0 PRIORS (below) from the event registry +
  athletics feed + Busy-ness Index band. First-guess magnitudes, corrected by
  the daily grading loop — not tuned, just a starting belief.
- weather_multiplier: minimal in v0 (heavy precip slows traffic); winter road
  refinements land with roads v1.

Sample windows track the actuals sampler's crons (~08:00 / 12:00 / 17:00 /
19:00 America/New_York).
"""

import math
from collections import defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")

# ── sample windows ───────────────────────────────────────────────────────────
# NY-local target hours, kept in sync with capture_traffic_actuals.py's crons
# (7 12/16/21/23 UTC ≈ 08:00/12:00/17:00/19:00 NY, an hour early in winter).
WINDOWS = (8, 12, 17, 19)


def window_label(hour: int) -> str:
    return f"{hour:02d}:00"


WINDOW_LABELS = tuple(window_label(h) for h in WINDOWS)


def weekday_class(d: date) -> str:
    """weekday / friday / saturday / sunday — Fri/Sat/Sun each get their own
    class (distinct demand shapes); Mon–Thu collapse to 'weekday'."""
    wd = d.weekday()  # Mon=0 .. Sun=6
    if wd == 4:
        return "friday"
    if wd == 5:
        return "saturday"
    if wd == 6:
        return "sunday"
    return "weekday"


WEEKDAY_CLASSES = ("weekday", "friday", "saturday", "sunday")


def _hour_float(iso_or_dt) -> float | None:
    """NY-local fractional hour of an ISO timestamp (or datetime)."""
    if isinstance(iso_or_dt, datetime):
        dt = iso_or_dt
    else:
        try:
            dt = datetime.fromisoformat(iso_or_dt)
        except (ValueError, TypeError):
            return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(NY)
    return dt.hour + dt.minute / 60.0


def window_for_time(iso_or_dt) -> int | None:
    """Assign a sample timestamp to the NEAREST target window hour.

    Samples arrive from four fixed crons, so nearest-window is unambiguous in
    practice; a manually dispatched off-hour sample still lands on its closest
    window (documented, acceptable for v0). Ties break to the earlier window.
    """
    hf = _hour_float(iso_or_dt)
    if hf is None:
        return None
    return min(WINDOWS, key=lambda w: (abs(hf - w), w))


# ── prediction primitives ────────────────────────────────────────────────────
CLAMP_LO, CLAMP_HI = 0.05, 1.0  # ratio lives in (0.05, 1.0]; floor at 0.05.


def clamp_ratio(v: float) -> float:
    return round(min(CLAMP_HI, max(CLAMP_LO, v)), 3)


# jammed = ratio below this; probability is a logistic in the point prediction.
JAM_THRESHOLD = 0.55
# Steepness (per unit ratio). At ratio == threshold, p = 0.5; a 0.10 swing below
# the threshold gives ~0.77, a 0.10 swing above ~0.23 — a gentle, legible curve.
JAM_K = 12.0


def jammed_probability(ratio: float) -> float:
    """P(jammed) from the point ratio: logistic centered on JAM_THRESHOLD,
    rising as the predicted ratio drops below it."""
    return round(1.0 / (1.0 + math.exp(JAM_K * (ratio - JAM_THRESHOLD))), 3)


def predict_ratio(baseline: float, event_mult: float, weather_mult: float) -> float:
    return clamp_ratio(baseline * event_mult * weather_mult)


# ── baseline cells + cold-start fallback chain ───────────────────────────────

def accumulate_baselines(actual_days: list[dict]) -> dict:
    """Mean observed ratio per bucket over ALL accumulated actuals files.

    Returns three lookup levels used by baseline_lookup():
      cell            : (corridor, weekday_class, window) -> mean ratio
      corridor_window : (corridor, window)                -> mean ratio
      corridor        : corridor                          -> mean ratio
    Non-null ratios only; a null/absent reading contributes nothing.
    """
    cell = defaultdict(lambda: [0.0, 0])
    corr_win = defaultdict(lambda: [0.0, 0])
    corr = defaultdict(lambda: [0.0, 0])

    for day in actual_days or []:
        raw = day.get("date")
        try:
            d = date.fromisoformat(raw)
        except (ValueError, TypeError):
            continue
        wc = weekday_class(d)
        for sample in day.get("samples", []) or []:
            win = window_for_time(sample.get("at"))
            if win is None:
                continue
            for slug, reading in (sample.get("readings") or {}).items():
                if not reading:
                    continue
                ratio = reading.get("ratio")
                if ratio is None:
                    continue
                for acc, key in (
                    (cell, (slug, wc, win)),
                    (corr_win, (slug, win)),
                    (corr, slug),
                ):
                    acc[key][0] += ratio
                    acc[key][1] += 1

    def means(acc):
        return {k: round(s / n, 4) for k, (s, n) in acc.items() if n}

    return {"cell": means(cell), "corridor_window": means(corr_win), "corridor": means(corr)}


def baseline_lookup(baselines: dict, corridor: str, wclass: str, window: int) -> tuple[float, str]:
    """(value, basis) via the fallback chain:
      cell → corridor_window → corridor → 1.0 (default).
    'basis' names the level actually used, so a cold-start prediction is honest
    about how little it knows."""
    cell = baselines.get("cell", {})
    if (corridor, wclass, window) in cell:
        return cell[(corridor, wclass, window)], "cell"
    cw = baselines.get("corridor_window", {})
    if (corridor, window) in cw:
        return cw[(corridor, window)], "corridor_window"
    c = baselines.get("corridor", {})
    if corridor in c:
        return c[corridor], "corridor"
    return 1.0, "default"


# ── v0 event priors (declared belief, corrected by grading) ──────────────────
# Every multiplier scales the baseline ratio DOWN toward congestion (or, for
# outflow, slightly UP). Deliberately coarse first guesses; the season's
# predict→grade loop is what turns them into learned values. v0 applies each
# day-level prior UNIFORMLY across a corridor's sample windows — within-day
# structure (kickoff hour, move-in schedule) is deferred to what grading reveals.

MAJOR_EVENT_MULT = 0.75        # a major NON-academic/athletics event in a corridor's own towns
ACADEMIC_MOVEIN_MULT = 0.65    # major academic inflow (move-in, family wknd, commencement)
ACADEMIC_CORRIDORS = ("king-st", "bypass-321")
FOOTBALL_PRIMARY_MULT = 0.55   # App State home football on king-st + bypass-321
FOOTBALL_PRIMARY_CORRIDORS = ("king-st", "bypass-321")
FOOTBALL_SPILLOVER_MULT = 0.80  # home football, every other corridor
OUTFLOW_MULT = 1.05            # negative-sign (outflow) events loosen traffic; ratio still clamps at 1.0
# Busy-ness Index band nudge, tourist corridors only (bypass, us321-blowing-rock, nc105-*).
BAND_MULT = {"slammed": 0.90, "busy": 0.95}
TOURIST_CORRIDORS = ("bypass-321", "us321-blowing-rock", "nc105-split", "nc105-foscoe")

# Which corridors serve which event towns. Coarse, from the pin descriptions +
# local geography (the registry's own event.corridors field uses a different,
# non-matching taxonomy, so v0 keys off towns).
CORRIDOR_TOWNS = {
    "bypass-321": {"boone"},
    "king-st": {"boone"},
    "nc105-split": {"boone"},
    "nc105-foscoe": {"foscoe", "banner-elk", "sugar-grove", "beech-mountain",
                     "valle-crucis", "vilas"},
    "us321-blowing-rock": {"blowing-rock"},
    "us421-deep-gap": {"deep-gap"},
}
CORRIDOR_SLUGS = tuple(CORRIDOR_TOWNS.keys())


def event_multiplier(corridor: str, matched: dict, band: str | None) -> float:
    """Combine the v0 priors for one corridor on one date.

    Multiplicative: football, then academic move-in, then a major town event,
    then the tourist-corridor band nudge, then an outflow loosening. The final
    ratio clamp (<= 1.0) enforces the 'outflow cap 1.0' intent.
    """
    mult = 1.0
    if matched.get("football"):
        mult *= (FOOTBALL_PRIMARY_MULT if corridor in FOOTBALL_PRIMARY_CORRIDORS
                 else FOOTBALL_SPILLOVER_MULT)
    if matched.get("academic_movein") and corridor in ACADEMIC_CORRIDORS:
        mult *= ACADEMIC_MOVEIN_MULT
    if CORRIDOR_TOWNS.get(corridor, set()) & matched.get("major_towns", set()):
        mult *= MAJOR_EVENT_MULT
    if corridor in TOURIST_CORRIDORS and band in BAND_MULT:
        mult *= BAND_MULT[band]
    if matched.get("outflow"):
        mult *= OUTFLOW_MULT
    return round(mult, 4)


# ── event matching (registry + athletics on a date) ──────────────────────────

def _is_defunct(event: dict) -> bool:
    name = (event.get("name") or "").lower()
    flag = ((event.get("provenance") or {}).get("flag") or "").lower()
    return any(t in name or t in flag for t in ("defunct", "discontinued"))


def _date_in_range(iso_date: str, date_range: dict | None) -> bool:
    if not date_range:
        return False
    start, end = date_range.get("start"), date_range.get("end")
    return bool(start and end and start <= iso_date <= end)


def _event_matches(event: dict, iso_date: str) -> bool:
    return iso_date in (event.get("dates") or []) or _date_in_range(iso_date, event.get("date_range"))


def _ny_date(iso_start: str | None) -> str | None:
    if not iso_start:
        return None
    if len(iso_start) == 10:
        return iso_start
    try:
        dt = datetime.fromisoformat(iso_start)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=NY)
    return dt.astimezone(NY).date().isoformat()


def _football_home_on(athletics: dict | None, iso_date: str) -> bool:
    if not athletics:
        return False
    for g in (athletics.get("feeds") or {}).get("football", []) or []:
        if g.get("home") and _ny_date(g.get("start")) == iso_date:
            return True
    return False


def match_events(registry: dict | None, athletics: dict | None, iso_date: str) -> dict:
    """Discrete events on a date, distilled into the flags the priors need.

    Returns:
      ids            : matched registry event ids (any magnitude, non-defunct)
                       plus 'asu-football' when a home game lands on the date
      labels         : human names for the same
      football       : App State home football (registry snapshot OR live feed)
      academic_movein: a major academic inflow event matched
      major_towns    : towns of matched major NON-academic/athletics events
      outflow        : any negative demand_sign event matched
    """
    ids: list[str] = []
    labels: list[str] = []
    academic_movein = False
    major_towns: set[str] = set()
    outflow = False

    for ev in (registry or {}).get("events", []):
        if _is_defunct(ev) or not _event_matches(ev, iso_date):
            continue
        ids.append(ev.get("id"))
        labels.append(ev.get("name") or ev.get("id"))
        etype = ev.get("type")
        magnitude = ev.get("magnitude")
        sign = ev.get("demand_sign")
        if sign == "negative":
            outflow = True
            continue
        if etype == "academic" and magnitude == "major":
            academic_movein = True
        elif etype not in ("academic", "athletics") and magnitude == "major":
            major_towns |= set(ev.get("towns") or [])

    football = _football_home_on(athletics, iso_date)
    # Registry may also carry the athletics snapshot (type athletics) — detect it.
    if not football:
        for ev in (registry or {}).get("events", []):
            if ev.get("type") == "athletics" and _event_matches(ev, iso_date):
                football = True
                break
    if football and "asu-football" not in ids:
        ids.append("asu-football")
        labels.append("App State home football")

    return {"ids": [i for i in ids if i], "labels": labels, "football": football,
            "academic_movein": academic_movein, "major_towns": major_towns,
            "outflow": outflow}


# ── weather multiplier ───────────────────────────────────────────────────────
HEAVY_PRECIP_PROB = 60  # > this (%) counts as heavy
WEATHER_HEAVY_MULT = 0.85


def weather_multiplier(forecast_day: dict | None) -> tuple[float, str]:
    """v0 weather effect for a target date's forecast_5day entry.
    Heavy precip (>60% hourly prob, or any source calling snow) slows traffic."""
    if not forecast_day:
        return 1.0, "no-forecast"
    sources = (forecast_day.get("sources") or {}).values()
    sky = (forecast_day.get("sky") or "").lower()
    snow = "snow" in sky or any((s.get("precip_type") or "") == "snow" for s in sources)
    if snow:
        return WEATHER_HEAVY_MULT, "snow"
    hourly = forecast_day.get("hourly") or []
    if hourly:
        max_prob = max((int(h.get("prob") or 0) for h in hourly), default=0)
    else:
        # No hourly on the far end of the window — fall back to source PoPs.
        max_prob = max((int(s.get("precip_prob") or 0) for s in sources), default=0)
    if max_prob > HEAVY_PRECIP_PROB:
        return WEATHER_HEAVY_MULT, f"heavy precip {max_prob}%"
    return 1.0, "dry-or-light"


# ── grading math (comparer) ──────────────────────────────────────────────────

def observed_window_ratios(actual_day: dict | None) -> dict:
    """{corridor: {window_label: mean observed ratio}} for one actuals day.
    Multiple samples in a window are averaged (matching the baseline math)."""
    acc = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    for sample in (actual_day or {}).get("samples", []) or []:
        win = window_for_time(sample.get("at"))
        if win is None:
            continue
        label = window_label(win)
        for slug, reading in (sample.get("readings") or {}).items():
            if not reading:
                continue
            ratio = reading.get("ratio")
            if ratio is None:
                continue
            acc[slug][label][0] += ratio
            acc[slug][label][1] += 1
    return {slug: {lbl: round(s / n, 4) for lbl, (s, n) in wins.items() if n}
            for slug, wins in acc.items()}


def abs_error(predicted: float, observed: float) -> float:
    return round(abs(predicted - observed), 4)


def brier(prob: float, observed_jammed: bool) -> float:
    return round((prob - (1.0 if observed_jammed else 0.0)) ** 2, 4)


def new_bucket() -> dict:
    return {"n": 0, "sum_abs_error": 0.0, "sum_brier": 0.0, "ratio_mae": None, "brier": None}


def add_to_bucket(bucket: dict, ae: float, br: float) -> dict:
    """Fold one graded pair into a running bucket. Callers guard against
    double-counting a date via scores['graded_dates']."""
    b = bucket if bucket else new_bucket()
    n = b["n"] + 1
    sa = round(b["sum_abs_error"] + ae, 4)
    sb = round(b["sum_brier"] + br, 4)
    return {"n": n, "sum_abs_error": sa, "sum_brier": sb,
            "ratio_mae": round(sa / n, 4), "brier": round(sb / n, 4)}
