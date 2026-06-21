# Dave's Sweater

Weather tracking site for Boone / Deep Gap, NC. Compares forecasts from Ray's Weather, Open-Meteo, and Apple Weather against verified actuals, then scores accuracy on a 100-point scale.

Live at **davessweater.com** (deployed via Vercel).

## What it is (premise & voice)

Dave's Sweater is a satirical local weather site — the name is a phonetic play on "Ray's Weather" (RaysWeather.com, the real Boone-area service). The bit: answer "Is it sweater weather?" and run a **"Right Ray / Wrong Ray"** tracker that scores forecast accuracy against actual conditions over time, to show with data that free services keep pace with (or beat) the paid one. Not affiliated with Ray's Weather.

Voice: **dry, wry, factual, having fun — sharp but never bitter.** "Boone's #2 weather resource." The throughline: *"He makes big promises and hopes nobody ever checks the numbers. Now somebody is."* The credibility of the whole bit rests on the tracker being real and the methodology being visible and defensible — keep claims framed as tracked data, not assertion.

> **Note for contributors:** There is additional background context (origin story, tone guidance, and copy direction) that is intentionally **kept out of this public repo**. If you're working locally and need it, ask the owner — it lives in a private/local context file, not in version control. Do not commit personal, political, third-party, or network/infrastructure details to this public repository.

## Architecture

Static site. No frameworks, no dependencies beyond Python stdlib. GitHub Actions capture data daily; Vercel rebuilds from `docs/` on every push to `main`.

```
scripts/
  build_site.py        # Generates docs/index.html (1433 lines, the whole site)
  compare.py           # Scoring engine — 100-point scale, sweater weather logic
  capture_openmeteo.py # Fetches Open-Meteo forecast + historical actuals
  capture_rays.py      # Screenshots + scrapes RaysWeather.com (Playwright)
  capture_iphone_weather.py  # Open-Meteo fallback for Apple Weather slot
  fetch_substack.py    # Pulls Substack RSS for blog tab
  export_scores_csv.py # Dumps scores.json → CSV

data/
  predictions/{date}/  # Daily forecast captures (JSON + screenshots)
    openmeteo_forecast.json
    rays_boone.json
    rays_forecast.png
    iphone_forecast.json        # Open-Meteo fallback
    iphone_forecast_apple.json  # Real iPhone Shortcut data (when available)
  actuals/{date}.json  # Verified weather from Open-Meteo archive
  comparisons/{date}.json  # Scored comparison results
  scores.json          # Running season scoreboard
  substack_feed.json   # Cached Substack posts

docs/                  # Build output (Vercel serves this)
  index.html           # The entire site — one file
```

## Daily Pipeline

Two GitHub Actions workflows, triggered by cron:

1. **Daily Capture** (`daily_capture.yml`) — `cron: '0 14 * * *'` (10:00 AM EDT / 9:00 AM EST)
   - Captures Ray's Weather screenshot + scraped data
   - Fetches Open-Meteo forecast
   - Fetches iPhone Weather fallback
   - Commits to `main`

2. **Daily Compare & Build** (`daily_compare.yml`) — `cron: '30 14 * * *'` (10:30 AM EDT)
   - Also triggered when Daily Capture or iPhone Screenshot Upload completes
   - Fetches yesterday's actuals from Open-Meteo archive
   - Runs `compare.py` to score predictions
   - Rebuilds site with `build_site.py`
   - Commits to `main` → Vercel auto-deploys

There's also an `upload_screenshot.yml` that accepts iPhone forecast screenshots via API, and `rebuild_on_screenshot.yml` that triggers a rebuild when one arrives.

## Scoring System

`compare.py:score_prediction()` — 100-point scale:

| Category      | Max Points | Tolerance        | Penalty                |
|---------------|-----------|------------------|------------------------|
| High temp     | 30        | within 2°F = full | -3 pts per °F beyond  |
| Low temp      | 30        | within 2°F = full | -3 pts per °F beyond  |
| Wind speed    | 20        | within 3 mph = full | -2 pts per mph beyond |
| Precipitation | 20        | 10 binary (rain y/n) + 10 amount | -2 pts per 0.1" diff |

Grade thresholds (`_score_grade()`):
- 90+ → Right (5 rays)
- 75+ → Right (4 rays)
- 60+ → Meh (3 rays)
- 40+ → Wrong (2 rays)
- <40 → Wrong (1 ray)

## Sweater Weather Logic

`compare.py:is_sweater_weather()` — blends high and current temp:
- 75°F+ → No sweater (0 sweaters)
- 65-74 → No (1 sweater)
- 55-64 → Maybe (2 sweaters)
- 45-54 → Yes (3 sweaters)
- 35-44 → Yes (4 sweaters)
- <35 → Absolutely (5 sweaters)

## Apple Weather Data

Two possible sources, checked in order:
1. `iphone_forecast_apple.json` — real iPhone Shortcut data (uploaded by Dave manually)
2. `iphone_forecast.json` — Open-Meteo fallback, labeled as "Open-Meteo" source

When the fallback is used, the scoreboard labels it so there's no confusion with the actual Apple Weather app data. The fallback file (`iphone_forecast.json`) stores scoreable fields under a nested `forecast` key, which `compare.py` unwraps before scoring.

Note on Ray's precipitation: Ray's Weather never publishes a numeric precip amount, so `compare.py` deliberately does **not** carry over a `precip_in` value for Ray's — hardcoding 0.0 would misrepresent his forecast as predicting no rain.

## Swag Shop

Uses Fourthwall for merch. The Storefront API has a persistent 403 issue (unresolved with Fourthwall), so the shop tab pulls product data from the **Merchant Center RSS feed** (`/.well-known/merchant-center/rss.xml`). Products are grouped by `item_group_id` to deduplicate size/color variants.

## Deployment

- **Hosting**: Vercel (migrated from GitHub Pages)
- **Config**: `vercel.json` — runs `python scripts/build_site.py`, serves `docs/`
- **Domain**: davessweater.com + www.davessweater.com (DNS via Squarespace)
- **Build**: Python stdlib only — no `pip install` needed for site build
- **Capture workflows**: Need `playwright` (for Ray's Weather screenshots)

## Key Implementation Details

- All scripts use Python stdlib only (no pip deps for build/compare/capture_openmeteo)
- `capture_rays.py` requires Playwright (browser automation for screenshots)
- Open-Meteo API: `precipitation_sum` = rain only; `snowfall_sum` = snow in cm (convert to inches via /2.54)
- Snow + rain are combined into `precip_in` for scoring
- Timezone: All EST/EDT via `zoneinfo.ZoneInfo("America/New_York")`
- GitHub Actions cron is UTC-only; EST = UTC-5, EDT = UTC-4
- Site has tabs: Forecast, Scoreboard, Blog, Videos, Swag Shop
- GSC verification meta tag: `Pxd8jrNaWOdwazTvIA9xHgCib5f8yC3n6IfAZQ1s8M0`

## Development

```bash
# Build the site locally
python scripts/build_site.py
# Open docs/index.html

# Capture today's forecast
python scripts/capture_openmeteo.py --forecast

# Fetch actuals for a date
python scripts/capture_openmeteo.py --actuals --date 2026-03-01

# Run comparison
python scripts/compare.py --date 2026-03-01

# Quick sweater check
python scripts/compare.py --sweater-only
```

## Roadmap & task tracking

**`CHECKLIST.md` (repo root) is the durable single source of truth for outstanding work.** The owner works across multiple sessions and tools and does not want to re-derive state each time.

**Standing instruction for every session:** read `CHECKLIST.md` at the start of work, and keep it current — check off completed items, add new ones as they come up, and treat it (not chat memory) as authoritative. When you finish a tracked task, update the checklist in the same change.

## Future Ideas

- **Head-to-head comparison on homepage**: Show a Ray's Weather vs Dave's Sweater (Open-Meteo) accuracy comparison directly on the site, similar to the Deep Gap scoring analysis done manually on June 14, 2026. (Dave's Sweater scored 92/100 vs Ray's 67/100 that day.)
- **Fourthwall Storefront API**: Contact Fourthwall support about the 403 error; if fixed, switch back from RSS feed for better product data.
- **Weather station (ground truth)**: Stand up a real Ecowitt Wittboy WS90 + GW2000 station in Boone, pull readings via the Ecowitt API in a GitHub Action, and wire those observations in as the authoritative "actuals" source. See `CHECKLIST.md` for the full plan.

## Coordinates & data source reference

- Boone, NC: lat **36.2168**, lon **-81.6746**
- Open-Meteo forecast: `api.open-meteo.com/v1/forecast` with `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,weather_code`, `temperature_unit=fahrenheit`, `timezone=America/New_York`
- Open-Meteo actuals: `archive-api.open-meteo.com/v1/archive` (same params + `start_date`/`end_date`)
- Apple Weather via iOS Shortcut writes `iphone_forecast_apple.json` shaped `{today_high_f, tonight_low_f, wind_mph, rainfall_in, conditions}` — use the Shortcut's **Precipitation Amount** (numeric inches) for `rainfall_in`, not the text Condition token.
