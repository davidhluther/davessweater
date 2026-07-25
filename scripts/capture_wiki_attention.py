#!/usr/bin/env python3
"""
capture_wiki_attention.py — Wikipedia pageviews as a regional attention proxy.

Wikimedia's official pageviews REST API (free, keyless, verified 2026-07-25)
gives daily view counts per article. Rising views for Boone / App State /
the Parkway pages are a cheap leading indicator of trip planning — people
read about a place before they drive to it.

Maintains ONE rolling file, data/attention/wiki_pageviews.json:
{article: {date: views}}, merged each run (the API lags ~1-2 days, so each
run re-requests the last LOOKBACK_DAYS and merges), trimmed to KEEP_DAYS.
Fail-closed, stdlib only, always exits 0.
"""

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
BASE_DIR = Path(__file__).resolve().parent.parent
OUT_PATH = BASE_DIR / "data" / "attention" / "wiki_pageviews.json"

ARTICLES = [
    "Boone,_North_Carolina",
    "Appalachian_State_University",
    "Blowing_Rock,_North_Carolina",
    "Blue_Ridge_Parkway",
    "Grandfather_Mountain",
]
API = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
       "en.wikipedia/all-access/all-agents/{article}/daily/{start}/{end}")
LOOKBACK_DAYS = 14
KEEP_DAYS = 400
TIMEOUT_S = 20
CALL_SPACING_S = 0.8


def merge_series(existing: dict, article: str, items: list[dict]) -> dict:
    """Merge API rows ({timestamp: 'YYYYMMDD00', views}) into {date: views}."""
    series = dict(existing.get(article, {}))
    for row in items:
        ts = str(row.get("timestamp", ""))
        if len(ts) >= 8 and isinstance(row.get("views"), int):
            series[f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}"] = row["views"]
    existing[article] = dict(sorted(series.items())[-KEEP_DAYS:])
    return existing


def main() -> int:
    now = datetime.now(NY)
    end = now.date() - timedelta(days=1)
    start = end - timedelta(days=LOOKBACK_DAYS)
    data = {"articles": {}}
    if OUT_PATH.exists():
        try:
            data = json.loads(OUT_PATH.read_text())
        except ValueError:
            pass
    articles = data.setdefault("articles", {})

    ok = 0
    for article in ARTICLES:
        url = API.format(article=article, start=start.strftime("%Y%m%d"),
                         end=end.strftime("%Y%m%d"))
        try:
            req = Request(url, headers={"User-Agent": "davessweater.com data pipeline"})
            with urlopen(req, timeout=TIMEOUT_S) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            merge_series(articles, article, payload.get("items", []))
            ok += 1
        except (URLError, TimeoutError, ValueError, OSError) as exc:
            print(f"  WARN {article}: {exc}", file=sys.stderr)
        time.sleep(CALL_SPACING_S)

    data["fetched_at"] = now.isoformat()
    data["source"] = "Wikimedia pageviews REST API (official, keyless)"
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} ({ok}/{len(ARTICLES)} articles updated)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
