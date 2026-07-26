# Dave's Sweater 🧣

Boone, NC's #2 weather resource. Live at **[davessweater.com](https://davessweater.com)**.

A satirical local-weather site that answers the important question — *is it sweater weather?* — and
runs a **"Right Ray / Wrong Ray"** tracker scoring forecast accuracy (Ray's Weather vs. Open-Meteo
vs. Apple Weather, plus a growing bench of free forecasters) against verified actuals on a 100-point
scale. The bit: show with data that free services keep pace with — or beat — the paid one. Not
affiliated with Ray's Weather; Ray's great, use his site for actual weather.

> **Note for contributors:** There is additional background context (origin story, tone guidance, and
> copy direction) that is intentionally **kept out of this public repo**. If you're working locally and
> need it, ask the owner — it lives in a private/local context file, not in version control. Do not
> commit personal, political, third-party, or network/infrastructure details to this public repository.

## Architecture

Two layers:

- **Data pipeline** (Python, stdlib) — daily GitHub Actions capture forecasts and actuals, then score
  them into `data/*.json`. Scoring lives in `scripts/scoring.py` (100-point scale, tolerance bands per
  field, sweater-weather logic), orchestrated by `scripts/compare.py`.
- **Web app** (Next.js 16, App Router) — reads the committed `data/*.json` at build time and renders
  the site. Vercel runs `next build` on every push to `main`; there's no committed HTML.

```
scripts/                # Python data pipeline (stdlib only; Playwright just for capture_rays)
  scoring.py             #   the 100-point scoring engine
  compare.py             #   orchestrates scoring + sweater-weather logic for a given date
  capture_openmeteo.py   #   Open-Meteo forecast + historical actuals
  capture_rays.py        #   Ray's Weather screenshot + scrape
  capture_iphone_weather.py  # Open-Meteo fallback for the Apple Weather slot
  export_scores_csv.py   #   scores.json → CSV
  fetch_substack.py      #   Substack RSS → cached JSON (blog)
  prepare_public.mjs     #   prebuild: latest data/predictions screenshots → public/screenshots
  # a growing bench of capture/compare scripts for road conditions, tourism demand,
  # local events, and other Boone-area signals lives alongside the core set above
data/                    # committed JSON the site reads (predictions, actuals, comparisons, scores, ...)
src/                     # Next.js app — lib/ (data, feeds, sweater, scoreboard, dates, html), components/, app/ (routes)
public/                  # served assets (logo, icons); screenshots/ generated at build
.github/workflows/       # daily_capture, daily_compare, upload_screenshot (+ a few narrower feature crons)
```

Site routes worth knowing: `/` (today's forecast + sweater verdict), `/right-wrong-ray` (the
comparison + scoreboard), `/resources` (articles, news, report cards, and videos — the blog), `/reports`
(franchise landing pages like the fireworks forecast), `/methodology` (how the scoring works), `/shop`.

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

# Python test suite
python3 -m pytest tests/
```

## Daily pipeline

GitHub Actions run the data pipeline and commit `data/` to `main` every morning; each push triggers a
Vercel `next build`:

- **Daily Capture** (`daily_capture.yml`) — Ray's screenshot + scrape, Open-Meteo forecast, iPhone
  fallback, plus the other capture scripts (roads, tourism demand, events, etc.) → commits `data/`.
- **Daily Compare** (`daily_compare.yml`) — runs after Daily Capture, fetches yesterday's actuals,
  scores predictions, checks capture health, exports the scores CSV → commits `data/`.
- **iPhone Screenshot Upload** (`upload_screenshot.yml`) — accepts an Apple Weather screenshot via
  the GitHub API (iOS Shortcut) → commits `data/predictions/`.

A few narrower feature workflows (e.g. traffic sampling) run on their own schedules alongside these
two. Exact cron times live in `.github/workflows/*.yml`, not here — they've moved before and will
again.

## Deployment

Hosted on **Vercel** (`vercel.json`: `framework: nextjs`, `outputDirectory: .next`). Every push to
`main` deploys. Domain DNS via Squarespace.

## Cost

~$12/year for the domain. Hosting + Actions are free-tier.

---

*Dave's Sweater is not affiliated with Ray's Weather. Ray's great — use his site for actual weather.*
