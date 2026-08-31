#!/usr/bin/env python3
"""
compute_busyness.py — the Busy-ness Index engine (tourism forecast v0).

Computes a 14-day forward "how busy is the High Country" index for the region
(weighted toward Boone) from the committed demand + events + weather captures.
Runs daily after the captures; writes data/demand/index/{today}.json.

Each forecast date gets a 0-100 score from four components:

  hotel   (0-40) : fraction of rostered hotels pricing that date "high"
                   (summary.high_share from the lodging capture).
  str     (0-25) : mean STR fill_rate across the Boone + Blowing Rock markets
                   (capped at 1.0 per market — the source's fill can exceed 1).
  events  (net)  : registry events + seasons + App State home games landing on
                   the date (major +20 / moderate +10 / minor +4, positive pool
                   capped at +30; seasons count half; demand_sign "negative"
                   outflow events SUBTRACT their magnitude).
  leaf    (0-15) : share of the tracked towns whose predicted peak-color window
                   covers the date, from our own leaf model
                   (data/leaf/predictions.json). This REPLACES the registry's
                   flat "leaf season = all of October" placeholder, which is
                   skipped as superseded so the same fact is never counted twice.
  weekend (0/5)  : +5 on Fridays and Saturdays.

Bands: <35 calm, 35-54 typical, 55-74 busy, >=75 slammed.

KNOWN v0 BIAS — read before trusting the shape of the curve: STR fill_rate
decays with lead time (dates a few days out are naturally fuller than dates two
weeks out, because bookings arrive continuously). v0 deliberately does NOT model
this — there is no lead-time correction curve here, because inventing one without
data would be worse than an honest, documented bias. The bands are therefore
ABSOLUTE and not-vs-typical; a future baseline model (unlocking ~4-6 weeks after
the first captures, once we have a history to compare a date against) will correct
for lead time. Every output carries provisional: true saying exactly this.

Fail-soft, stdlib only: each input is loaded independently; a missing input means
its component contributes nothing and the input is named in `missing_inputs`. The
script ALWAYS exits 0.
"""

import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
DEMAND_DIR = BASE_DIR / "data" / "demand"
STR_DIR = DEMAND_DIR / "str"
ALERTS_DIR = BASE_DIR / "data" / "alerts"
REGISTRY_PATH = BASE_DIR / "data" / "events" / "registry.json"
ATHLETICS_PATH = BASE_DIR / "data" / "events" / "athletics.json"
FORECAST_PATH = BASE_DIR / "data" / "forecast_5day.json"
LEAF_PATH = BASE_DIR / "data" / "leaf" / "predictions.json"
OUT_DIR = DEMAND_DIR / "index"

HORIZON_DAYS = 14
HOTEL_MAX = 40.0
STR_MAX = 25.0
EVENTS_POSITIVE_CAP = 30.0
WEEKEND_BONUS = 5.0
# Leaf season is the year's largest tourism swing here, but it is one input
# among several, so it is capped below the lodging signals that measure demand
# directly rather than predicting it. A date at the height of the season -- every
# tracked town inside its predicted window at once -- earns the full 15, which
# is enough to lift a typical weekend into "busy" and not enough to call a
# weekday "slammed" on foliage alone.
LEAF_MAX = 15.0

MAGNITUDE_POINTS = {"major": 20.0, "moderate": 10.0, "minor": 4.0}
DEFAULT_MAGNITUDE = "moderate"
# App State home-game weights: a football Saturday is a region event; a single
# home basketball game is a minor bump.
ATHLETICS_MAGNITUDE = {"football": "major", "mbb": "minor", "wbb": "minor"}
ATHLETICS_LABEL = {
    "football": "App State home football",
    "mbb": "App State home men's basketball",
    "wbb": "App State home women's basketball",
}

DATE_FILE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")

PROVISIONAL_NOTE = (
    "no historical baseline yet — bands are absolute, not vs-typical; "
    "baseline unlocks ~4-6 weeks after 2026-07-25"
)


# ── component scoring (pure) ────────────────────────────────────────────────

def score_hotel(high_share: dict | None, iso_date: str) -> float:
    """0-40: fraction of hotels pricing this date high, scaled to HOTEL_MAX."""
    if not high_share:
        return 0.0
    frac = high_share.get(iso_date)
    if frac is None:
        return 0.0
    return max(0.0, min(1.0, float(frac))) * HOTEL_MAX


def score_str(fill_by_market: dict | None, iso_date: str) -> float:
    """0-25: mean of each market's fill_rate for this date (each capped at 1.0)."""
    if not fill_by_market:
        return 0.0
    fills = []
    for market_fills in fill_by_market.values():
        val = market_fills.get(iso_date)
        if val is not None:
            fills.append(min(1.0, float(val)))
    if not fills:
        return 0.0
    return (sum(fills) / len(fills)) * STR_MAX


def leaf_peak_share(leaf: dict | None, iso_date: str) -> float:
    """Fraction of the tracked places whose predicted peak-color window covers
    this date. 0.0 when the model has not been run or the date is out of season.

    Share of towns, not an average of anything -- the index is regional, and the
    honest regional statement is how much of the footprint is at peak at once.
    Because the towns span 1,001 to 5,436 ft, that fraction rises and falls
    across October on its own, which is the shape the flat registry placeholder
    could not produce.
    """
    predictions = (leaf or {}).get("predictions") or []
    if not predictions:
        return 0.0
    covering = sum(
        1 for p in predictions
        if p.get("peak_start") and p.get("peak_end")
        and p["peak_start"] <= iso_date <= p["peak_end"]
    )
    return covering / len(predictions)


def leaf_component(leaf: dict | None, iso_date: str) -> dict:
    """0-15 points plus a driver naming how much of the region is at peak."""
    predictions = (leaf or {}).get("predictions") or []
    share = leaf_peak_share(leaf, iso_date)
    if share <= 0:
        return {"points": 0.0, "drivers": []}
    covering = round(share * len(predictions))
    driver = (
        f"Predicted peak color at {covering} of {len(predictions)} tracked towns"
    )
    return {"points": share * LEAF_MAX, "drivers": [driver]}


def is_superseded(entry: dict) -> bool:
    """Registry rows a model now computes directly. The row stays in the
    registry for its provenance; the engine takes the number from the model.
    """
    return bool(entry.get("superseded_by"))


def is_defunct(event: dict) -> bool:
    """Registry entries flagged discontinued must never enter a forecast."""
    name = (event.get("name") or "").lower()
    flag = ((event.get("provenance") or {}).get("flag") or "").lower()
    return "defunct" in name or "discontinued" in name or "defunct" in flag or "discontinued" in flag


def _date_in_range(iso_date: str, date_range: dict | None) -> bool:
    if not date_range:
        return False
    start, end = date_range.get("start"), date_range.get("end")
    return bool(start and end and start <= iso_date <= end)


def event_matches(event: dict, iso_date: str) -> bool:
    """True if a registry event/season covers this date (dates list or span)."""
    if iso_date in (event.get("dates") or []):
        return True
    return _date_in_range(iso_date, event.get("date_range"))


def athletics_home_on(athletics: dict | None, iso_date: str) -> list[dict]:
    """App State home games (by sport) whose NY-local start date is iso_date."""
    if not athletics:
        return []
    out = []
    for sport, games in (athletics.get("feeds") or {}).items():
        for g in games or []:
            if g.get("home") and _ny_date(g.get("start")) == iso_date:
                out.append({"sport": sport, "uid": g.get("uid"),
                            "summary": g.get("summary")})
    return out


def _ny_date(iso_start: str | None) -> str | None:
    """The NY-local calendar date of an ISO start (date-only or datetime)."""
    if not iso_start:
        return None
    if len(iso_start) == 10:  # already a date
        return iso_start
    try:
        dt = datetime.fromisoformat(iso_start)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=NY)
    return dt.astimezone(NY).date().isoformat()


def events_component(registry: dict | None, athletics: dict | None, iso_date: str) -> dict:
    """Net event points for a date, plus ordered driver strings and matched ids.

    Positive event points (regular events + seasons at half magnitude + home
    games) are summed and capped at EVENTS_POSITIVE_CAP; negative (outflow)
    events then subtract their magnitude. Result can go below zero — the caller
    clamps the whole score.
    """
    positive = 0.0
    negative = 0.0
    weighted_drivers: list[tuple[float, str]] = []
    ids: list[str] = []

    registry = registry or {}
    # Regular events (skip defunct).
    reg_athletics_hit = False
    for ev in registry.get("events", []):
        if is_defunct(ev) or not event_matches(ev, iso_date):
            continue
        base = MAGNITUDE_POINTS.get(ev.get("magnitude", DEFAULT_MAGNITUDE), MAGNITUDE_POINTS[DEFAULT_MAGNITUDE])
        name = ev.get("name") or ev.get("id")
        if ev.get("demand_sign") == "negative":
            negative += base
            weighted_drivers.append((-base, name))
        else:
            positive += base
            weighted_drivers.append((base, name))
        if ev.get("type") == "athletics":
            reg_athletics_hit = True
        ids.append(ev.get("id"))

    # Seasons — long-running background, half magnitude.
    for s in registry.get("seasons", []):
        if is_superseded(s) or not event_matches(s, iso_date):
            continue
        base = MAGNITUDE_POINTS.get(s.get("magnitude", DEFAULT_MAGNITUDE), MAGNITUDE_POINTS[DEFAULT_MAGNITUDE]) * 0.5
        name = s.get("name") or s.get("id")
        positive += base
        weighted_drivers.append((base, name))
        ids.append(s.get("id"))

    # App State home games from the live feed. Football is already represented
    # by the registry's asu-fb snapshot (type "athletics"); if that matched this
    # date, drop feed football to avoid double-counting the same Saturday.
    for game in athletics_home_on(athletics, iso_date):
        if game["sport"] == "football" and reg_athletics_hit:
            continue
        base = MAGNITUDE_POINTS[ATHLETICS_MAGNITUDE.get(game["sport"], "minor")]
        label = ATHLETICS_LABEL.get(game["sport"], "App State home game")
        positive += base
        weighted_drivers.append((base, label))
        if game.get("uid"):
            ids.append(game["uid"])

    points = min(positive, EVENTS_POSITIVE_CAP) - negative
    # Most important first: largest absolute contribution leads.
    weighted_drivers.sort(key=lambda wd: abs(wd[0]), reverse=True)
    drivers = [name for _, name in weighted_drivers]
    return {"points": points, "drivers": drivers, "ids": ids}


def is_weekend(d: date) -> bool:
    return d.weekday() in (4, 5)  # Fri, Sat


def band(score: float) -> str:
    if score < 35:
        return "calm"
    if score < 55:
        return "typical"
    if score < 75:
        return "busy"
    return "slammed"


def alerts_overlapping(alerts: list | None, iso_date: str) -> list[str]:
    """Driver strings for NWS alerts active on the date (onset..ends span)."""
    if not alerts:
        return []
    out = []
    for a in alerts:
        onset = (a.get("onset") or "")[:10]
        ends = (a.get("ends") or "")[:10]
        # Missing bounds -> treat as active; else require the date inside the span.
        if (not onset or onset <= iso_date) and (not ends or iso_date <= ends):
            counties = ", ".join(a.get("counties") or [])
            event = a.get("event") or "Weather alert"
            out.append(f"{event} ({counties})" if counties else event)
    return out


def weather_note(forecast_days: list | None, iso_date: str) -> str | None:
    """A descriptive weather driver (no score impact) when the date is inside
    the 5-day window and precip looks significant."""
    if not forecast_days:
        return None
    day = next((d for d in forecast_days if d.get("date") == iso_date), None)
    if not day:
        return None
    hourly = day.get("hourly") or []
    total_in = sum(float(h.get("inches") or 0) for h in hourly)
    max_prob = max((int(h.get("prob") or 0) for h in hourly), default=0)
    if total_in < 0.1 and max_prob < 50:
        return None
    sky = day.get("sky") or "wet"
    note = f"Weather: {sky}, {max_prob}% chance"
    if total_in >= 0.05:
        note += f' (~{total_in:.2f}" expected)'
    return note


# ── assembly (pure) ─────────────────────────────────────────────────────────

def build_horizon(today: date, hotel_high_share, str_fill_by_market,
                  registry, athletics, alerts, forecast_days, leaf=None) -> list[dict]:
    horizon = []
    for i in range(HORIZON_DAYS):
        d = today + timedelta(days=i)
        iso = d.isoformat()

        hotel_pts = round(score_hotel(hotel_high_share, iso), 1)
        str_pts = round(score_str(str_fill_by_market, iso), 1)
        ev = events_component(registry, athletics, iso)
        ev_pts = round(ev["points"], 1)
        leaf_ev = leaf_component(leaf, iso)
        leaf_pts = round(leaf_ev["points"], 1)
        weekend_pts = WEEKEND_BONUS if is_weekend(d) else 0.0

        score = hotel_pts + str_pts + ev_pts + leaf_pts + weekend_pts
        score = int(round(max(0.0, min(100.0, score))))

        drivers = list(ev["drivers"]) + leaf_ev["drivers"]
        share = (hotel_high_share or {}).get(iso)
        if share is not None and float(share) >= 0.5:
            drivers.append(f"{round(float(share) * 100)}% of hotels price this date high")
        if str_pts > 0:
            # mean fill implied by the awarded points
            mean_fill = str_pts / STR_MAX
            drivers.append(f"STRs {round(mean_fill * 100)}% booked")
        drivers.extend(alerts_overlapping(alerts, iso))
        wx = weather_note(forecast_days, iso)
        if wx:
            drivers.append(wx)

        horizon.append({
            "date": iso,
            "score": score,
            "band": band(score),
            "components": {
                "hotel": hotel_pts,
                "str": str_pts,
                "events": ev_pts,
                "leaf": leaf_pts,
                "weekend": weekend_pts,
            },
            "drivers": drivers,
            "events": ev["ids"],
        })
    return horizon


# ── IO shell ────────────────────────────────────────────────────────────────

def _load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def latest_dated_file(directory: Path) -> Path | None:
    """The newest YYYY-MM-DD.json in a directory (by filename), or None."""
    if not directory.is_dir():
        return None
    dated = [p for p in directory.iterdir() if DATE_FILE_RE.match(p.name)]
    return max(dated, key=lambda p: p.name) if dated else None


def load_inputs(today: date):
    """Load every input fail-soft; return the parsed pieces + missing_inputs."""
    missing: list[str] = []

    hotel_high_share = None
    hotel_file = latest_dated_file(DEMAND_DIR)
    if hotel_file:
        hotel = _load_json(hotel_file)
        if hotel:
            hotel_high_share = (hotel.get("summary") or {}).get("high_share")
    if not hotel_high_share:
        missing.append("hotel demand")

    str_fill_by_market = None
    str_file = latest_dated_file(STR_DIR)
    if str_file:
        strd = _load_json(str_file)
        if strd:
            markets = strd.get("markets") or {}
            fill_by_market = {}
            for slug, m in markets.items():
                rows = m.get("daily") or []
                fill_by_market[slug] = {
                    r["date"]: r.get("fill_rate")
                    for r in rows if r.get("date") and r.get("fill_rate") is not None
                }
            str_fill_by_market = {k: v for k, v in fill_by_market.items() if v}
    if not str_fill_by_market:
        missing.append("STR pacing")

    alerts = None
    alerts_file = ALERTS_DIR / f"{today.isoformat()}.json"
    if not alerts_file.exists():
        alerts_file = latest_dated_file(ALERTS_DIR)
    if alerts_file:
        ad = _load_json(alerts_file)
        if ad is not None:
            alerts = ad.get("alerts") or []
    if alerts is None:
        missing.append("NWS alerts")

    registry = _load_json(REGISTRY_PATH)
    if registry is None:
        missing.append("event registry")

    athletics = _load_json(ATHLETICS_PATH)
    if athletics is None:
        missing.append("athletics schedule")

    forecast = _load_json(FORECAST_PATH)
    forecast_days = forecast.get("days") if forecast else None
    if not forecast_days:
        missing.append("5-day forecast")

    # The leaf model's own artifact. Absent or stale-year means no leaf points
    # and a named missing input -- never a guessed October.
    leaf = _load_json(LEAF_PATH)
    if leaf and leaf.get("target_year") != today.year:
        leaf = None
    if not (leaf or {}).get("predictions"):
        leaf = None
        missing.append("leaf predictions")

    return {
        "hotel_high_share": hotel_high_share,
        "str_fill_by_market": str_fill_by_market,
        "registry": registry,
        "athletics": athletics,
        "alerts": alerts,
        "forecast_days": forecast_days,
        "leaf": leaf,
        "missing_inputs": missing,
    }


def main() -> int:
    now = datetime.now(NY)
    today = now.date()

    inp = load_inputs(today)
    horizon = build_horizon(
        today,
        inp["hotel_high_share"],
        inp["str_fill_by_market"],
        inp["registry"],
        inp["athletics"],
        inp["alerts"],
        inp["forecast_days"],
        inp["leaf"],
    )

    out = {
        "computed_at": now.isoformat(),
        "provisional": True,
        "provisional_note": PROVISIONAL_NOTE,
        "horizon": horizon,
        "missing_inputs": inp["missing_inputs"],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{today.isoformat()}.json"
    out_path.write_text(json.dumps(out, indent=2) + "\n")
    if inp["missing_inputs"]:
        print(f"WARN missing inputs: {', '.join(inp['missing_inputs'])} (still exit 0).",
              file=sys.stderr)
    print(f"Wrote {out_path} ({len(horizon)} days; "
          f"{len(inp['missing_inputs'])} missing input(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
