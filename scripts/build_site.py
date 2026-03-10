#!/usr/bin/env python3
"""
Dave's Sweater — build_site.py
Generates docs/index.html from data/ and copies assets/ → docs/assets/
"""

import json
import os
import re
import shutil
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ── paths ──────────────────────────────────────────────────────────────────────

ROOT        = Path(__file__).resolve().parent.parent
DATA        = ROOT / "data"
DOCS        = ROOT / "docs"
ASSETS_SRC  = ROOT / "assets"
ASSETS_DEST = DOCS / "assets"
SCORES_FILE = DATA / "scores.json"
COMPS_DIR   = DATA / "comparisons"
PREDS_DIR   = DATA / "predictions"

# ── RSS feeds ──────────────────────────────────────────────────────────────────

SUBSTACK_RSS = "https://davessweater.substack.com/feed"
YOUTUBE_UC   = "UCLQdHEMoKkrNc3PgWs3SksA"
YOUTUBE_RSS  = f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_UC}"

# ── Fourthwall Storefront API ──────────────────────────────────────────────────

FOURTHWALL_API   = "https://storefront-api.fourthwall.com/v1"
FOURTHWALL_TOKEN = os.environ.get("FOURTHWALL_TOKEN", "")
FOURTHWALL_STORE = "https://daves-sweater-shop.fourthwall.com"

# ── branding ───────────────────────────────────────────────────────────────────

COLOR_TEAL   = "#3C5468"
COLOR_ORANGE = "#f97316"
COLOR_BG     = "#ffffff"
COLOR_CARD   = "#F8F9FC"
COLOR_TEXT   = "#1a1a1a"
COLOR_MUTED  = "#6b7280"

# ──────────────────────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────────────────────

def load_json(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return default if default is not None else {}


def latest_comparison():
    """Return the most-recent comparison dict, or {}."""
    if not COMPS_DIR.exists():
        return {}
    files = sorted(COMPS_DIR.glob("*.json"))
    if not files:
        return {}
    return load_json(files[-1])


def latest_forecast():
    """Return the most-recent Open-Meteo forecast dict, or {}."""
    if not PREDS_DIR.exists():
        return {}
    pred_dirs = sorted(PREDS_DIR.iterdir())
    for d in reversed(pred_dirs):
        om = d / "openmeteo_forecast.json"
        if om.exists():
            return load_json(om)
    return {}


# WMO weather code → emoji icon
WMO_ICONS = {
    0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
    45: "🌫", 48: "🌫",
    51: "🌦", 53: "🌧", 55: "🌧",
    56: "🌧", 57: "🌧",
    61: "🌧", 63: "🌧", 65: "🌧",
    66: "🧊", 67: "🧊",
    71: "🌨", 73: "❄️", 75: "❄️",
    77: "❄️",
    80: "🌦", 81: "🌧", 82: "⛈",
    85: "🌨", 86: "❄️",
    95: "⛈", 96: "⛈", 99: "⛈",
}


def fetch_rss(url, max_items=5):
    """Fetch an RSS/Atom feed, return list of {title, link, date, summary}."""
    import subprocess
    raw = None

    # Try curl first (more reliable with Substack/Cloudflare)
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "15",
             "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
             "-H", "Accept: application/rss+xml, application/xml, text/xml, */*",
             url],
            capture_output=True, timeout=20,
        )
        if result.returncode == 0 and result.stdout:
            raw = result.stdout
            print(f"  [RSS] fetched {len(raw)} bytes via curl from {url}")
    except Exception as e:
        print(f"  [RSS] curl failed for {url}: {e}", file=sys.stderr)

    # Fallback to urllib
    if raw is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        }
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    raw = resp.read()
                print(f"  [RSS] fetched {len(raw)} bytes via urllib from {url}")
                break
            except Exception as e:
                print(f"  [RSS] urllib attempt {attempt+1} failed for {url}: {e}", file=sys.stderr)
                if attempt < 2:
                    import time; time.sleep(2 ** attempt)

    if raw is None:
        print(f"  [RSS] all fetch methods failed for {url}", file=sys.stderr)
        return []

    # Debug: show first 300 chars of response
    print(f"  [RSS] response preview: {raw[:300]}")

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"  [RSS] XML parse error for {url}: {e}", file=sys.stderr)
        return []

    ns = {
        "atom":    "http://www.w3.org/2005/Atom",
        "media":   "http://search.yahoo.com/mrss/",
        "yt":      "http://www.youtube.com/xml/schemas/2015",
    }

    items = []

    # Atom (YouTube)
    for entry in root.findall("atom:entry", ns)[:max_items]:
        title   = entry.findtext("atom:title", "", ns)
        link_el = entry.find("atom:link", ns)
        link    = link_el.get("href", "") if link_el is not None else ""
        pub     = entry.findtext("atom:published", "", ns)[:10]
        thumb_el = entry.find(".//media:thumbnail", ns)
        thumb   = thumb_el.get("url", "") if thumb_el is not None else ""
        items.append({"title": title, "link": link, "date": pub, "thumb": thumb})

    if items:
        return items

    # RSS 2.0 (Substack)
    for item in root.findall(".//item")[:max_items]:
        title   = item.findtext("title", "")
        link    = item.findtext("link", "")
        pub     = item.findtext("pubDate", "")[:16]
        desc    = item.findtext("description", "")
        # strip HTML tags crudely
        desc = re.sub(r"<[^>]+>", "", desc)[:200].strip()
        items.append({"title": title, "link": link, "date": pub, "summary": desc})

    return items


def sweater_emoji_img(score):
    """Return sweater icon scale (0-5) using custom sweater image."""
    filled = round(score)
    empty  = 5 - filled
    imgs = (
        '<img class="sweater-icon active" src="assets/sweateremoji.webp" alt="sweater">'
    ) * filled + (
        '<img class="sweater-icon inactive" src="assets/sweateremoji.webp" alt="sweater">'
    ) * empty
    return imgs


def ray_face_img(size="2.5rem"):
    """Circle Ray face image for Right Ray / Wrong Ray verdicts."""
    return (
        f'<img src="assets/ray_face.svg" alt="Ray" '
        f'style="height:{size};width:{size};vertical-align:middle;">'
    )


def verdict_html(verdict_str, score):
    """Render verdict with ray-face icons (no text label)."""
    faces = int(round(score / 20)) if score else 0
    face_row = "".join([ray_face_img("1.6rem")] * min(faces, 5))
    return f'<span class="verdict-faces">{face_row}</span>'


def now_est():
    est = timezone(timedelta(hours=-5))
    return datetime.now(est).strftime("%B %d, %Y at %I:%M %p EST")

# ──────────────────────────────────────────────────────────────────────────────
# section builders
# ──────────────────────────────────────────────────────────────────────────────

def build_sweater_section(comp):
    sw = comp.get("sweater_weather", {})
    actuals  = comp.get("actuals", {})
    temp     = actuals.get("high_f", "?")
    verdict  = sw.get("detail", sw.get("verdict", ""))
    score    = sw.get("sweater_count", sw.get("score", 0))  # 0-5 scale
    layers   = sw.get("layers", sw.get("recommended_layers", ""))

    emoji_row = sweater_emoji_img(score)

    return f"""
<section class="card" id="sweater">
  <h2>Sweater weather in Boone?</h2>
  <div class="sweater-verdict">
    <div class="sweater-score" id="live-sweaters">{emoji_row}</div>
    <div class="sweater-temp" id="live-temp">{temp}&deg;F</div>
    <div class="sweater-high" id="live-high"></div>
    <p class="sweater-text" id="live-verdict">{verdict}</p>
    {f'<p class="sweater-layers" id="live-layers"><strong>Recommended layers:</strong> {layers}</p>' if layers else ''}
  </div>
</section>
"""


def build_rightwrong_section(comp):
    date     = comp.get("date", "")
    actual   = comp.get("actuals", comp.get("actual_weather", {}))
    sources  = comp.get("sources", comp.get("predictions", {}))

    act_high   = actual.get("high_f", "?")
    act_low    = actual.get("low_f", "?")
    act_cond   = actual.get("conditions", "")
    act_wind   = actual.get("wind_mph")
    act_precip = actual.get("precip_in")

    rows = ""
    for source_key, label, icon in [
        ("raysweather",    "Ray's Weather",    ray_face_img()),
        ("openmeteo",      "Open-Meteo",       '<span class="source-icon">🌐</span>'),
        ("apple_weather",  "Apple Weather",    '<span class="source-icon">📱</span>'),
    ]:
        p = sources.get(source_key, {})
        if not p or "score" not in p:
            continue
        pred      = p.get("prediction", {})
        score_obj = p.get("score", {})
        pred_high = pred.get("today_high_f", pred.get("high_f"))
        pred_low  = pred.get("tonight_low_f", pred.get("low_f"))
        pred_high_s = f"{pred_high}&deg;" if pred_high is not None else "N/A"
        pred_low_s  = f"{pred_low}&deg;" if pred_low is not None else "N/A"
        pred_wind = pred.get("wind_mph")
        pred_precip = pred.get("precip_in", pred.get("rainfall_in"))
        sc        = score_obj.get("score", 0) if isinstance(score_obj, dict) else 0
        grade     = score_obj.get("grade", {}) if isinstance(score_obj, dict) else {}

        shrug = r"&macr;\_(&#12484;)_/&macr;"
        # Build detail lines — always show all four stats
        detail_parts = [f'<span style="white-space:nowrap">Hi: {pred_high_s} / Lo: {pred_low_s}</span>']
        detail_parts.append(f"Wind: {round(pred_wind, 1)} mph" if pred_wind is not None else f"Wind: {shrug}")
        detail_parts.append(f'Rain: {pred_precip}"' if pred_precip is not None else f"Rain: {shrug}")

        rows += f"""
<tr>
  <td class="source-cell">
    {icon}
    <span>{label}</span>
  </td>
  <td>{"<br>".join(detail_parts)}</td>
  <td><strong>{sc:.1f}/100</strong></td>
  <td>{verdict_html("", sc)}</td>
</tr>"""

    # Build actual weather row for the table
    actual_parts = [f'<span style="white-space:nowrap">Hi: {act_high}&deg; / Lo: {act_low}&deg;</span>']
    if act_wind is not None:
        actual_parts.append(f"Wind: {round(act_wind, 1)} mph")
    if act_precip is not None:
        actual_parts.append(f'Rain: {act_precip}"')
    if act_cond:
        actual_parts.append(act_cond)
    # Format date for display (e.g. "Mar 6")
    date_label = ""
    if date:
        try:
            from datetime import datetime as _dt
            _d = _dt.strptime(date, "%Y-%m-%d")
            date_label = f' <span class="actual-date">({_d.strftime("%-m/%-d/%y")})</span>'
        except ValueError:
            pass

    actual_row = f"""
<tr class="actual-row">
  <td><strong>Actual</strong>{date_label}</td>
  <td>{"<br>".join(actual_parts)}</td>
  <td colspan="2">&mdash;</td>
</tr>"""

    return f"""
<section class="card" id="rightwrong-content">
  <h2>Right Ray / Wrong Ray</h2>
  <p class="section-subtitle">When you trust us to tell you how many rays of sunshine, golfballs, or snowmen you can expect, we need to be held to account. To that end, I'll be posting the "Right Ray, Wrong Ray" scoreboard that tracks the forecasts and compares them to the actual weather recorded each day.</p>
  <div class="table-wrap">
    <table class="scores-table">
      <thead>
        <tr><th>Source</th><th>Predicted</th><th>Score</th><th>Verdict</th></tr>
      </thead>
      <tbody>{actual_row}{rows}</tbody>
    </table>
  </div>
  <p class="rating-note"><em>Each source is scored out of 100 points across four fields: high temperature (30 pts), low temperature (30 pts), wind speed (20 pts), and precipitation (20 pts). Scores are based on how close each prediction was to actual recorded conditions. If a source doesn&rsquo;t make a prediction for a field, it scores 0 for that field &mdash; forecasting is about commitment, and sitting one out isn&rsquo;t the same as getting it right.</em></p>
</section>
"""


def build_phone_forecast(_forecast_data=None):
    """Build Apple Weather screenshot section.

    Looks for the real iPhone Weather screenshot (iphone_screenshot.png)
    uploaded daily via iOS Shortcut.
    """
    screenshot_src = None
    if PREDS_DIR.exists():
        for d in sorted(PREDS_DIR.iterdir(), reverse=True):
            shot = d / "iphone_screenshot.png"
            if shot.exists():
                screenshot_src = shot
                break

    if screenshot_src is not None:
        # Copy screenshot to docs for serving
        ss_dest = DOCS / "screenshots"
        ss_dest.mkdir(parents=True, exist_ok=True)
        shutil.copy2(screenshot_src, ss_dest / "iphone_screenshot.png")

        return """
<section class="card" id="weekly-forecast">
  <h2>Forecast</h2>
  <p class="section-subtitle">Our meteorological experts predict the following forecast</p>
  <div class="iphone-screenshot-wrap">
    <img src="screenshots/iphone_screenshot.png" alt="Apple Weather forecast for Boone, NC"
         class="iphone-screenshot" loading="lazy">
  </div>
</section>
"""

    # Fallback: no screenshot available yet
    return """
<section class="card" id="weekly-forecast">
  <h2>Forecast</h2>
  <p class="section-subtitle">iPhone Weather screenshot not available yet. Check back tomorrow!</p>
</section>
"""


def build_scoreboard_section(scores):
    if not scores:
        return ""
    rows = ""
    for src in scores.get("sources", []):
        name   = src.get("name", "")
        record = f'{src.get("wins",0)}W - {src.get("losses",0)}L - {src.get("maybes",0)}M'
        avg    = src.get("avg_score", 0)
        days   = src.get("days_tracked", 0)
        rows += f"<tr><td><strong>{name}</strong></td><td>{record}</td><td>{avg:.1f}/100</td><td>{days}</td></tr>"

    # Also support the "totals" format from the existing scores.json
    if not rows:
        for source, totals in scores.get("totals", {}).items():
            labels = {"raysweather": "Ray's Weather", "openmeteo": "Open-Meteo", "apple_weather": "Apple Weather"}
            label = labels.get(source, source)
            days = totals.get("days", 0)
            avg = round(totals.get("total_score", 0) / days, 1) if days > 0 else 0
            record = f'{totals.get("right",0)}W - {totals.get("wrong",0)}L - {totals.get("meh",0)}M'
            rows += f"<tr><td><strong>{label}</strong></td><td>{record}</td><td>{avg}/100</td><td>{days}</td></tr>"

    if not rows:
        return ""

    return f"""
<section class="card" id="scoreboard">
  <h2>Season Scoreboard</h2>
  <div class="table-wrap">
    <table class="scores-table scoreboard-table">
      <thead><tr><th>Source</th><th>Record</th><th>Avg Score</th><th>Days Tracked</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
  <p class="scoreboard-key">W = best forecast that day &middot; L = worst &middot; M = somewhere in the middle</p>
</section>
"""


def build_videos_section(items):
    if not items:
        return '<section class="card tab-panel" id="videos"><p class="empty-feed">No videos yet — check back soon.</p></section>'
    cards = ""
    for v in items:
        thumb_html = f'<img src="{v["thumb"]}" alt="" class="video-thumb">' if v.get("thumb") else ""
        cards += f"""
<a class="video-card" href="{v['link']}" target="_blank" rel="noopener">
  {thumb_html}
  <div class="video-meta">
    <p class="video-title">{v['title']}</p>
    <p class="video-date">{v['date']}</p>
  </div>
</a>"""
    return f"""
<section class="card tab-panel" id="videos">
  <h2>Videos</h2>
  <div class="video-grid">{cards}</div>
</section>
"""


def _split_content_at_first_heading(html):
    """Split HTML content into intro (before first heading h2-h4) and rest."""
    import re
    m = re.search(r'<h[234][\s>]', html)
    if m:
        return html[:m.start()], html[m.start():]
    return html, ""


def _add_heading_ids_and_toc(html, slug_prefix):
    """Add id attrs to <h2>/<h3>/<h4> tags and return (modified_html, toc_html)."""
    import re
    headings = []
    counter = [0]

    def replacer(m):
        counter[0] += 1
        tag = m.group(1)  # "h2" or "h4"
        attrs = m.group(2)
        content = m.group(3)
        hid = f"{slug_prefix}-s{counter[0]}"
        title = re.sub(r'<[^>]+>', '', content)
        level = int(tag[1])  # 2 or 4
        headings.append((hid, title, level))
        return f'<{tag} id="{hid}"{attrs}>{content}</{tag}>'

    modified = re.sub(r'<(h[234])([^>]*)>(.*?)</\1>', replacer, html)
    if not headings:
        return modified, ""
    min_level = min(h[2] for h in headings)
    links = []
    for hid, title, level in headings:
        indent_class = ' class="toc-indent"' if level > min_level else ''
        links.append(f'<li{indent_class}><a href="#{hid}" class="post-toc-link">{title}</a></li>')
    toc = f'<nav class="post-toc"><strong>In this post</strong><ul>{"".join(links)}</ul></nav>'
    return modified, toc


def build_blog_section(items):
    if not items:
        return '<section class="card tab-panel" id="blog"><p class="empty-feed">No posts yet — check back soon.</p></section>'

    # Sort posts by date, newest first
    sorted_items = sorted(items, key=lambda p: p.get("date", ""), reverse=True)

    # Build table of contents
    toc_links = ""
    for i, p in enumerate(sorted_items):
        slug = f"post-{i}"
        toc_links += f'<li><a href="#{slug}" class="toc-link">{p["title"]}</a></li>\n'
    toc = f'<nav class="blog-toc"><h3>Posts</h3><ul>{toc_links}</ul></nav>'

    # Build post articles
    posts = ""
    for i, p in enumerate(sorted_items):
        slug = f"post-{i}"
        summary = p.get("summary", "")
        content = p.get("content", "")
        if content:
            intro, rest = _split_content_at_first_heading(content)
            body = f'<div class="blog-body">{intro}</div>'
            if rest:
                rest, post_toc = _add_heading_ids_and_toc(rest, slug)
                body += f'<div class="blog-rest" id="{slug}-rest" style="display:none">{post_toc}{rest}</div>'
                body += f'<button class="blog-expand" data-target="{slug}-rest" aria-expanded="false">Read more &darr;</button>'
        elif summary:
            body = f'<p class="blog-summary">{summary}</p>'
        else:
            body = ""
        substack_link = f'<a href="{p["link"]}" target="_blank" rel="noopener" class="read-on-substack">Read on Substack &rarr;</a>'
        posts += f"""
<article class="blog-post" id="{slug}">
  <h3 class="blog-title">{p['title']}</h3>
  {body}
  {substack_link}
</article>"""
    return f"""
<section class="card tab-panel" id="blog">
  <h2>Substack</h2>
  {toc}
  <div class="blog-list">{posts}</div>
</section>
"""

# ──────────────────────────────────────────────────────────────────────────────
# Fourthwall Swag Shop
# ──────────────────────────────────────────────────────────────────────────────

def fetch_fourthwall_products():
    """Fetch products from Fourthwall Storefront API. Returns list of dicts."""
    if not FOURTHWALL_TOKEN:
        print("  [shop] FOURTHWALL_TOKEN not set, skipping product fetch")
        return []

    print(f"  [shop] token present ({len(FOURTHWALL_TOKEN)} chars, starts with {FOURTHWALL_TOKEN[:8]}…)")
    url = f"{FOURTHWALL_API}/collections/all/products?storefront_token={FOURTHWALL_TOKEN}&currency=USD"
    try:
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            body = resp.read()
            print(f"  [shop] API response: HTTP {status}, {len(body)} bytes")
            data = json.loads(body)
        results = data.get("results", data.get("products", []))
        if not results:
            print(f"  [shop] no products found. Response keys: {list(data.keys())}")
            # Print truncated response for debugging
            preview = json.dumps(data, indent=2)[:500]
            print(f"  [shop] response preview: {preview}")
        else:
            print(f"  [shop] fetched {len(results)} products from Fourthwall")
        return results
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        print(f"  [shop] Fourthwall API HTTP {e.code}: {body}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  [shop] Fourthwall API error: {e}", file=sys.stderr)
        return []


def build_shop_section(products):
    """Build the Swag Shop tab with product cards or a fallback link."""
    shop_link = f"""<a href="{FOURTHWALL_STORE}/"
       target="_blank" rel="noopener"
       style="display:inline-block;padding:.75rem 2rem;background:var(--orange);color:#fff;
              border-radius:8px;font-weight:700;font-size:1.1rem;text-decoration:none;margin-top:.5rem;">
      Visit the Swag Shop &rarr;
    </a>"""

    if not products:
        return f"""
<section class="card tab-panel" id="shop">
  <h2 style="margin:0 0 .5rem;">Swag Shop</h2>
  <p style="margin:0 0 1rem;color:var(--muted);">Official Dave's Sweater merch &mdash; powered by Fourthwall.</p>
  {shop_link}
</section>"""

    cards = ""
    for p in products:
        name = p.get("name", p.get("title", ""))
        slug = p.get("slug", p.get("handle", ""))
        product_url = f"{FOURTHWALL_STORE}/products/{slug}" if slug else f"{FOURTHWALL_STORE}/"

        # Get first image
        images = p.get("images", [])
        if images:
            img = images[0].get("url", images[0].get("src", ""))
        else:
            img = ""

        # Get price from variants
        variants = p.get("variants", [])
        price_str = ""
        if variants:
            price_obj = variants[0].get("unitPrice", variants[0].get("price", {}))
            if isinstance(price_obj, dict):
                amount = price_obj.get("value", price_obj.get("amount", ""))
                currency = price_obj.get("currency", "USD")
                if amount:
                    try:
                        price_str = f"${float(amount) / 100:.2f}" if float(amount) > 100 else f"${float(amount):.2f}"
                    except (ValueError, TypeError):
                        price_str = f"${amount}"
            elif isinstance(price_obj, (int, float)):
                price_str = f"${price_obj:.2f}"

        img_html = f'<img src="{img}" alt="{name}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;">' if img else ""
        price_html = f'<span style="font-weight:700;color:var(--orange);">{price_str}</span>' if price_str else ""

        cards += f"""
    <a href="{product_url}" target="_blank" rel="noopener"
       style="display:block;text-decoration:none;color:inherit;background:var(--card);
              border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;transition:box-shadow .2s;">
      {img_html}
      <div style="padding:.75rem;">
        <div style="font-weight:600;font-size:.95rem;margin-bottom:.25rem;">{name}</div>
        {price_html}
      </div>
    </a>"""

    return f"""
<section class="card tab-panel" id="shop">
  <h2 style="margin:0 0 .5rem;">Swag Shop</h2>
  <p style="margin:0 0 1rem;color:var(--muted);">Official Dave's Sweater merch &mdash; powered by Fourthwall.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
    {cards}
  </div>
  {shop_link}
</section>"""


# ──────────────────────────────────────────────────────────────────────────────
# logo SVG (inline fallback if file not found)
# ──────────────────────────────────────────────────────────────────────────────

def logo_html():
    logo_file = ASSETS_SRC / "logo.svg"
    if logo_file.exists():
        svg_text = logo_file.read_text()
        # inject sizing
        svg_text = svg_text.replace("<svg ", '<svg style="height:4.5rem;width:auto;" ', 1)
        return svg_text
    # text fallback
    return (
        '<span style="font-weight:800;font-size:1.25rem;letter-spacing:-0.03em;color:#fff;">'
        "Dave's Sweater</span>"
    )

# ──────────────────────────────────────────────────────────────────────────────
# CSS
# ──────────────────────────────────────────────────────────────────────────────

CSS = f"""
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

:root {{
  --teal:   {COLOR_TEAL};
  --orange: {COLOR_ORANGE};
  --bg:     {COLOR_BG};
  --card:   {COLOR_CARD};
  --text:   {COLOR_TEXT};
  --muted:  {COLOR_MUTED};
  --radius: 0.75rem;
}}

body {{
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  line-height: 1.6;
  min-height: 100vh;
}}

/* ── header ── */
header {{
  background: var(--teal);
  border-bottom: 4px solid var(--orange);
  padding: 0.5rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
  min-height: 5.5rem;
}}

.header-logo {{
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  flex-shrink: 0;
}}

.header-tagline {{
  color: rgba(255,255,255,0.75);
  font-size: 0.95rem;
  font-style: italic;
  white-space: nowrap;
}}

/* ── nav tabs ── */
nav {{
  margin-left: auto;
  display: flex;
  gap: 0.15rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}}

nav button {{
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.75);
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  border-radius: 0.4rem;
  transition: background 0.15s, color 0.15s;
}}

nav button:hover,
nav button.active {{
  background: rgba(255,255,255,0.15);
  color: #fff;
}}

nav button.active {{
  background: var(--orange);
  color: #fff;
}}

/* ── update bar ── */
.update-bar {{
  background: var(--orange);
  color: #fff;
  text-align: center;
  font-size: 0.78rem;
  padding: 0.3rem 1rem;
  font-weight: 500;
}}

/* ── main ── */
main {{
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}}

/* ── cards ── */
.card {{
  background: var(--card);
  border: 1px solid #e5e7eb;
  border-radius: var(--radius);
  padding: 1.5rem 1.75rem;
}}

.card h2 {{
  font-size: 1.15rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--teal);
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--orange);
  padding-bottom: 0.4rem;
  display: inline-block;
}}

/* ── sweater section ── */
.sweater-verdict {{
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}}

.sweater-score {{
  display: flex;
  gap: 0.35rem;
  align-items: center;
  margin-bottom: 0.25rem;
}}

.sweater-icon {{
  height: 2.5rem;
  width: auto;
  vertical-align: middle;
}}

.sweater-icon.inactive {{
  opacity: 0.18;
}}

.sweater-temp {{
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--teal);
}}

.sweater-high {{
  font-size: 0.95rem;
  color: var(--muted);
  margin-top: 0.2rem;
}}

.sweater-text {{
  font-size: 1.05rem;
  color: var(--text);
}}

.sweater-layers {{
  font-size: 0.9rem;
  color: var(--muted);
}}

/* ── tables ── */
.table-wrap {{
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}}

.scores-table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}}

.scores-table th {{
  background: var(--teal);
  color: #fff;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0.35rem 0.3rem;
  text-align: left;
}}

.scores-table th:first-child {{
  padding-left: 0.6rem;
}}

.scores-table th:nth-child(2) {{
  padding-left: 0.6rem;
}}

.scores-table td {{
  padding: 0.4rem 0.3rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
  font-size: 0.76rem;
}}

.scores-table td:first-child {{
  padding-left: 0.6rem;
}}

.scores-table td:nth-child(2) {{
  padding-left: 0.6rem;
}}

.scoreboard-table {{
  table-layout: auto;
}}

.scoreboard-key {{
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.6rem;
  text-align: center;
  font-style: italic;
}}

.scores-table tr:last-child td {{ border-bottom: none; }}
.scores-table tr:hover td {{ background: rgba(60,84,104,0.04); }}
.actual-row td {{ background: #f0f7fa; font-weight: 500; }}

.source-cell {{
  display: flex;
  align-items: center;
  gap: 0.3rem;
}}

.verdict-label {{ display: block; font-size: 0.7rem; font-weight: 600; }}
.verdict-faces {{ display: flex; flex-wrap: wrap; gap: 0.1rem; }}

.source-icon {{ font-size: 1.4rem; }}

.verdict-label {{
  font-weight: 600;
  font-size: 0.82rem;
  margin-right: 0.35rem;
}}

/* ── section meta ── */
.section-date,
.actual-weather,
.rating-note,
.screenshot-label,
.screenshot-credit {{
  font-size: 0.88rem;
  color: var(--muted);
  margin-bottom: 0.75rem;
}}

.actual-weather {{ color: var(--text); font-size: 0.95rem; }}

/* ── iPhone screenshot ── */
.iphone-screenshot-wrap {{
  text-align: center;
  margin: 1rem 0;
}}
.iphone-screenshot {{
  max-width: 320px;
  width: 100%;
  border-radius: 2rem;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  border: 3px solid #3a3a3c;
}}
.section-subtitle {{
  color: {COLOR_MUTED};
  font-size: 0.9rem;
  margin-top: -0.25rem;
  margin-bottom: 1.2rem;
}}

/* ── tab panels ── */
.tab-panel {{ display: none; }}
.tab-panel.active {{ display: block; }}

/* ── videos ── */
.video-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1rem;
  margin-top: 0.75rem;
}}

.video-card {{
  text-decoration: none;
  color: var(--text);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: box-shadow 0.15s;
}}

.video-card:hover {{ box-shadow: 0 4px 12px rgba(0,0,0,0.1); }}

.video-thumb {{
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  display: block;
}}

.video-meta {{ padding: 0.6rem 0.75rem; }}

.video-title {{
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.35;
}}

.video-date {{ font-size: 0.78rem; color: var(--muted); margin-top: 0.2rem; }}

/* ── blog ── */
.blog-toc, .post-toc {{
  text-align: center;
}}

.blog-toc ul, .post-toc ul {{
  display: inline-block;
  text-align: left;
}}

.blog-toc {{
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem 1.2rem;
  margin-bottom: 1.5rem;
}}
.blog-toc h3 {{ font-size: 0.95rem; color: var(--teal); margin-bottom: 0.6rem; }}
.blog-toc ul {{ list-style: none; padding: 0; margin: 0; }}
.blog-toc li {{ margin-bottom: 0.35rem; padding-left: 0.5rem; }}
.toc-link {{ color: var(--teal); text-decoration: none; font-weight: 500; font-size: 0.9rem; }}
.toc-link:hover {{ text-decoration: underline; }}

.blog-list {{ display: flex; flex-direction: column; gap: 1.5rem; margin-top: 0.5rem; }}

.blog-post {{
  padding: 1.2rem 1.4rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  border-left: 3px solid var(--orange);
}}

.blog-title {{
  font-weight: 600;
  font-size: 1.2rem;
  color: var(--teal);
  margin-bottom: 0.2rem;
}}

.blog-summary {{ font-size: 0.88rem; color: #4b5563; }}

.post-toc {{
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.4rem;
  padding: 0.8rem 1rem;
  margin-bottom: 1.2rem;
}}
.post-toc strong {{ font-size: 0.85rem; color: var(--teal); display: block; margin-bottom: 0.4rem; }}
.post-toc ul {{ list-style: none; padding-left: 0.8rem; margin: 0; }}
.post-toc li {{ margin-bottom: 0.25rem; }}
.post-toc-link {{ color: var(--orange); text-decoration: none; font-size: 0.85rem; font-weight: 500; }}
.post-toc-link:hover {{ text-decoration: underline; }}
.toc-indent {{ padding-left: 1rem; }}

.blog-body, .blog-rest {{ font-size: 0.92rem; color: #374151; line-height: 1.7; }}
.blog-body h2, .blog-rest h2 {{ color: var(--teal); margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.15rem; }}
.blog-body h3, .blog-rest h3 {{ color: var(--teal); margin-top: 1.2rem; margin-bottom: 0.4rem; font-size: 1.05rem; }}
.blog-body h4, .blog-rest h4 {{ color: var(--teal); margin-top: 1rem; margin-bottom: 0.4rem; font-size: 0.95rem; }}
.blog-body p, .blog-rest p {{ margin-bottom: 0.8rem; }}
.blog-body ul, .blog-rest ul {{ padding-left: 1.5rem; margin-bottom: 0.8rem; }}
.blog-body li, .blog-rest li {{ margin-bottom: 0.3rem; }}
.blog-body strong, .blog-rest strong {{ color: var(--teal); }}

.blog-expand {{
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--orange);
  border-radius: 0.4rem;
  color: var(--orange);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}}
.blog-expand:hover {{ background: var(--orange); color: #fff; }}

.read-on-substack {{
  display: inline-block;
  margin-top: 1rem;
  color: var(--orange);
  font-weight: 600;
  font-size: 0.88rem;
  text-decoration: none;
}}
.read-on-substack:hover {{ text-decoration: underline; }}

/* ── empty feed ── */
.empty-feed {{ color: var(--muted); font-style: italic; padding: 1rem 0; }}

/* ── footer ── */
footer {{
  text-align: center;
  padding: 1.25rem 1rem;
  color: var(--muted);
  font-size: 0.8rem;
  border-top: 1px solid #e5e7eb;
}}

footer a {{ color: var(--teal); text-decoration: none; }}
footer a:hover {{ text-decoration: underline; }}

/* ── responsive ── */
@media (max-width: 600px) {{
  header {{ flex-wrap: wrap; padding: 0.5rem 1rem; gap: 0.3rem; }}
  .header-tagline {{ font-size: 0.72rem; white-space: normal; flex: 1; min-width: 0; }}
  nav {{ margin-left: 0; width: 100%; justify-content: flex-start; }}
  .sweater-temp {{ font-size: 2rem; }}
  .source-icon, .source-cell img {{ display: none; }}
  .scores-table {{ font-size: 0.68rem; table-layout: auto; }}
  .scores-table th {{ font-size: 0.6rem; padding: 0.3rem 0.25rem; }}
  .scores-table td {{ padding: 0.35rem 0.25rem; }}
  .scores-table td:nth-child(3),
  .scores-table th:nth-child(3) {{ font-size: 0.62rem; }}
  .scores-table td:nth-child(3) strong {{ font-size: 0.62rem; }}
  .verdict-label {{ font-size: 0.68rem; }}
  .verdict-faces img {{ width: 1.3rem !important; height: 1.3rem !important; }}
}}
"""

# ──────────────────────────────────────────────────────────────────────────────
# JS
# ──────────────────────────────────────────────────────────────────────────────

JS = """
(function() {
  const TABS = ['weather', 'rightwrong', 'videos', 'blog', 'shop'];

  function activate(tab) {
    // nav buttons
    document.querySelectorAll('nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // weather sections (non-tab-panel cards inside #weather-content)
    const weatherContent = document.getElementById('weather-content');
    if (weatherContent) {
      weatherContent.style.display = (tab === 'weather') ? 'contents' : 'none';
    }
    // tab panels
    document.querySelectorAll('.tab-panel').forEach(el => {
      el.classList.toggle('active', el.id === tab);
    });
    history.replaceState(null, '', '#' + tab);
  }

  document.querySelectorAll('nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  // on load, check hash
  const hash = location.hash.replace('#', '');
  activate(TABS.includes(hash) ? hash : 'weather');
})();

// ── Blog expand / collapse ──
document.querySelectorAll('.blog-expand').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var target = document.getElementById(btn.dataset.target);
    if (!target) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    target.style.display = expanded ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.innerHTML = expanded ? 'Read more &darr;' : 'Show less &uarr;';
  });
});

// ── Live temperature from Open-Meteo (Boone, NC) ──
(function() {
  var BOONE_LAT = 36.2168, BOONE_LON = -81.6746;
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + BOONE_LAT
    + '&longitude=' + BOONE_LON
    + '&current=temperature_2m,wind_speed_10m,relative_humidity_2m,apparent_temperature'
    + '&daily=temperature_2m_max&forecast_days=1'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York';

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var c = data.current;
      if (!c || c.temperature_2m == null) return;
      var temp = Math.round(c.temperature_2m * 10) / 10;
      var wind = c.wind_speed_10m || 0;

      // Update temperature display
      var el = document.getElementById('live-temp');
      if (el) el.innerHTML = temp + '&deg;F <span style=\"font-size:0.5em;color:#999;\">now</span>';

      // Update projected high
      var hiEl = document.getElementById('live-high');
      if (hiEl && data.daily && data.daily.temperature_2m_max) {
        var high = Math.round(data.daily.temperature_2m_max[0]);
        hiEl.innerHTML = 'High of ' + high + '&deg;F today';
      }

      // Update sweater verdict using blended formula
      var high = (data.daily && data.daily.temperature_2m_max) ? data.daily.temperature_2m_max[0] : temp;
      var effective = (high * 0.5) + (temp * 0.5);
      var verdict, layers;
      if (effective < 35) {
        verdict = "That's not sweater weather, that's SWEATER EMERGENCY.";
        layers = "3+ (sweater, fleece, AND a coat)";
      } else if (effective < 45) {
        verdict = "Classic sweater weather. This is what we're here for.";
        layers = "2 (solid sweater + optional layer)";
      } else if (effective < 55) {
        verdict = "Still sweater territory. Don't let anyone tell you otherwise.";
        layers = "1-2 (light to medium sweater)";
      } else if (effective < 65) {
        verdict = "You could go either way. Bring it and decide later.";
        layers = "0-1 (light layer, keep one in the car)";
      } else if (effective < 75) {
        verdict = "No sweater needed unless you're in aggressive AC.";
        layers = "0 (the sweater rests today)";
      } else {
        verdict = "Wearing a sweater would be a cry for help.";
        layers = "0 (this is shorts weather, Dave)";
      }

      // Compute sweater score (0-5)
      var score;
      if (effective < 35) score = 5;
      else if (effective < 45) score = 4;
      else if (effective < 55) score = 3;
      else if (effective < 65) score = 2;
      else if (effective < 75) score = 1;
      else score = 0;

      // Update sweater icons
      var sEl = document.getElementById('live-sweaters');
      if (sEl) {
        var icons = sEl.querySelectorAll('.sweater-icon');
        for (var i = 0; i < icons.length; i++) {
          if (i < score) {
            icons[i].className = 'sweater-icon active';
          } else {
            icons[i].className = 'sweater-icon inactive';
          }
        }
      }

      var vEl = document.getElementById('live-verdict');
      if (vEl) vEl.textContent = verdict;
      var lEl = document.getElementById('live-layers');
      if (lEl) lEl.innerHTML = '<strong>Recommended layers:</strong> ' + layers;
    })
    .catch(function() { /* keep static fallback */ });
})();
"""

# ──────────────────────────────────────────────────────────────────────────────
# page assembly
# ──────────────────────────────────────────────────────────────────────────────

def build_page(comp, scores, video_items, blog_items, forecast=None, shop_products=None):
    updated = now_est()

    weather_sections = (
        build_sweater_section(comp) +
        build_phone_forecast(forecast or {})
    )

    rightwrong_sections = (
        build_rightwrong_section(comp) +
        build_scoreboard_section(scores)
    )

    videos_section = build_videos_section(video_items)
    blog_section   = build_blog_section(blog_items)
    shop_section   = build_shop_section(shop_products or [])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dave's Sweater &mdash; Boone's most mostly reliable weather tracker and resource</title>
  <meta name="description" content="Is it sweater weather in Boone, NC? Did Ray get yesterday right? Find out.">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <meta name="google-site-verification" content="WvhDdIhrlNBhsVYElbFc39q-Ib8J2UZZJKoy8pzn-KQ">
  <style>{CSS}</style>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7XL0TZ4GSS"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-7XL0TZ4GSS');
  </script>
</head>
<body>

<header>
  <a class="header-logo" href="/">
    {logo_html()}
  </a>
  <span class="header-tagline">Boone's most mostly reliable weather tracker and resource</span>
  <nav>
    <button data-tab="weather">Weather</button>
    <button data-tab="rightwrong">Right/Wrong Ray</button>
    <button data-tab="videos">Videos</button>
    <button data-tab="blog">Blog</button>
    <button data-tab="shop">Swag Shop</button>
  </nav>
</header>

<div class="update-bar">Updated: {updated}</div>

<main>
  <!-- weather tab -->
  <div id="weather-content" style="display:contents;">
    {weather_sections}
  </div>

  <!-- right ray / wrong ray tab -->
  <div class="tab-panel" id="rightwrong">
    {rightwrong_sections}
  </div>

  <!-- videos tab -->
  {videos_section}

  <!-- blog tab -->
  {blog_section}

  <!-- swag shop tab -->
  {shop_section}

</main>

<footer>
  <p>
    <a href="https://davessweater.com">DavesSweater.com</a> &nbsp;&middot;&nbsp;
    Est. 2026
  </p>
</footer>

<script>{JS}</script>

</body>
</html>
"""

# ──────────────────────────────────────────────────────────────────────────────
# asset copy
# ──────────────────────────────────────────────────────────────────────────────

def copy_assets():
    """Copy assets/ → docs/assets/ and screenshots/ → docs/screenshots/."""
    DOCS.mkdir(exist_ok=True)
    ASSETS_DEST.mkdir(exist_ok=True)

    # assets/
    if ASSETS_SRC.exists():
        for f in ASSETS_SRC.iterdir():
            if f.is_file():
                dest = ASSETS_DEST / f.name
                shutil.copy2(f, dest)
                print(f"  copied asset: {f.name}")

    # (Ray's screenshot copy removed — replaced by phone-style forecast widget)

    # Always preserve the CNAME file (GitHub Pages custom domain)
    cname_path = DOCS / "CNAME"
    if not cname_path.exists():
        cname_path.write_text("davessweater.com\n")
        print(f"  Created CNAME: {cname_path}")

# ──────────────────────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("🧣 Building Dave's Sweater…")

    # load data
    comp     = latest_comparison()
    scores   = load_json(SCORES_FILE, default={})
    forecast = latest_forecast()

    # load Substack blog posts (cached by fetch_substack.py via Playwright)
    substack_cache = ROOT / "data" / "substack_feed.json"
    if substack_cache.exists():
        blog_items = json.loads(substack_cache.read_text())
        print(f"  loaded {len(blog_items)} blog posts from cache")
    else:
        print("  fetching Substack RSS (live)…")
        blog_items = fetch_rss(SUBSTACK_RSS)

    print("  fetching YouTube RSS…")
    video_items = fetch_rss(YOUTUBE_RSS)

    print("  fetching Fourthwall products…")
    shop_products = fetch_fourthwall_products()

    # copy assets
    print("  copying assets…")
    copy_assets()

    # build HTML
    html = build_page(comp, scores, video_items, blog_items, forecast, shop_products)
    out  = DOCS / "index.html"
    out.write_text(html, encoding="utf-8")

    kb = len(html.encode()) / 1024
    print(f"✅ Wrote {out} ({kb:.1f} KB)")
    if comp:
        print(f"   date: {comp.get('date', '?')}")
    if not blog_items:
        print("   ⚠  No Substack posts fetched (feed empty or error)")


if __name__ == "__main__":
    main()
