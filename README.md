# Dave's Sweater 🧣

Boone, NC's #2 weather resource. Live at **[davessweater.com](https://davessweater.com)**.

A satirical local-weather site that answers the important question — *is it sweater weather?* — and
runs a **"Right Ray / Wrong Ray"** tracker scoring forecast accuracy (Ray's Weather vs. Open-Meteo
vs. Apple Weather) against verified actuals on a 100-point scale. The bit: show with data that the
free services keep pace with — or beat — the paid one.

## Architecture

Two layers:

- **Data pipeline** (Python, stdlib) — daily GitHub Actions capture forecasts + actuals and score
  them into `data/*.json`.
- **Web app** (Next.js 16, App Router) — reads the committed `data/*.json` at build time and renders
  the site. Vercel runs `next build` on every push to `main`.

```
scripts/                # Python data pipeline (Playwright only for capture_rays)
  capture_openmeteo.py  #   Open-Meteo forecast + historical actuals
  capture_rays.py       #   Ray's Weather screenshot + scrape
  capture_iphone_weather.py  # Open-Meteo fallback for the Apple Weather slot
  compare.py            #   scoring engine + sweater-weather logic
  export_scores_csv.py  #   scores.json → CSV
  fetch_substack.py     #   Substack RSS → cached JSON (blog)
  prepare_public.mjs    #   prebuild: latest data/predictions screenshots → public/screenshots
data/                   # committed JSON the site reads (predictions, actuals, comparisons, scores)
src/                    # Next.js app — lib/ (data, feeds, sweater, scoreboard, html), components/, app/ (routes)
public/                 # served assets (logo, icons); screenshots/ generated at build
.github/workflows/      # daily_capture, daily_compare, upload_screenshot
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # prebuild (screenshots) + next build
npm test         # vitest
npm run lint

# Data pipeline (Python stdlib; Playwright only for capture_rays)
python scripts/capture_openmeteo.py --forecast
python scripts/capture_openmeteo.py --actuals --date 2026-03-01
python scripts/compare.py --date 2026-03-01
python scripts/compare.py --sweater-only
```

## Daily pipeline

GitHub Actions run the data pipeline and commit `data/` to `main`; each push triggers a Vercel
`next build`:

- **Daily Capture** (`daily_capture.yml`, 10:00 AM EDT) — Ray's screenshot + scrape, Open-Meteo
  forecast, iPhone fallback → commits `data/`.
- **Daily Compare** (`daily_compare.yml`, 10:30 AM EDT) — fetches yesterday's actuals, scores
  predictions, exports CSV → commits `data/`.
- **iPhone Screenshot Upload** (`upload_screenshot.yml`) — accepts an Apple Weather screenshot via
  the GitHub API (iOS Shortcut) → commits `data/predictions/`.

## Deployment

Hosted on **Vercel** (`vercel.json`: `framework: nextjs`, `buildCommand: npm run build`,
`outputDirectory: .next`). Every push to `main` deploys. Domain DNS via Squarespace.

## Cost

~$12/year for the domain. Hosting + Actions are free-tier.

---

*Dave's Sweater is not affiliated with Ray's Weather. Ray's great — use his site for actual weather.*
