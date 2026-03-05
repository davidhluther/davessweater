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

# ── RSS feeds ──────────────────────────────────────────────────────────────────

SUBSTACK_RSS = "https://davessweater.substack.com/feed"
YOUTUBE_UC   = "UCxxxxxxxxxxxxxxxxxxxxxxxx"          # ← user: replace with real channel ID
YOUTUBE_RSS  = f"https://www.youtube.com/feeds/videos.xml?channel_id={YOUTUBE_UC}"

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


def fetch_rss(url, max_items=5):
    """Fetch an RSS/Atom feed, return list of {title, link, date, summary}."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "DavesSweater/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
    except Exception as e:
        print(f"  [RSS] could not fetch {url}: {e}", file=sys.stderr)
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
    """Return an <img> for the sweater graphic scaled by score (0-5)."""
    filled = round(score)
    empty  = 5 - filled
    imgs   = (
        '<img src="assets/sweater.png" alt="🧥" '
        'style="height:2rem;width:auto;vertical-align:middle;opacity:1;">'
    ) * filled + (
        '<img src="assets/sweater.png" alt="🧥" '
        'style="height:2rem;width:auto;vertical-align:middle;opacity:0.18;">'
    ) * empty
    return imgs


def ray_face_img(size="2.5rem"):
    """Circle-cropped Ray face image for Right Ray / Wrong Ray verdicts."""
    return (
        f'<img src="assets/ray_face.webp" alt="Ray" '
        f'style="height:{size};width:{size};border-radius:50%;object-fit:cover;'
        f'object-position:center top;vertical-align:middle;">'
    )


def verdict_html(verdict_str, score):
    """Render verdict with ray-face icons instead of emoji."""
    # strip trailing emoji and replace with ray faces
    clean = verdict_str.split("\U0001f60e")[0].strip().rstrip("\u274c\U0001f937\u2705").strip()
    faces = int(round(score / 20)) if score else 0
    face_row = "".join([ray_face_img("1.6rem")] * min(faces, 5))
    return f'<span class="verdict-label">{clean}</span> {face_row}'


def now_est():
    est = timezone(timedelta(hours=-5))
    return datetime.now(est).strftime("%B %d, %Y at %I:%M %p EST")

# ──────────────────────────────────────────────────────────────────────────────
# section builders
# ──────────────────────────────────────────────────────────────────────────────

def build_sweater_section(comp):
    sw = comp.get("sweater_weather", {})
    temp     = sw.get("temperature_f", "?")
    verdict  = sw.get("verdict", "")
    score    = sw.get("score", 0)           # 0-5 float
    layers   = sw.get("recommended_layers", "")

    emoji_row = sweater_emoji_img(score)

    return f"""
<section class="card" id="sweater">
  <h2>Is it sweater weather in Boone?</h2>
  <div class="sweater-verdict">
    <div class="sweater-score">{emoji_row}</div>
    <div class="sweater-temp">{temp}&deg;F</div>
    <p class="sweater-text">{verdict}</p>
    {f'<p class="sweater-layers"><strong>Recommended layers:</strong> {layers}</p>' if layers else ''}
  </div>
</section>
"""


def build_current_conditions(comp):
    """Mini-panel showing current live conditions from Ray's station."""
    cur = comp.get("rays_current", {})
    if not cur:
        return ""

    def item(label, value):
        if value is None:
            return ""
        return (f'<div class="cond-item">'
                f'<span class="cond-label">{label}</span>'
                f'<span class="cond-value">{value}</span>'
                f'</div>')

    temp      = cur.get("temp_f")
    feels     = cur.get("feels_like_f")
    wind      = cur.get("wind")
    gust      = cur.get("gust_mph")
    humidity  = cur.get("humidity_pct")
    rainfall  = cur.get("rainfall_in")

    rows = (
        item("Temp",       f"{temp}&deg;F"   if temp     is not None else None) +
        item("Feels Like", f"{feels}&deg;F"  if feels    is not None else None) +
        item("Wind",       wind) +
        item("Gust",       f"{gust} mph"     if gust     is not None else None) +
        item("Humidity",   f"{humidity}%"    if humidity is not None else None) +
        item("Rainfall",   f'{rainfall}"'    if rainfall is not None else None)
    )

    if not rows.strip():
        return ""

    return f"""
  <div class="current-conditions">
    <div class="cond-header">📡 Current conditions (Ray's station)</div>
    {rows}
  </div>"""


def build_rightwrong_section(comp):
    date     = comp.get("date", "")
    actual   = comp.get("actual_weather", {})
    preds    = comp.get("predictions", {})

    act_high = actual.get("high_f", "?")
    act_low  = actual.get("low_f", "?")
    act_cond = actual.get("conditions", "")

    rows = ""
    for source_key, label in [("openmeteo", "Open-Meteo"), ("rays", "Ray's Weather")]:
        p = preds.get(source_key, {})
        pred_high = p.get("predicted_high", "None")
        pred_low  = p.get("predicted_low", "None")
        sc        = p.get("score", 0)
        verd      = p.get("verdict", "")
        rows += f"""
<tr>
  <td class="source-cell">
    {ray_face_img() if source_key == "rays" else '<span class="source-icon">🌐</span>'}
    <span>{label}</span>
  </td>
  <td>Hi: {pred_high}&deg; / Lo: {pred_low}&deg;</td>
  <td><strong>{sc:.1f}/100</strong></td>
  <td>{verdict_html(verd, sc)}</td>
</tr>"""

    screenshot_path = f"screenshots/rays_forecast.png"

    return f"""
<section class="card" id="rightwrong">
  <h2>Right Ray / Wrong Ray</h2>
  <p class="section-date">{date}</p>
  <p class="actual-weather">
    <strong>Actual weather:</strong> High {act_high}&deg;F / Low {act_low}&deg;F &mdash; {act_cond}
  </p>
  {build_current_conditions(comp)}
  <div class="table-wrap">
    <table class="scores-table">
      <thead>
        <tr><th>Source</th><th>Predicted</th><th>Score</th><th>Verdict</th></tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
  <p class="rating-note">Rating: 5 Rays = nailed it &nbsp;|&nbsp; 1 Ray = yikes</p>
  <div class="screenshot-block">
    <p class="screenshot-label">Ray's forecast screenshot:</p>
    <img src="{screenshot_path}" alt="Ray's Weather forecast" class="forecast-screenshot">
    <p class="screenshot-credit">Screenshot from <a href="https://raysweather.com/Forecast/Boone">raysweather.com</a>. Go visit Ray, he's great.</p>
  </div>
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

    return f"""
<section class="card" id="scoreboard">
  <h2>Season Scoreboard</h2>
  <div class="table-wrap">
    <table class="scores-table">
      <thead><tr><th>Source</th><th>Record</th><th>Avg Score</th><th>Days Tracked</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
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


def build_blog_section(items):
    if not items:
        return '<section class="card tab-panel" id="blog"><p class="empty-feed">No posts yet — check back soon.</p></section>'
    posts = ""
    for p in items:
        summary = p.get("summary", "")
        posts += f"""
<article class="blog-post">
  <a href="{p['link']}" target="_blank" rel="noopener" class="blog-title">{p['title']}</a>
  <p class="blog-date">{p['date']}</p>
  {f'<p class="blog-summary">{summary}</p>' if summary else ''}
</article>"""
    return f"""
<section class="card tab-panel" id="blog">
  <h2>Blog</h2>
  <div class="blog-list">{posts}</div>
</section>
"""

# ──────────────────────────────────────────────────────────────────────────────
# logo SVG (inline fallback if file not found)
# ──────────────────────────────────────────────────────────────────────────────

def logo_html():
    logo_file = ASSETS_SRC / "logo.svg"
    if logo_file.exists():
        svg_text = logo_file.read_text()
        # inject sizing
        svg_text = svg_text.replace("<svg ", '<svg style="height:2.5rem;width:auto;" ', 1)
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
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
  min-height: 4rem;
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
  font-size: 0.82rem;
  font-style: italic;
  white-space: nowrap;
}}

/* ── nav tabs ── */
nav {{
  margin-left: auto;
  display: flex;
  gap: 0.25rem;
}}

nav button {{
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.75);
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 0.4rem;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
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
  font-size: 0;   /* hide alt text */
  display: flex;
  gap: 0.35rem;
  align-items: center;
  margin-bottom: 0.25rem;
}}

.sweater-temp {{
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--teal);
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
  font-size: 0.9rem;
}}

.scores-table th {{
  background: var(--teal);
  color: #fff;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem;
  text-align: left;
}}

.scores-table td {{
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}}

.scores-table tr:last-child td {{ border-bottom: none; }}
.scores-table tr:hover td {{ background: rgba(60,84,104,0.04); }}

.source-cell {{
  display: flex;
  align-items: center;
  gap: 0.5rem;
}}

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

/* ── current conditions panel ── */
.current-conditions {{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.6rem;
  margin: 0.75rem 0 1rem;
  padding: 0.85rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-left: 3px solid var(--teal);
  border-radius: 0.5rem;
}}

.cond-item {{
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}}

.cond-header {{
  grid-column: 1/-1;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 0.2rem;
}}

.cond-label {{
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}}

.cond-value {{
  font-size: 1rem;
  font-weight: 700;
  color: var(--teal);
}}

/* ── forecast screenshot ── */
.screenshot-block {{
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}}

.forecast-screenshot {{
  width: 100%;
  max-width: 36rem;
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  margin: 0.5rem 0;
  display: block;
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
.blog-list {{ display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem; }}

.blog-post {{
  padding: 0.9rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  border-left: 3px solid var(--orange);
}}

.blog-title {{
  font-weight: 600;
  font-size: 1rem;
  color: var(--teal);
  text-decoration: none;
  display: block;
  margin-bottom: 0.2rem;
}}

.blog-title:hover {{ text-decoration: underline; }}

.blog-date {{ font-size: 0.78rem; color: var(--muted); margin-bottom: 0.4rem; }}

.blog-summary {{ font-size: 0.88rem; color: #4b5563; }}

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
  header {{ flex-wrap: wrap; padding: 0.5rem 1rem; gap: 0.5rem; }}
  nav {{ margin-left: 0; width: 100%; justify-content: flex-start; overflow-x: auto; }}
  .header-tagline {{ display: none; }}
  .sweater-temp {{ font-size: 2rem; }}
}}
"""

# ──────────────────────────────────────────────────────────────────────────────
# JS
# ──────────────────────────────────────────────────────────────────────────────

JS = """
(function() {
  const TABS = ['weather', 'videos', 'blog'];

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
"""

# ──────────────────────────────────────────────────────────────────────────────
# page assembly
# ──────────────────────────────────────────────────────────────────────────────

def build_page(comp, scores, video_items, blog_items):
    updated = now_est()

    weather_sections = (
        build_sweater_section(comp) +
        build_rightwrong_section(comp) +
        build_scoreboard_section(scores)
    )

    videos_section = build_videos_section(video_items)
    blog_section   = build_blog_section(blog_items)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dave's Sweater &mdash; Boone, NC's #2 weather resource</title>
  <meta name="description" content="Is it sweater weather in Boone, NC? Did Ray get yesterday right? Find out.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>{CSS}</style>
</head>
<body>

<header>
  <a class="header-logo" href="/">
    {logo_html()}
  </a>
  <span class="header-tagline">Boone, NC's #2 weather resource</span>
  <nav>
    <button data-tab="weather">Weather</button>
    <button data-tab="videos">Videos</button>
    <button data-tab="blog">Blog</button>
  </nav>
</header>

<div class="update-bar">Updated: {updated}</div>

<main>
  <!-- weather tab: sweater + right/wrong + scoreboard -->
  <div id="weather-content" style="display:contents;">
    {weather_sections}
  </div>

  <!-- videos tab -->
  {videos_section}

  <!-- blog tab -->
  {blog_section}

</main>

<footer>
  <p>
    <a href="https://davessweater.com">davessweater.com</a> &nbsp;&middot;&nbsp;
    est. 2026 &nbsp;&middot;&nbsp;
    Weather data: <a href="https://open-meteo.com">Open-Meteo</a>
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

    # screenshots (Ray forecast PNGs live in data/predictions/*/rays_forecast.png)
    # We symlink or copy the latest one to docs/screenshots/rays_forecast.png
    screenshots_dest = DOCS / "screenshots"
    screenshots_dest.mkdir(exist_ok=True)
    pred_dirs = sorted((DATA / "predictions").glob("*/")) if (DATA / "predictions").exists() else []
    if pred_dirs:
        latest_ss = pred_dirs[-1] / "rays_forecast.png"
        if latest_ss.exists():
            shutil.copy2(latest_ss, screenshots_dest / "rays_forecast.png")
            print(f"  copied screenshot from {pred_dirs[-1].name}")

# ──────────────────────────────────────────────────────────────────────────────
# main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("🧣 Building Dave's Sweater…")

    # load data
    comp   = latest_comparison()
    scores = load_json(SCORES_FILE, default={})

    # fetch RSS
    print("  fetching Substack RSS…")
    blog_items = fetch_rss(SUBSTACK_RSS)

    print("  fetching YouTube RSS…")
    if "xxxxxxxx" in YOUTUBE_UC:
        print("  (YouTube channel ID is placeholder — skipping)")
        video_items = []
    else:
        video_items = fetch_rss(YOUTUBE_RSS)

    # copy assets
    print("  copying assets…")
    copy_assets()

    # build HTML
    html = build_page(comp, scores, video_items, blog_items)
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
