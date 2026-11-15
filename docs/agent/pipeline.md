## Architecture

Two layers: a Python **data pipeline** (stdlib) captures forecasts + actuals and scores them into `data/*.json` via daily GitHub Actions; a **Next.js 16 app** (`src/`, App Router) reads that committed JSON at build time and renders the site. Vercel runs `next build` on every push to `main`.

```
scripts/
  compare.py           # Scoring engine — 100-point scale, sweater weather logic
  capture_openmeteo.py # Fetches Open-Meteo forecast + historical actuals
  capture_rays.py      # Screenshots + scrapes RaysWeather.com (Playwright)
  capture_iphone_weather.py  # Open-Meteo fallback for Apple Weather slot
  fetch_substack.py    # Pulls Substack RSS for blog tab
  export_scores_csv.py # Dumps scores.json → CSV
  prepare_public.mjs   # prebuild (Node): latest data/predictions screenshots → public/screenshots

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

src/                   # Next.js app: lib/ (data, feeds, sweater, scoreboard, html, types),
                       #   components/ (SiteHeader, LiveConditions client island, ShopGrid, …),
                       #   app/ (/ , /right-wrong-ray , /blog[/slug] , /videos , /shop , sitemap, robots)
public/                # served assets (logo-white.png, ray_face.svg, favicon); screenshots/ at build
# Build output is .next/ (produced by Vercel) — no committed HTML.
```

## Daily Pipeline

GitHub Actions run the **data** pipeline and commit `data/` to `main`; each push triggers Vercel to rebuild with `next build`. The Actions no longer build HTML.

1. **Daily Capture** (`daily_capture.yml`) — `cron: '0 10 * * *'` (6:00 AM EDT) — Ray's screenshot + scrape, Open-Meteo forecast, iPhone fallback; commits `data/`.
2. **Daily Compare** (`daily_compare.yml`) — `cron: '30 10 * * *'` (6:30 AM EDT); also on Daily Capture / iPhone-upload completion — fetches yesterday's actuals, runs `compare.py`, exports CSV; commits `data/`.

`upload_screenshot.yml` accepts iPhone forecast screenshots via the GitHub API → commits `data/predictions/`. The old `rebuild_on_screenshot.yml` + `build_site.py` were retired at the Next.js cutover; Vercel rebuilds on every `data/` commit.

## Apple Weather Data

Two possible sources, checked in order:
1. `iphone_forecast_apple.json` — real iPhone Shortcut data (uploaded by Dave manually)
2. `iphone_forecast.json` — Open-Meteo fallback, labeled as "Open-Meteo" source

When the fallback is used, the scoreboard labels it so there's no confusion with the actual Apple Weather app data. The fallback file (`iphone_forecast.json`) stores scoreable fields under a nested `forecast` key, which `compare.py` unwraps before scoring.

Note on Ray's precipitation: Ray's Weather never publishes a numeric precip amount, so `compare.py` deliberately does **not** carry over a `precip_in` value for Ray's — hardcoding 0.0 would misrepresent his forecast as predicting no rain.

## Key Implementation Details

- All scripts use Python stdlib only (no pip deps for build/compare/capture_openmeteo)
- `capture_rays.py` requires Playwright (browser automation for screenshots)
- Open-Meteo API: `precipitation_sum` = rain only; `snowfall_sum` = snow in cm (convert to inches via /2.54)
- Snow + rain are combined into `precip_in` for scoring
- Timezone: All EST/EDT via `zoneinfo.ZoneInfo("America/New_York")`
- GitHub Actions cron is UTC-only; EST = UTC-5, EDT = UTC-4
- Site routes: `/` (Weather), `/right-wrong-ray` (comparison + scoreboard), `/videos`, `/blog` (+ `/blog/[slug]`), `/shop`
- Both GSC verification tags + GA live in `src/app/layout.tsx` metadata
- GSC verification meta tag: `Ajmlc52hA5hJQr-7WY7T9YU4Vlej8vkx1_GHmYHCAJo`

```bash
# Run the site (Next.js)
npm install && npm run dev   # http://localhost:3000  (build: npm run build · test: npm test)

# Capture today's forecast
python scripts/capture_openmeteo.py --forecast

# Fetch actuals for a date
python scripts/capture_openmeteo.py --actuals --date 2026-03-01

# Run comparison
python scripts/compare.py --date 2026-03-01

# Quick sweater check
python scripts/compare.py --sweater-only
```
## Coordinates & data source reference

- Boone, NC: lat **36.2168**, lon **-81.6746**
- Open-Meteo forecast: `api.open-meteo.com/v1/forecast` with `daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,weather_code`, `temperature_unit=fahrenheit`, `timezone=America/New_York`
- Open-Meteo actuals: `archive-api.open-meteo.com/v1/archive` (same params + `start_date`/`end_date`)
- Apple Weather via iOS Shortcut writes `iphone_forecast_apple.json` shaped `{today_high_f, tonight_low_f, wind_mph, rainfall_in, conditions}` — use the Shortcut's **Precipitation Amount** (numeric inches) for `rainfall_in`, not the text Condition token.
