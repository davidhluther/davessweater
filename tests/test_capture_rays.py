"""Offline unit tests for capture_rays.py parsing helpers.

These exercise the pure text-parsing functions with hand-built fixtures — no
Playwright, no network. The conftest at the repo root puts scripts/ on sys.path,
so `capture_rays` imports directly.
"""
import capture_rays
from capture_rays import _parse_daily_forecast, _check_day0_canary


# A faithful slice of Ray's forecast-tab raw_text. The defining feature of Ray's
# layout is that each "Hi:"/"Lo:" line sits *above* the header it belongs to, and
# the description sits *below* that header:
#
#     Hi: 72            <- Thursday's daytime high
#     Thursday          <- daytime header
#     <daytime desc>
#     Lo: 50            <- Thursday's overnight low
#     Thursday night    <- night header
#     <overnight desc>
#     Hi: 75            <- Friday's high
#     Friday
#     ...
#
# The day names are deliberately not aligned to any real weekday so the test
# proves dates are anchored to the capture date in ENCOUNTER order, and that
# day_name is recomputed from the assigned date (not Ray's verbatim label).
SAMPLE_TEXT = """\
Boone Forecast
Last Updated 6:00 AM by Ray Russell

Hi: 72
Thursday
Sunny; N wind 5-10 mph
Lo: 50
Thursday night
Clear; calm
Hi: 75
Friday
Partly cloudy; SW wind 5-15 mph
Lo: 53
Friday night
Mostly cloudy
Hi: 65
Saturday
Showers likely; breezy
Lo: 51
Saturday night
Rain
Hi: 70
Sunday
Clearing
Lo: 48
Sunday night
Clear
"""


# The mid-morning capture-day case: Ray is captured after the capture day's
# daytime is already underway, so there is NO bare weekday header for the
# capture day — only "<Day> overnight". The capture day's daytime high is not
# in the strip; only its overnight low (the "Lo:" above the "overnight" header).
# The first bare weekday header ("Tuesday") is the day AFTER the capture day.
MONDAY_CAPTURE_TEXT = """\
Boone Forecast
Last Updated 10:00 AM by Ray Russell

Lo: 63
Monday overnight
Cloudy; Evening showers and thunderstorms; SW wind 5-15 mph
Hi: 71
Tuesday
Cooler; NW wind 10-20 mph, gusty at times
Lo: 52
Tuesday night
Becoming mainly clear; NW wind 5-15 mph
Hi: 79
Wednesday
Mostly sunny; NW wind 5-10 mph
Lo: 57
Wednesday night
Scattered clouds; calm
"""


def test_daily_dates_anchor_to_capture_date_in_encounter_order():
    daily = _parse_daily_forecast(SAMPLE_TEXT, capture_date="2026-06-22")
    # Four day-name blocks → four daily entries.
    assert len(daily) == 4
    # daily[0] anchored to the capture date; each subsequent entry +1 day in
    # encounter order. day_name is recomputed from the date, so it reflects the
    # real calendar weekday of 2026-06-22 (a Monday) onward — NOT Ray's labels.
    assert [d["date"] for d in daily] == [
        "2026-06-22",
        "2026-06-23",
        "2026-06-24",
        "2026-06-25",
    ]
    assert [d["day_name"] for d in daily] == ["Monday", "Tuesday", "Wednesday", "Thursday"]


def test_hi_lo_bind_to_the_header_above_them():
    # The Hi above a weekday header is THAT day's high (the off-by-one fix):
    # Hi: 72 sits above the first day header, so daily[0] carries 72/50 — not the
    # 75/53 of the block below it.
    daily = _parse_daily_forecast(SAMPLE_TEXT, capture_date="2026-06-22")
    assert (daily[0]["high_f"], daily[0]["low_f"]) == (72, 50)
    assert (daily[1]["high_f"], daily[1]["low_f"]) == (75, 53)
    assert (daily[2]["high_f"], daily[2]["low_f"]) == (65, 51)
    assert (daily[3]["high_f"], daily[3]["low_f"]) == (70, 48)


def test_day0_canary_passes_when_high_matches_headline():
    # With binding fixed, daily[0].high_f equals the headline today's high, so
    # the off-by-one canary passes (this is the Phase-4 backfill contract).
    daily = _parse_daily_forecast(SAMPLE_TEXT, capture_date="2026-06-22")
    forecast = {"today_high_f": 72, "tonight_low_f": 50}
    assert _check_day0_canary(daily, forecast) is True


def test_capture_day_with_only_overnight_header():
    # Mid-morning capture: capture day has no bare weekday header, only
    # "<Day> overnight". daily[0] must still be the capture day (Monday), dated
    # the capture date, carrying the overnight Lo (63) and no daytime high.
    daily = _parse_daily_forecast(MONDAY_CAPTURE_TEXT, capture_date="2026-06-22")
    assert daily[0]["date"] == "2026-06-22"
    assert daily[0]["day_name"] == "Monday"
    assert daily[0]["high_f"] is None          # daytime high not in the strip
    assert daily[0]["low_f"] == 63             # overnight low above the header
    # The first bare weekday header ("Tuesday") is the day AFTER the capture day,
    # and its Hi (71) binds to it — not to the capture day.
    assert daily[1]["date"] == "2026-06-23"
    assert daily[1]["day_name"] == "Tuesday"
    assert daily[1]["high_f"] == 71
    assert daily[1]["low_f"] == 52


def test_day0_canary_indeterminate_when_high_absent():
    # When the capture day has no daytime high (overnight-only layout), the
    # canary has nothing to compare and must NOT flag a false off-by-one.
    daily = _parse_daily_forecast(MONDAY_CAPTURE_TEXT, capture_date="2026-06-22")
    forecast = {"today_high_f": 71, "tonight_low_f": 63}
    assert _check_day0_canary(daily, forecast) is True


def test_module_imports_without_playwright():
    # The parsers must be importable in a stdlib-only runtime (backfill path).
    assert hasattr(capture_rays, "_parse_daily_forecast")
