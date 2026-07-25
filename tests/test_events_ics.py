"""Pure-function tests for scripts/capture_events_ics.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_events_ics import (
    athletics_feeds,
    is_home,
    parse_dtstart,
    parse_vevents,
    sort_key,
    unfold_lines,
)

# A small inline fixture: folded SUMMARY line, a TZID DTSTART, a UTC DTSTART,
# a date-only VALUE=DATE event, plus non-VEVENT noise that must be ignored.
FIXTURE = (
    "BEGIN:VCALENDAR\r\n"
    "VERSION:2.0\r\n"
    "X-WR-CALNAME:App State Football\r\n"
    "BEGIN:VEVENT\r\n"
    "UID:game-1@appstatesports.com\r\n"
    "SUMMARY:App State vs Charlotte\r\n"
    " (Homecoming)\r\n"
    "DTSTART;TZID=America/New_York:20261010T150000\r\n"
    "LOCATION:Kidd Brewer Stadium\\, Boone\\, NC\r\n"
    "END:VEVENT\r\n"
    "BEGIN:VEVENT\r\n"
    "UID:game-2@appstatesports.com\r\n"
    "SUMMARY:App State at Georgia Southern\r\n"
    "DTSTART:20261017T190000Z\r\n"
    "LOCATION:Statesboro\\, GA\r\n"
    "END:VEVENT\r\n"
    "BEGIN:VEVENT\r\n"
    "UID:game-3@appstatesports.com\r\n"
    "SUMMARY:All-day thing\r\n"
    "DTSTART;VALUE=DATE:20260905\r\n"
    "LOCATION:Boone\r\n"
    "END:VEVENT\r\n"
    "END:VCALENDAR\r\n"
)


def test_unfold_lines_joins_continuations():
    lines = unfold_lines("SUMMARY:App State vs Charlotte\r\n (Homecoming)\r\nUID:x")
    assert lines[0] == "SUMMARY:App State vs Charlotte(Homecoming)"
    assert lines[1] == "UID:x"


def test_parse_dtstart_tzid():
    iso = parse_dtstart({"TZID": "America/New_York"}, "20261010T150000")
    assert iso == "2026-10-10T15:00:00-04:00"  # EDT in October


def test_parse_dtstart_utc():
    iso = parse_dtstart({}, "20261017T190000Z")
    assert iso == "2026-10-17T19:00:00+00:00"


def test_parse_dtstart_date_only():
    assert parse_dtstart({"VALUE": "DATE"}, "20260905") == "2026-09-05"
    # bare 8-digit value is also treated as a date
    assert parse_dtstart({}, "20260905") == "2026-09-05"


def test_parse_dtstart_unparseable_returns_none():
    assert parse_dtstart({}, "not-a-date") is None


def test_is_home_detects_boone_case_insensitive():
    assert is_home("Kidd Brewer Stadium, Boone, NC") is True
    assert is_home("BOONE") is True
    assert is_home("Statesboro, GA") is False
    assert is_home(None) is False
    assert is_home("") is False


def test_parse_vevents_full_fixture():
    events = parse_vevents(FIXTURE)
    assert len(events) == 3
    by_uid = {e["uid"]: e for e in events}

    g1 = by_uid["game-1@appstatesports.com"]
    assert g1["summary"] == "App State vs Charlotte(Homecoming)"  # unfolded
    assert g1["location"] == "Kidd Brewer Stadium, Boone, NC"  # unescaped commas
    assert g1["start"] == "2026-10-10T15:00:00-04:00"
    assert g1["home"] is True

    g2 = by_uid["game-2@appstatesports.com"]
    assert g2["start"] == "2026-10-17T19:00:00+00:00"
    assert g2["home"] is False

    g3 = by_uid["game-3@appstatesports.com"]
    assert g3["start"] == "2026-09-05"
    assert g3["home"] is True


def test_events_sort_by_start_across_mixed_types():
    events = sorted(parse_vevents(FIXTURE), key=lambda e: sort_key(e["start"]))
    # date-only 09-05, then 10-10 15:00 EDT (19:00Z), then 10-17 19:00Z
    assert [e["uid"] for e in events] == [
        "game-3@appstatesports.com",
        "game-1@appstatesports.com",
        "game-2@appstatesports.com",
    ]


def test_athletics_feeds_filters_to_appstate_ics():
    registry = {
        "feeds": [
            {"id": "appstate-football", "format": "ics", "url": "u1"},
            {"id": "appstate-mbb", "format": "ics", "url": "u2"},
            {"id": "town-of-boone", "format": "rss", "url": "u3"},
            {"id": "downtown-boone", "format": "ics", "url": "u4"},  # not appstate-
            {"id": "blowing-rock-events", "format": "ics", "url": "u5"},
        ]
    }
    ids = [f["id"] for f in athletics_feeds(registry)]
    assert ids == ["appstate-football", "appstate-mbb"]
