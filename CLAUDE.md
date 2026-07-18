# Dave's Sweater

Weather tracking site for Boone / Deep Gap, NC. Compares forecasts from Ray's Weather, Open-Meteo, and Apple Weather against verified actuals, then scores accuracy on a 100-point scale.

Live at **davessweater.com** (deployed via Vercel).

## What it is (premise & voice)

Dave's Sweater is a satirical local weather site — the name is a phonetic play on "Ray's Weather" (RaysWeather.com, the real Boone-area service). The bit: answer "Is it sweater weather?" and run a **"Right Ray / Wrong Ray"** tracker that scores forecast accuracy against actual conditions over time, to show with data that free services keep pace with (or beat) the paid one. Not affiliated with Ray's Weather.

Voice: **dry, wry, factual, having fun — sharp but never bitter.** "Boone's #2 weather resource." The throughline (evolved 2026-07-07 from pure parody to something more complex and subversive): *"Every forecast is a claim about tomorrow. We check them all — including ours."* The deeper frame is **data democracy**: the data behind every forecast is public (satellites, models, stations taxpayers already fund), and the incumbent sells access back gated behind a bill and a résumé — a professorship, staff forecasters, decades of habit, a station network. We find the data, vet it, grade it, and hand it over free. Ray's Weather stays the named symbol of gated expertise — pointed at, never bitter, and always credited where the data credits him. The same spirit extends past weather (fireworks dusk math, the Games planner): whatever data is sitting out there, make it useful and free. The credibility of the whole bit rests on the tracker being real and the methodology being visible and defensible — keep claims framed as tracked data, not assertion.

> **Note for contributors:** There is additional background context (origin story, tone guidance, and copy direction) that is intentionally **kept out of this public repo**. If you're working locally and need it, ask the owner — it lives in a private/local context file, not in version control. Do not commit personal, political, third-party, or network/infrastructure details to this public repository.

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

1. **Daily Capture** (`daily_capture.yml`) — `cron: '0 14 * * *'` (10:00 AM EDT) — Ray's screenshot + scrape, Open-Meteo forecast, iPhone fallback; commits `data/`.
2. **Daily Compare** (`daily_compare.yml`) — `cron: '30 14 * * *'`; also on Daily Capture / iPhone-upload completion — fetches yesterday's actuals, runs `compare.py`, exports CSV; commits `data/`.

`upload_screenshot.yml` accepts iPhone forecast screenshots via the GitHub API → commits `data/predictions/`. The old `rebuild_on_screenshot.yml` + `build_site.py` were retired at the Next.js cutover; Vercel rebuilds on every `data/` commit.

## Scoring System

`scripts/scoring.py:score_prediction()` (orchestrated by `compare.py`) — points per field:

| Category      | Max Points | Tolerance        | Penalty                |
|---------------|-----------|------------------|------------------------|
| High temp     | 30        | within 2°F = full | -3 pts per °F beyond  |
| Low temp      | 30        | within 2°F = full | -3 pts per °F beyond  |
| Wind speed    | 20        | within 3 mph = full | -2 pts per mph beyond (interval midpoint + a 0.5× range-width vagueness tax) |
| Precip type   | 10        | exact = 10; right category / wrong form = 4; trace-band none-vs-precip miss = 6 | 0 otherwise |
| Precip amount | 10        | snow-aware (rain ±0.1", snow ±max(1", 20%)) | rain -20/in, snow -2/in |

**Precip & the implied-zero rule (2026-06-30):** scored out of a fixed 100. A forecast of **"no precip"** is a
zero-inch amount forecast — scored as such, so a source that says "no rain" earns the amount points on dry days.
A forecast of rain/snow with **no stated total** forfeits the amount (scored as a miss) — a source can't gain by
leaving the hard field blank. Ray's Weather never gives numeric totals, so he earns amount credit on his
dry-forecast days and forfeits it on his wet-forecast days (the implied-zero is set in `compare.py:_to_contract`
when `precip_type == "none"`). This replaced the short-lived R2 coverage-normalization, which let a forecaster
outrank a more-accurate one purely by omitting the amount. Precip **type** follows the forecast's weather
category (a rain / storm / snow forecast counts as predicting precipitation even at 0" QPF, so a thunderstorm
isn't mislabeled "none"), which also keeps the Apple/Open-Meteo fallback scoring consistent (`compare.py:_to_contract`).

**Trace-band partial type credit (2026-07-18):** the type boundary (rain > 0.005", snow > 0.05") sits far below
the amount tolerances (0.1" / 1"), so a "none" forecast on a trace day used to score 0/10 on type beside 10/10 on
amount — the same claim graded fully wrong and fully right at once (147 historical rows; owner-flagged 2026-07-02).
Fix: a none-vs-precip type disagreement earns **6/10** (`TYPE_TRACE_CREDIT` in `scoring.py:_type_points`) when the
precip side's amounts are inside the amount tolerances (`_is_trace`), in either direction. A source that names
precip but omits the total cannot claim the band (no gain by omission — Ray's wet-forecast days unchanged). Not
tuned against Ray: source-blind, lifted all 10 sources (+0.56 to +1.26 avg; Ray +0.56, Open-Meteo +1.08). History
rescored via `rescore_history.py`. This narrows the trace incoherence only; the broader recalibration (merged
20-pt precip, temp-band tightening) stays open in `CHECKLIST.md`.

**Capture-day low recovery (2026-07-01):** Met.no and OpenWeatherMap derive the daily low as `min()` over their
sub-daily timeseries. On the capture day (~midday) that series no longer covers the pre-dawn hours, so its "low"
is the afternoon minimum — biased warm by 5–17°F, which depressed the low-temp score (30 of 100 pts)
on every one of those two sources' scored days. `compare.py:_fix_bucket_low` recovers the capture-day low from
the **day-ahead forecast issued the prior morning** (`predictions/{date-1}/{key}_forecast.json`, whose row for
that day spans the full (UTC) day and so reaches the overnight trough the midday capture missed), forfeiting the
low only when no prior capture exists. Sources reading a
provider daily-min (Open-Meteo, NWS, WeatherAPI, Visual Crossing, Tomorrow.io, Google) are unaffected. Applied
forward in the daily run and backfilled across history via `scripts/backfill_bucket_low.py`.

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

- **Hosting**: Vercel — `next build` on every push to `main` (Git integration). `vercel.json`: `framework: nextjs`, `outputDirectory: .next`. Domain davessweater.com (+ www); DNS via Squarespace.
- **Build**: Node/Next (`npm`). `prebuild` (`scripts/prepare_public.mjs`) copies the latest `data/predictions` screenshots → `public/screenshots/`.
- **Data pipeline**: Python stdlib; `capture_rays.py` needs Playwright. Runs only in GitHub Actions.
- **Stale config (inert)**: the Vercel project dashboard still has GitHub-Pages-era *overrides* (build cmd / output dir = `docs`); `vercel.json` overrides them. GitHub Pages is also still configured but vestigial (DNS → Vercel) — disable when convenient.

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

## Development

**Mobile check is mandatory (owner rule, 2026-07-08):** every UI change gets verified at iPhone width
before it ships — 390x844 viewport (via Chrome device emulation or `next start` + devtools), checking for
horizontal overflow, wrapping, and layout of the changed elements. The owner can't easily preview mobile;
the verifier is responsible for confirming it renders well on phones.

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
