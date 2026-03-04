#!/usr/bin/env python3
"""
build_site.py - Generate the comically underdeveloped DavesSweater.com
"""

import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

EST = timezone(timedelta(hours=-5))
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SITE_DIR = BASE_DIR / "docs"

# Ray's face as base64
_asset_path = BASE_DIR / "assets" / "ray_face_b64.txt"
RAY_FACE_B64 = ""
if _asset_path.exists():
    RAY_FACE_B64 = _asset_path.read_text().strip()


def get_latest_comparison():
    comp_dir = DATA_DIR / "comparisons"
    if not comp_dir.exists():
        return None
    files = sorted(comp_dir.glob("*.json"), reverse=True)
    if not files:
        return None
    with open(files[0]) as f:
        return json.load(f)


def get_scores():
    scores_path = DATA_DIR / "scores.json"
    if not scores_path.exists():
        return None
    with open(scores_path) as f:
        return json.load(f)


def get_current_sweater_check():
    today = datetime.now(EST).strftime("%Y-%m-%d")
    forecast_path = DATA_DIR / "predictions" / today / "openmeteo_forecast.json"
    if not forecast_path.exists():
        return None
    with open(forecast_path) as f:
        data = json.load(f)
    current = data.get("current", {})
    from compare import is_sweater_weather
    return is_sweater_weather(current.get("temp_f"), current.get("wind_mph", 0))


def sweater_scale_html(count):
    """5-sweater emoji scale."""
    parts = []
    for i in range(5):
        if i < count:
            parts.append('<span class="sweater-icon active">&#129509;</span>')
        else:
            parts.append('<span class="sweater-icon inactive">&#129509;</span>')
    return '<span class="scale">' + "".join(parts) + '</span>'


def ray_scale_html(count):
    """5-Ray-face scale using his actual headshot."""
    if not RAY_FACE_B64:
        parts = []
        for i in range(5):
            cls = "active" if i < count else "inactive"
            parts.append(f'<span class="ray-emoji {cls}">&#128526;</span>')
        return '<span class="scale">' + "".join(parts) + '</span>'

    parts = []
    for i in range(5):
        cls = "ray-active" if i < count else "ray-inactive"
        parts.append(f'<img src="data:image/jpeg;base64,{RAY_FACE_B64}" class="ray-face {cls}" alt="Ray">')
    return '<span class="scale">' + "".join(parts) + '</span>'


def build_sweater_section(sweater_data):
    if not sweater_data:
        return """
        <div class="section sweater-check">
            <h2>IS IT SWEATER WEATHER?</h2>
            <p class="big-answer">&#175;\\_(&#12484;)_/&#175;</p>
            <p>No data yet. Try again after 7 AM.</p>
        </div>"""

    answer = sweater_data["answer"]
    count = sweater_data.get("sweater_count", 0)
    if answer in ("YES", "ABSOLUTELY"):
        color = "#2D5A47"
    elif answer == "MAYBE":
        color = "#C9A227"
    else:
        color = "#8B0000"
    scale = sweater_scale_html(count)

    return f"""
    <div class="section sweater-check">
        <h2>IS IT SWEATER WEATHER IN BOONE?</h2>
        <p class="big-answer" style="color: {color};">{answer}</p>
        <div class="scale-row">{scale}</div>
        <p class="scale-label">{count} out of 5 sweaters</p>
        <p>{sweater_data['detail']}</p>
        <p><b>Recommended layers:</b> {sweater_data['layers']}</p>
    </div>"""


def build_right_wrong_section(comparison):
    if not comparison:
        return """
        <div class="section">
            <h2>RIGHT RAY / WRONG RAY</h2>
            <p>No data yet. Check back tomorrow.</p>
            <p style="font-size: 10px;">(We're collecting Ray's predictions. This takes time. Be patient.)</p>
        </div>"""

    date = comparison["date"]
    actuals = comparison.get("actuals", {})

    rows = ""
    for source_name, source_data in comparison.get("sources", {}).items():
        if "score" not in source_data:
            continue
        score = source_data["score"]
        pred = source_data.get("prediction", {})
        label = "Ray's Weather" if source_name == "raysweather" else "Open-Meteo"
        grade = score["grade"]
        ray_count = grade.get("ray_count", 3)
        scale = ray_scale_html(ray_count)

        rows += f"""
        <tr>
            <td><b>{label}</b></td>
            <td>Hi: {pred.get('high_f', '?')}&deg; / Lo: {pred.get('low_f', '?')}&deg;</td>
            <td><b>{score['score']}/100</b></td>
            <td>
                <div class="verdict-cell">
                    <span class="verdict-label">{grade['label']}</span>
                    <div class="scale-row-small">{scale}</div>
                </div>
            </td>
        </tr>"""

    if not rows:
        rows = "<tr><td colspan='4'>Scoring data not available yet</td></tr>"

    return f"""
    <div class="section">
        <h2>RIGHT RAY / WRONG RAY</h2>
        <p class="date">{date}</p>
        <p><b>ACTUAL WEATHER:</b> High {actuals.get('high_f', '?')}&deg;F / Low {actuals.get('low_f', '?')}&deg;F &mdash; {actuals.get('conditions', 'Unknown')}</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
            <tr style="background: #eee;">
                <th>Source</th>
                <th>Predicted</th>
                <th>Score</th>
                <th>Verdict</th>
            </tr>
            {rows}
        </table>
        <p style="font-size: 11px; color: #888; margin-top: 5px;">Rating: 5 Rays = nailed it, 1 Ray = yikes</p>
    </div>"""


def build_scores_section(scores):
    if not scores or not scores.get("totals"):
        return """
        <div class="section">
            <h2>SEASON SCOREBOARD</h2>
            <p>No scores recorded yet. We just started. Calm down.</p>
        </div>"""

    rows = ""
    for source, totals in scores["totals"].items():
        label = "Ray's Weather" if source == "raysweather" else "Open-Meteo"
        days = totals["days"]
        avg = round(totals["total_score"] / days, 1) if days > 0 else 0
        record = f'{totals["right"]}W - {totals["wrong"]}L - {totals["meh"]}M'
        rows += f"<tr><td><b>{label}</b></td><td>{record}</td><td>{avg}/100</td><td>{days}</td></tr>"

    return f"""
    <div class="section">
        <h2>SEASON SCOREBOARD</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
            <tr style="background: #eee;">
                <th>Source</th>
                <th>Record</th>
                <th>Avg Score</th>
                <th>Days Tracked</th>
            </tr>
            {rows}
        </table>
    </div>"""


def build_screenshot_section(comparison):
    if not comparison:
        return ""
    date = comparison["date"]
    screenshot_path = DATA_DIR / "predictions" / date / "rays_forecast.png"
    if not screenshot_path.exists():
        return """
    <div class="section">
        <h2>RAY'S FORECAST (screenshot)</h2>
        <p>Screenshot not captured yet. The robot that does this is still learning.</p>
    </div>"""

    return f"""
    <div class="section">
        <h2>RAY'S FORECAST (screenshot)</h2>
        <p class="date">{date}</p>
        <img src="screenshots/rays_forecast.png" alt="Ray's Weather forecast" style="max-width: 100%; border: 2px solid #ccc;">
        <p style="font-size: 10px;">Screenshot from <a href="https://raysweather.com/Forecast/Boone">raysweather.com</a>. Go visit Ray, he's great.</p>
    </div>"""


def build_html():
    now = datetime.now(EST)
    comparison = get_latest_comparison()
    scores = get_scores()

    try:
        sweater = get_current_sweater_check()
    except Exception:
        sweater = None
    if not sweater and comparison:
        sweater = comparison.get("sweater_weather")

    sweater_html = build_sweater_section(sweater)
    rightwrong_html = build_right_wrong_section(comparison)
    scores_html = build_scores_section(scores)
    screenshot_html = build_screenshot_section(comparison)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dave's Sweater</title>
    <style>
        body {{
            font-family: Georgia, 'Times New Roman', serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5dc;
            color: #333;
        }}
        h1 {{
            font-size: 28px;
            border-bottom: 3px solid #2D5A47;
            padding-bottom: 5px;
        }}
        h1 span {{
            font-size: 14px;
            font-weight: normal;
            color: #666;
        }}
        h2 {{
            font-size: 18px;
            color: #2D5A47;
            margin-top: 30px;
            border-bottom: 1px solid #ccc;
        }}
        .section {{
            background: white;
            padding: 15px;
            margin: 15px 0;
            border: 1px solid #ccc;
        }}
        .sweater-check {{
            text-align: center;
        }}
        .big-answer {{
            font-size: 72px;
            font-weight: bold;
            margin: 10px 0;
            line-height: 1;
        }}
        .date {{
            color: #888;
            font-size: 12px;
        }}
        table {{
            font-size: 14px;
        }}
        th {{
            text-align: left;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            font-size: 11px;
            color: #999;
        }}
        .under-construction {{
            background: #ffff00;
            color: black;
            padding: 5px 10px;
            display: inline-block;
            font-family: 'Comic Sans MS', cursive, sans-serif;
            font-size: 14px;
            transform: rotate(-2deg);
            margin: 10px 0;
        }}
        a {{
            color: #2D5A47;
        }}

        /* ── Scales ─────────────────────────────── */
        .scale {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }}
        .scale-row {{
            margin: 10px 0;
        }}
        .scale-row-small {{
            margin-top: 4px;
        }}
        .scale-label {{
            font-size: 13px;
            color: #888;
            margin-top: 0;
        }}

        /* Sweater emoji scale */
        .sweater-icon {{
            font-size: 48px;
            line-height: 1;
        }}
        .sweater-icon.inactive {{
            opacity: 0.15;
        }}
        .scale-row-small .sweater-icon {{
            font-size: 22px;
        }}

        /* Ray face scale */
        .ray-face {{
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #ccc;
            object-fit: cover;
        }}
        .scale-row .ray-face {{
            width: 56px;
            height: 56px;
        }}
        .scale-row-small .ray-face {{
            width: 28px;
            height: 28px;
            border-width: 1px;
        }}
        .ray-active {{
            border-color: #2D5A47;
            opacity: 1;
        }}
        .ray-inactive {{
            filter: grayscale(100%) brightness(1.4);
            opacity: 0.2;
            border-color: #ddd;
        }}
        .ray-emoji {{
            font-size: 28px;
        }}
        .ray-emoji.inactive {{
            opacity: 0.15;
        }}

        /* Verdict cell */
        .verdict-cell {{
            min-width: 140px;
        }}
        .verdict-label {{
            font-size: 13px;
            font-weight: bold;
            display: block;
            margin-bottom: 2px;
        }}
    </style>
</head>
<body>
    <h1>
        Dave's Sweater
        <span>&mdash; Boone, NC's #2 weather resource</span>
    </h1>

    <p class="under-construction">&#128679; UNDER CONSTRUCTION &#128679;</p>

    <p>A public service for people who want to know (1) if it's sweater weather and (2) if Ray got yesterday's forecast right.</p>
    <p style="font-size: 12px; color: #888;">Updated: {now.strftime("%B %d, %Y at %I:%M %p")} EST</p>

    {sweater_html}

    {rightwrong_html}

    {screenshot_html}

    {scores_html}

    <div class="section">
        <h2>WHAT IS THIS</h2>
        <p>This is a website about sweaters and weather in Boone, North Carolina.</p>
        <p>Every day, we check:</p>
        <p>1. Is it sweater weather? (important)<br>
           2. Did Ray get yesterday's forecast right? (also important)<br>
           3. What did Ray's forecast actually look like? (evidence)</p>
        <p>That's it. That's the whole site.</p>
        <p style="font-size: 11px;">If you were expecting more, we apologize. We are one person with a sweater and a computer.</p>
    </div>

    <div class="footer">
        <p>Dave's Sweater is not affiliated with <a href="https://raysweather.com">Ray's Weather</a>. Ray's great. Go use his site for actual weather information.</p>
        <p>Weather data from <a href="https://open-meteo.com">Open-Meteo.com</a>. Sweater data from Dave.</p>
        <p>davessweater.com &bull; est. 2026 &bull; "the weather site boone didn't ask for"</p>
        <p style="font-size: 9px;">Made with basic HTML, no frameworks, and questionable judgment.</p>
    </div>
</body>
</html>"""

    SITE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = SITE_DIR / "index.html"
    with open(output_path, "w") as f:
        f.write(html)
    print(f"  Built site: {output_path}")

    # Always preserve the CNAME file (GitHub Pages custom domain)
    cname_path = SITE_DIR / "CNAME"
    if not cname_path.exists():
        cname_path.write_text("davessweater.com\n")
        print(f"  Created CNAME: {cname_path}")
    return output_path


if __name__ == "__main__":
    build_html()
