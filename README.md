# Dave's Sweater 🧣

Boone, NC's #2 weather resource.

A daily automated system that:
1. **Checks** if it's sweater weather (the important question)
2. **Scores** Ray's forecast accuracy ("Right Ray / Wrong Ray")
3. **Screenshots** Ray's forecast page as evidence

## How It Works

```
7:00 AM  →  Capture Ray's forecast (screenshot + data) & Open-Meteo prediction
8:00 AM  →  Fetch yesterday's actual weather, score predictions, rebuild site
```

Everything runs on GitHub Actions for free. The site deploys via GitHub Pages.

## Setup

### 1. Create the repo
```bash
git init davessweater
cd davessweater
# Copy all files from this project
git add .
git commit -m "🧣 Initial commit"
```

### 2. Create a GitHub repo and push
```bash
gh repo create davessweater --public --push
```

### 3. Enable GitHub Pages
- Go to repo Settings → Pages
- Source: "Deploy from a branch"
- Branch: `main`, folder: `/site`
- Save

### 4. Enable GitHub Actions
- Go to repo Settings → Actions → General
- Under "Workflow permissions": select "Read and write permissions"
- Save

### 5. Test manually
```bash
# Trigger the capture workflow
gh workflow run "📸 Daily Capture"

# Wait a few minutes, then trigger the comparison
gh workflow run "📊 Daily Compare & Build"
```

### 6. (Optional) Custom domain
Add a `CNAME` file to `site/` with `davessweater.com` and configure DNS.

## Local Development

```bash
# Install dependencies
pip install playwright
playwright install chromium

# Capture today's forecast
python scripts/capture_rays.py
python scripts/capture_openmeteo.py --forecast

# Fetch actuals for a specific date
python scripts/capture_openmeteo.py --actuals --date 2026-03-01

# Run comparison
python scripts/compare.py --date 2026-03-01

# Quick sweater check
python scripts/compare.py --sweater-only

# Build the site
python scripts/build_site.py
# Open site/index.html in a browser
```

## Project Structure

```
davessweater/
├── scripts/
│   ├── capture_rays.py        # Screenshot + scrape RaysWeather.com
│   ├── capture_openmeteo.py   # Fetch Open-Meteo forecast & actuals
│   ├── compare.py             # Scoring engine + sweater weather logic
│   └── build_site.py          # Generate the (very simple) HTML site
├── data/
│   ├── predictions/           # Daily forecast captures
│   │   └── 2026-03-01/
│   │       ├── rays_forecast.png
│   │       ├── rays_boone.json
│   │       └── openmeteo_forecast.json
│   ├── actuals/               # Verified weather after the fact
│   │   └── 2026-03-01.json
│   ├── comparisons/           # Daily Right Ray/Wrong Ray reports
│   │   └── 2026-03-01.json
│   └── scores.json            # Running season scoreboard
├── site/
│   └── index.html             # THE website. That's it. One page.
├── .github/workflows/
│   ├── daily_capture.yml      # 7 AM: capture predictions
│   └── daily_compare.yml      # 8 AM: compare, score, rebuild site
├── requirements.txt
└── README.md
```

## Cost

$12/year for the domain. Everything else is free.

---

*Dave's Sweater is not affiliated with Ray's Weather. Ray's great. Use his site for actual weather.*
