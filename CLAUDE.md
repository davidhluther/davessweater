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

1. **Daily Capture** (`daily_capture.yml`) — `cron: '0 10 * * *'` (6:00 AM EDT) — Ray's screenshot + scrape, Open-Meteo forecast, iPhone fallback; commits `data/`.
2. **Daily Compare** (`daily_compare.yml`) — `cron: '30 10 * * *'` (6:30 AM EDT); also on Daily Capture / iPhone-upload completion — fetches yesterday's actuals, runs `compare.py`, exports CSV; commits `data/`.

`upload_screenshot.yml` accepts iPhone forecast screenshots via the GitHub API → commits `data/predictions/`. The old `rebuild_on_screenshot.yml` + `build_site.py` were retired at the Next.js cutover; Vercel rebuilds on every `data/` commit.

## Scoring System

`scripts/scoring.py:score_prediction()` (orchestrated by `compare.py`) — points per field:

| Category      | Max Points | Tolerance        | Penalty                |
|---------------|-----------|------------------|------------------------|
| High temp     | 30        | within 1°F = full | -3 pts per °F beyond  |
| Low temp      | 30        | within 1°F = full | -3 pts per °F beyond  |
| Wind speed    | 20        | within 3 mph = full | -2 pts per mph beyond (interval midpoint + a 0.5× range-width vagueness tax) |
| Precip        | 20        | **dry day:** predicted amount vs 0" scored over the full 20 (type & amount encode the same fact — no double count). **wet day:** 10 identification (exact form = 10; right category / wrong form = 4; trace-band none-vs-precip = 6) + 10 amount, snow-aware (rain ±0.1", snow ±max(1", 20%)) | amount rain -20/in, snow -2/in; amount **capped at 5** when a real form is misnamed; amount **forfeited** (0) when precip is named but the total is omitted |

**Scoring recalibration (2026-07-26):** the temperature full-credit window tightened from **2°F to 1°F**
(slope unchanged at -3 pts/°F — the owner chose the gentler register over -4), because a 2°F window let temperature
saturate ~60% of the scale and the automated sources became indistinguishable in the 90s. Separately, the old
precip **type (10)** + **amount (10)** fields were **merged into one 20-pt `precip` field** (`scoring.py:_precip_20`)
so a single wet/dry fact is never graded twice: on a dry day the whole 20 is the predicted amount scored against
zero; on a precip day it is 10-pt form identification + 10-pt amount, with the wrong-form cap and omission-forfeit
above. The **implied-zero** and **trace-band** rules below are preserved as sub-components of the merged field. The
breakdown/coverage key `precip_type`+`precip_amount` collapsed to a single `precip` key (coverage tracks whether the
numeric amount was answered — the old `precip_amount` semantics). Rescored across all history + every town via
`rescore_history.py`.

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
rescored via `rescore_history.py`. This narrowed the trace incoherence only; the broader recalibration (merged
20-pt precip, temp-band tightening) shipped 2026-07-26 — see the recalibration note above. The trace-band credit
now lives inside the merged field as part of its 10-pt identification sub-score.

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

### Type scale (owner rule, 2026-07-27)

Headings, kickers, and captions use the named `ds-*` classes defined in
`src/app/globals.css` (`@layer components`). **Never compose a fresh
size+weight combo** — that is how the site ended up with ten different card
titles and the owner's "different fonts and sizes and bolding" complaint.

| Class | Renders | Use for |
|---|---|---|
| `ds-h1` | Space Grotesk bold, 3xl → 4xl at `sm` | The page title. One per page. |
| `ds-h2` | Space Grotesk bold, 2xl | A section heading — opens a band or a major block. |
| `ds-h3` | Space Grotesk bold, lg → xl at `sm` | A card or module title. |
| `ds-h4` | Space Grotesk bold, base | A heading nested inside a card: FAQ question, venue, table group. |
| `ds-kicker` | bold, xs, uppercase, tracked | The eyebrow label above a title. |
| `ds-stat` | Space Grotesk bold, 2xl → 3xl at `sm`, tabular-nums | The numeric readout a module exists to state. |
| `ds-body` | sm | Body prose. The site's body size is `sm`, not `base`; add `text-muted` for secondary prose. |
| `ds-caption` | xs, muted | A footnote, caption, or source line. |

- **Color is a call-site decision**, so one token works on both treatments:
  `text-orange-300` / `text-white/70` on the dark teal bands, `text-orange-600` /
  `text-muted` on the light body. Orange stays brand/editorial only (M2 rule).
- **Deliberate one-offs** take a utility on the same element (`ds-stat text-4xl`).
  Tailwind sorts `utilities` after `components`, so the utility wins — and leave a
  comment saying why. Current exceptions: the `LiveConditions` temperature
  (largest readout on the site), the `/widget` embed (its own compact scale — it
  renders inside other people's pages), the GMHG print one-pager (forced to serif
  by `.gmhg-print`), and the dense `FiveDayStrip` day cards.
- **Not kickers:** inline badges/chips and dense-grid micro-labels. `ds-kicker` is
  for titling labels only.
- Article prose headings live in `PostBody.tsx` as arbitrary variants
  (`[&_h2]:…`), which can only compose utilities — they mirror the scale by hand.
  Keep them in sync.

**Copy lint — run before shipping UI copy; it blocks the test suite (owner rule, 2026-07-28):**

```bash
python3 scripts/copy_lint.py            # the shipped copy: src/app, src/components, src/content
python3 scripts/copy_lint.py --dump     # every user-facing string it can see
```

`scripts/copy_lint.py` pulls the user-facing strings out of the codebase (JSX text nodes, prose
string literals, metadata titles/descriptions, aria-labels, native posts) and enforces the
mechanically-decidable parts of the writing styleguide: AP colon capitalization, lowercase
"label: value" skeletons, em-dashes in UI copy, Title Case across nav/category label sets,
capitalized table cells and stat captions, straight quotes in JSX, words that run together at an
element boundary, and the Tier 1 banned vocabulary. `tests/test_copy_lint.py` runs it over the
real `src/` tree and **fails pytest on any error**, because the rules existed as prose for months
and the owner still kept catching violations by reading the live page. Banned-word lists are read
from the canonical shared `style_rules.json` (`~/Projects/shared-skills/seo/seo-validate/data/`),
never copied in. The rule list and its reasoning live in the script's docstring; the DS-specific
notes are in `guidelines/seo/DS_WRITING_QUALITY.md`.

One rule worth knowing before you write JSX: a text node that carries an HTML entity **and** wraps
across source lines loses its leading space at build time, so `<em>range</em> is scored ...
5&ndash;15 mph` ships as "rangeis scored". Use an explicit `{" "}` at that boundary. The linter
catches it; verified against a production build (Next 16 / SWC).

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

## Content production

The editorial pipeline predates the cross-project scaffold, so DS keeps its own
layout (no `output/` dir):

- **Guidelines stack:** the universal writing styleguide
  (`~/Projects/shared-skills/writing-styleguide.md`) auto-applies via
  `~/Projects/CLAUDE.md`; DS voice notes layer on top at `guidelines/seo/DS_VOICE.md`
  (DRAFT stub — the full stack per `planning/specs/2026-07-02-seo-aio-program-design.md`
  §7 adds `DS_CONTENT_STRUCTURE.md` + `DS_WRITING_QUALITY.md`, still to build).
- **Where content lives:** briefs → `planning/seo/briefs/`; working drafts →
  `planning/seo/drafts/`; published finals are native posts in `src/content/posts/`
  (rendered under `/resources/articles/`).
- **Shared content skills:** `~/Projects/shared-skills/seo/` is the canonical
  cross-project location (being populated by the SEO platform program) — check there
  before building content tooling locally.
- Program design: `planning/specs/2026-07-02-seo-aio-program-design.md`. Tasks
  (including the standing monthly report card) tracked in `CHECKLIST.md` as usual.

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
