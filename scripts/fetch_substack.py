#!/usr/bin/env python3
"""
fetch_substack.py — fetch Substack RSS feed using Playwright to bypass Cloudflare.
Saves parsed feed items to data/substack_feed.json.
"""

import asyncio
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FEED_URL = "https://davessweater.substack.com/feed"
OUTPUT = DATA_DIR / "substack_feed.json"


async def fetch_feed():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Playwright not installed, skipping Substack feed fetch", file=sys.stderr)
        return

    print(f"Fetching Substack RSS via Playwright: {FEED_URL}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(FEED_URL, wait_until="networkidle", timeout=30000)
            # Wait for Cloudflare challenge to resolve
            await page.wait_for_timeout(3000)
            content = await page.content()
        except Exception as e:
            print(f"  Error loading feed page: {e}", file=sys.stderr)
            await browser.close()
            return
        await browser.close()

    # The page content will be the XML wrapped in HTML by the browser
    # Try to extract the raw XML from the page source
    # Playwright renders XML as HTML, so we need to extract text content
    # Try fetching the raw response instead
    items = []

    # Try parsing as XML directly (in case Cloudflare passed through)
    try:
        root = ET.fromstring(content)
        for item in root.findall(".//item"):
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub = item.findtext("pubDate", "")[:16]
            desc = item.findtext("description", "")
            desc = re.sub(r"<[^>]+>", "", desc)[:200].strip()
            items.append({"title": title, "link": link, "date": pub, "summary": desc})
    except ET.ParseError:
        pass

    # If XML parsing failed, the browser rendered the XML as HTML
    # Try a different approach: use route interception
    if not items:
        items = await fetch_feed_intercepted()

    if items:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(items, indent=2))
        print(f"  Saved {len(items)} posts to {OUTPUT}")
    else:
        print("  No posts found in feed", file=sys.stderr)


async def fetch_feed_intercepted():
    """Use Playwright with response interception to get raw XML."""
    from playwright.async_api import async_playwright

    items = []
    raw_xml = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        async def handle_response(response):
            nonlocal raw_xml
            url = response.url
            if "substack.com/feed" in url or response.headers.get("content-type", "").startswith(("text/xml", "application/xml", "application/rss")):
                try:
                    body = await response.body()
                    if b"<item>" in body or b"<entry>" in body:
                        raw_xml = body
                except Exception:
                    pass

        page.on("response", handle_response)

        try:
            await page.goto(FEED_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(5000)
        except Exception as e:
            print(f"  Error during intercepted fetch: {e}", file=sys.stderr)

        await browser.close()

    if raw_xml:
        try:
            root = ET.fromstring(raw_xml)
            for item in root.findall(".//item")[:5]:
                title = item.findtext("title", "")
                link = item.findtext("link", "")
                pub = item.findtext("pubDate", "")[:16]
                desc = item.findtext("description", "")
                desc = re.sub(r"<[^>]+>", "", desc)[:200].strip()
                items.append({"title": title, "link": link, "date": pub, "summary": desc})
            print(f"  Parsed {len(items)} items from intercepted response")
        except ET.ParseError as e:
            print(f"  XML parse error on intercepted response: {e}", file=sys.stderr)

    return items


if __name__ == "__main__":
    asyncio.run(fetch_feed())
