#!/usr/bin/env python3
"""Backfill real Apple Weather predictions from the daily iPhone screenshots.

WHY THIS EXISTS
---------------
The iPhone Shortcut wrote scoreable Apple data (``iphone_forecast_apple.json``)
only on 2026-03-05 and 2026-03-06, then silently regressed to uploading the
screenshot *image* alone. For every day after that, ``compare.py`` fell back to
the Open-Meteo ``iphone_forecast.json`` and scored *that* under ``apple_weather``
— i.e. the "Apple Weather" column was Open-Meteo data wearing Apple's name.

But 30 genuine Apple Weather screenshots were captured (2026-03-05 -> 2026-06-24).
This script recovers the real Apple forecast from each screenshot so those days
score as actual Apple data instead of the Open-Meteo fallback.

METHOD & LIMITS (read before trusting these numbers)
----------------------------------------------------
Values were transcribed from the Apple Weather screenshots by a human/vision
pass against the original PNGs in ``data/predictions/<date>/iphone_screenshot.png``.

* **High / Low** — read directly off Apple's "H:.. L:.." line (the dominant 60 of
  100 scoring points). Cross-checked against 2026-03-05/06, whose values match the
  Shortcut's own data files exactly (H69/L50, H..). Reliable.
* **Conditions / precip type** — Apple's displayed day forecast: a precip headline
  ("Drizzle", "Rain", "Thunderstorms", "Flurries") or an explicit "<precip>
  conditions expected/forecasted" narrative -> rain/snow; otherwise none. Apple
  does not publish a numeric precip *amount*, so amount is treated exactly like the
  existing pipeline (inferred 0.0"/0.01" from conditions) — not a real measurement.
* **Wind** — Apple's screenshot shows *gusts* ("gusts up to X mph"), not sustained
  wind. Modeled as the interval ``[0, gust]`` and scored with the same vagueness
  tax (WIND_WIDTH_K) the project already uses for Ray's qualitative wind. On days
  Apple showed no wind figure, wind is **forfeited** (no ``wind_*`` keys) rather
  than invented — that day caps near 80, honestly.
* Two real screenshots (2026-03-15, 2026-04-01) had a weather *alert* banner
  covering the H/L line, so high/low could not be read honestly -> intentionally
  skipped (left to drop out of the Apple column rather than guessed).

The 2 pre-existing real files (03-05, 03-06) are never overwritten.

Run from the repo root: ``python scripts/backfill_apple_screenshots.py``
(add ``--force`` to overwrite previously-backfilled files).
"""
import json
import sys
from pathlib import Path

PRED = Path(__file__).resolve().parent.parent / "data" / "predictions"

# date -> (high_f, low_f, conditions, gust_mph_or_None, observed_headline_note)
# conditions string is chosen to classify precip correctly via compare.py's
# _apple_condition_to_category; observed_headline preserves what the screenshot
# actually led with (compare.py ignores unknown keys).
TABLE = {
    "2026-03-07": (69, 54, "Cloudy",        14, "Cloudy; sunny expected 8AM"),
    "2026-03-08": (59, 51, "Cloudy",        None, "Cloudy all day; no wind shown"),
    "2026-03-09": (66, 48, "Mostly Cloudy", 19, "Mostly Cloudy; sunny expected 9AM"),
    "2026-03-10": (69, 51, "Partly Cloudy", None, "Partly cloudy expected 2PM; no wind shown"),
    "2026-03-11": (77, 58, "Cloudy",        13, "Cloudy; partly cloudy expected 11AM"),
    "2026-03-12": (57, 30, "Clear",         46, "Special Weather Statement; clear expected 8PM, gusts to 46"),
    "2026-03-13": (55, 28, "Clear",         24, "Clear/sunny; gusts to 24 (feels like 47)"),
    "2026-03-14": (63, 40, "Sunny",         13, "Sunny; cloudy expected 9AM"),
    "2026-03-16": (55, 18, "Flurries",      None, "Severe Weather; possible flurries; no gust shown"),
    "2026-03-17": (25, 15, "Partly Cloudy", 30, "Partly cloudy expected 8PM; gusts to 30"),
    "2026-03-20": (62, 37, "Cloudy",        16, "Cloudy rest of day"),
    "2026-04-16": (75, 58, "Mostly Sunny",  20, "Special Weather Statement; sunny all day"),
    "2026-04-18": (78, 54, "Mostly Sunny",  15, "Mostly Sunny; cloudy expected 2PM"),
    "2026-05-03": (56, 33, "Sunny",         14, "Freeze Warning; sunny all day"),
    "2026-05-04": (68, 41, "Partly Cloudy", 11, "Partly Cloudy; sunny expected 8AM"),
    "2026-05-05": (67, 48, "Sunny",         10, "Sunny; cloudy expected 12PM"),
    "2026-05-06": (66, 53, "Rain",          15, "Cloudy headline; rainy conditions expected 8AM"),
    "2026-05-07": (57, 43, "Drizzle",       None, "Drizzle; rain forecasted next hour; no gust shown"),
    "2026-05-22": (60, 55, "Drizzle",       13, "Drizzle; cloudy expected 9AM"),
    "2026-05-27": (72, 62, "Thunderstorms", None, "Cloudy headline; thunderstorms 2-3PM; no gust shown"),
    "2026-06-01": (72, 58, "Rain",          18, "Cloudy headline; rainy conditions expected 12PM"),
    "2026-06-17": (75, 54, "Cloudy",        13, "Cloudy; sunny expected 5PM"),
    "2026-06-21": (77, 57, "Sunny",         None, "Sunny all day; no gust shown (feels like 77)"),
    "2026-06-22": (77, 60, "Thunderstorms", 15, "Mostly Sunny headline; thunderstorms expected 3PM"),
    "2026-06-23": (68, 56, "Rain",          15, "Cloudy headline; rainy conditions expected 9AM"),
    "2026-06-24": (74, 52, "Cloudy",        3,  "Cloudy; partly cloudy expected 4PM"),
}

# Screenshots whose H/L line was obscured by an alert banner — skipped on purpose.
SKIPPED = {"2026-03-15": "Wind Advisory + Light Rain banner covered H/L",
           "2026-04-01": "Rain Stopping banner + precip map covered H/L"}


def main(force=False):
    written, skipped_existing = 0, 0
    for date, (high, low, conditions, gust, note) in sorted(TABLE.items()):
        out = PRED / date / "iphone_forecast_apple.json"
        if not out.parent.exists():
            print(f"  ! {date}: prediction dir missing, skipping")
            continue
        if out.exists() and not force:
            skipped_existing += 1
            print(f"  = {date}: iphone_forecast_apple.json already exists (skip; --force to overwrite)")
            continue
        rec = {
            "today_high_f": high,
            "tonight_low_f": low,
            "conditions": conditions,
            "source": f"iPhone screenshot (backfilled from {date}/iphone_screenshot.png)",
            "observed_headline": note,
        }
        if gust is not None:
            rec["wind_lo"] = 0
            rec["wind_hi"] = gust
        out.write_text(json.dumps(rec) + "\n")
        written += 1
        wind = f"[0,{gust}]" if gust is not None else "forfeited"
        print(f"  + {date}: H{high} L{low} {conditions:14s} wind={wind}")
    print(f"\nWrote {written} Apple backfill files; {skipped_existing} pre-existing left untouched.")
    print(f"Intentionally skipped (alert covered H/L): {', '.join(sorted(SKIPPED))}")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
