#!/usr/bin/env python3
"""
fetch_substack.py — fetch ALL blog posts from Substack.
Uses the Substack API endpoint, RSS feed, and homepage scraping as fallbacks.
Always fetches the full list so edits on Substack carry over.
Saves parsed items to data/substack_feed.json.
"""

import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SUBSTACK_SLUG = "davessweater"
BASE_URL = f"https://{SUBSTACK_SLUG}.substack.com"
API_URL = f"{BASE_URL}/api/v1/archive?sort=new&limit=50"
OUTPUT = DATA_DIR / "substack_feed.json"

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def fetch_via_api():
    """Try Substack's JSON API endpoint."""
    print(f"  Trying Substack API: {API_URL}")
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15",
             "-H", f"User-Agent: {UA}",
             "-H", "Accept: application/json",
             API_URL],
            capture_output=True, timeout=20,
        )
        if result.returncode != 0 or not result.stdout:
            print(f"  API curl failed (exit {result.returncode})", file=sys.stderr)
            return []

        data = json.loads(result.stdout)
        if not isinstance(data, list):
            print(f"  API returned unexpected type: {type(data)}", file=sys.stderr)
            print(f"  Preview: {result.stdout[:300]}", file=sys.stderr)
            return []

        items = []
        for post in data:
            title = post.get("title", "")
            slug = post.get("slug", "")
            link = post.get("canonical_url", f"{BASE_URL}/p/{slug}")
            date = post.get("post_date", "")[:10]
            desc = post.get("subtitle", "") or post.get("description", "")
            desc = re.sub(r"<[^>]+>", "", desc)[:200].strip()
            body = post.get("body_html", "")
            items.append({"title": title, "link": link, "date": date, "summary": desc, "content": body})

        print(f"  API returned {len(items)} posts")
        return items

    except json.JSONDecodeError:
        print(f"  API response is not JSON, preview: {result.stdout[:300]}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  API fetch error: {e}", file=sys.stderr)
        return []


def fetch_via_rss():
    """Try Substack's RSS feed (/feed endpoint)."""
    rss_url = f"{BASE_URL}/feed"
    print(f"  Trying Substack RSS: {rss_url}")
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15",
             "-H", f"User-Agent: {UA}",
             "-H", "Accept: application/rss+xml, application/xml, text/xml",
             rss_url],
            capture_output=True, timeout=20,
        )
        if result.returncode != 0 or not result.stdout:
            print(f"  RSS curl failed (exit {result.returncode})", file=sys.stderr)
            return []

        xml = result.stdout.decode("utf-8", errors="replace")
        if "<item>" not in xml:
            print("  RSS response has no <item> elements", file=sys.stderr)
            return []

        items = []
        for item_match in re.finditer(r"<item>(.*?)</item>", xml, re.DOTALL):
            block = item_match.group(1)

            title_m = re.search(r"<title><!\[CDATA\[(.*?)\]\]></title>", block, re.DOTALL)
            if not title_m:
                title_m = re.search(r"<title>(.*?)</title>", block, re.DOTALL)
            title = title_m.group(1).strip() if title_m else ""

            link_m = re.search(r"<link>(.*?)</link>", block)
            link = link_m.group(1).strip() if link_m else ""

            date_m = re.search(r"<pubDate>(.*?)</pubDate>", block)
            date = ""
            if date_m:
                from email.utils import parsedate_to_datetime
                try:
                    date = parsedate_to_datetime(date_m.group(1)).strftime("%Y-%m-%d")
                except Exception:
                    date = date_m.group(1)[:10]

            desc_m = re.search(r"<description><!\[CDATA\[(.*?)\]\]></description>", block, re.DOTALL)
            if not desc_m:
                desc_m = re.search(r"<description>(.*?)</description>", block, re.DOTALL)
            desc = re.sub(r"<[^>]+>", "", desc_m.group(1))[:200].strip() if desc_m else ""

            content_m = re.search(r"<content:encoded><!\[CDATA\[(.*?)\]\]></content:encoded>", block, re.DOTALL)
            content = content_m.group(1).strip() if content_m else ""

            items.append({"title": title, "link": link, "date": date, "summary": desc, "content": content})

        print(f"  RSS returned {len(items)} posts")
        return items

    except Exception as e:
        print(f"  RSS fetch error: {e}", file=sys.stderr)
        return []


def fetch_via_homepage():
    """Scrape the Substack homepage for post links."""
    print(f"  Trying homepage scrape: {BASE_URL}")
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15",
             "-H", f"User-Agent: {UA}",
             "-H", "Accept: text/html",
             BASE_URL],
            capture_output=True, timeout=20,
        )
        if result.returncode != 0 or not result.stdout:
            return []

        html = result.stdout.decode("utf-8", errors="replace")

        # Look for Next.js __NEXT_DATA__ JSON which contains post data
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            try:
                next_data = json.loads(match.group(1))
                posts = next_data.get("props", {}).get("pageProps", {}).get("posts", [])
                items = []
                for post in posts:
                    title = post.get("title", "")
                    slug = post.get("slug", "")
                    link = post.get("canonical_url", f"{BASE_URL}/p/{slug}")
                    date = post.get("post_date", "")[:10]
                    desc = post.get("subtitle", "") or post.get("description", "")
                    desc = re.sub(r"<[^>]+>", "", desc)[:200].strip()
                    body = post.get("body_html", "")
                    items.append({"title": title, "link": link, "date": date, "summary": desc, "content": body})
                if items:
                    print(f"  Found {len(items)} posts via __NEXT_DATA__")
                    return items
            except (json.JSONDecodeError, KeyError):
                pass

        # Fallback: parse post links from HTML
        post_links = re.findall(
            r'<a[^>]+href="(https://davessweater\.substack\.com/p/[^"]+)"[^>]*>.*?</a>',
            html, re.DOTALL
        )
        if post_links:
            items = []
            seen = set()
            for link in post_links:
                if link in seen:
                    continue
                seen.add(link)
                # Extract slug for title
                slug = link.split("/p/")[-1].split("?")[0]
                title = slug.replace("-", " ").title()
                items.append({"title": title, "link": link, "date": "", "summary": ""})
            print(f"  Found {len(items)} posts via HTML parsing")
            return items

        print("  No posts found in homepage HTML", file=sys.stderr)
        return []

    except Exception as e:
        print(f"  Homepage scrape error: {e}", file=sys.stderr)
        return []


def main():
    print(f"Fetching posts from {BASE_URL}")

    # Try API first, then RSS, then homepage scrape
    items = fetch_via_api()
    if not items:
        items = fetch_via_rss()
    if not items:
        items = fetch_via_homepage()

    if items:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(items, indent=2))
        print(f"Saved {len(items)} posts to {OUTPUT}")
    else:
        if OUTPUT.exists():
            print(f"Fetch failed, keeping existing cache at {OUTPUT}")
        else:
            print("Could not fetch any posts (no cache exists)", file=sys.stderr)


if __name__ == "__main__":
    main()
