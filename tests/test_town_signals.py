"""Pure-function tests for scripts/capture_town_signals.py (no network)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from capture_town_signals import matched_keyword, parse_items, scan_feed


def test_matched_keyword_hits():
    assert matched_keyword("King Street Festival") == "festival"
    assert matched_keyword("Downtown Parade Permit Application") == "permit"
    assert matched_keyword("Turkey Trot 5K Race") == "race"
    assert matched_keyword("Special Event Application - Block Party") == "special event"


def test_matched_keyword_word_boundaries_no_false_positive():
    # "race" must not fire on embrace/terrace/grace; "fair" is intentionally not a keyword.
    assert matched_keyword("We embrace the terrace with grace") is None
    assert matched_keyword("County Fair welcomes everyone") is None
    assert matched_keyword("Board of Adjustment Meeting") is None
    assert matched_keyword(None) is None
    assert matched_keyword("") is None


def test_matched_keyword_returns_first_listed_match():
    # KEYWORDS order puts "street closure" before "festival".
    assert matched_keyword("Street Closure for the Music Festival") == "street closure"


def test_parse_items_reads_rss():
    xml = (
        '<?xml version="1.0"?><rss version="2.0"><channel>'
        '<title>chan</title>'
        '<item><title>Fall Festival</title>'
        '<link>https://example.com/a</link>'
        '<pubDate>Sat, 25 Jul 2026 14:00:00 -0500</pubDate></item>'
        '<item><title>Council Meeting</title>'
        '<link>https://example.com/b</link>'
        '<pubDate>Sun, 26 Jul 2026 09:00:00 -0500</pubDate></item>'
        '</channel></rss>'
    )
    items = parse_items(xml)
    assert len(items) == 2
    assert items[0] == {"title": "Fall Festival", "date": "Sat, 25 Jul 2026 14:00:00 -0500",
                        "link": "https://example.com/a"}


def test_parse_items_namespaced_and_malformed():
    ns = ('<rss xmlns:calendarEvent="https://x/Calendar.aspx"><channel>'
          '<item><title>Road Closure</title><link>https://x/1</link></item>'
          '</channel></rss>')
    assert parse_items(ns)[0]["title"] == "Road Closure"
    assert parse_items("not xml at all <<<") == []  # fail-soft


def test_scan_feed_filters_and_tags():
    items = [
        {"title": "Blue Ridge Festival", "date": "d1", "link": "l1"},
        {"title": "Planning Commission", "date": "d2", "link": "l2"},
        {"title": "King St Parade", "date": "d3", "link": "l3"},
    ]
    hits = scan_feed(items, "boone-events")
    assert [h["title"] for h in hits] == ["Blue Ridge Festival", "King St Parade"]
    assert all(h["feed"] == "boone-events" for h in hits)
    assert hits[0]["keyword"] == "festival"
    assert hits[1]["keyword"] == "parade"
