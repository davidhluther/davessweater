# Dave's Sweater — capability ledger

Last verified against repo: 2026-08-31 (leaf-forecaster build; rows touched: the `/leaf`
hub, the leaf grading loop, and the busy-ness leaf term moved from section 2 to section 1,
and the leaf-season model row in section 2 was retired. All other rows carry their
2026-08-30 or 2026-08-23 verification date and were not re-checked this pass.)

**What this file answers:** what the site and its pipeline can do *right now*, and what
proves it. It is not the task list — `CHECKLIST.md` is the durable record of what was
decided and finished, and stays the single source of truth for outstanding work. Rows
here were re-checked on the date above against code, workflow runs, the test suites, and
live URLs; nothing was copied forward from an older summary.

Verification traps worth knowing before you trust or extend a row:

- **A green Actions run proves the pipeline ran, not that the deploy shipped.** That is
  exactly where the two 2026 outages hid: `next build` reported success, every workflow
  stayed green, and Vercel refused the deployment afterward at the `patchBuild` step.
  Production froze on its last good build while nothing anywhere turned red.
- **Counting Vercel function directories tells you nothing about why a deploy is
  refused.** Sum the bytes in each function's `filePathMap` instead. Two plausible
  diagnoses were wrong before that measurement found the real cause.
- **The freshness sentinel reads committed data, not production.** A fresh `data/` tree
  and a green sentinel are compatible with a frozen site.

---

## 1. Live capabilities

| Capability | Where it runs | Shipped | Proof |
|---|---|---|---|
| Daily multi-source forecast capture for Boone (10 forecaster slots: Ray's Weather, Open-Meteo, NWS, MET Norway, OpenWeather, WeatherAPI, Visual Crossing, Tomorrow.io, Google, plus the Apple slot) | Actions `daily_capture.yml`, 10:00 UTC | 2026-03 | `.github/workflows/daily_capture.yml`; `data/predictions/2026-08-22/` holds 13 files covering every source slot; run succeeded 2026-08-22 |
| 100-point accuracy scoring against verified actuals, plus the running season scoreboard | `scripts/scoring.py` + `scripts/compare.py` via `daily_compare.yml`; rendered at `/right-wrong-ray` | 2026-03 | <https://davessweater.com/right-wrong-ray> (200); `data/scores.json`; `tests/test_scoring.py` |
| Merged 20-point precip field and 1°F temperature full-credit band (the 2026-07-26 recalibration), with all history rescored | `scripts/scoring.py:_precip_20`; `scripts/rescore_history.py` | 2026-07-26 | `scripts/scoring.py`; 583 pytest pass, run 2026-08-23 |
| Trace-band partial type credit — a none-vs-precip disagreement inside the amount tolerance earns partial rather than zero | `scripts/scoring.py:_type_points` | 2026-07-18 | commit `8b8b2809`; `tests/test_scoring.py` |
| Capture-day low recovery for sources that derive the daily low from a truncated sub-daily series | `scripts/compare.py:_fix_bucket_low`; `scripts/backfill_bucket_low.py` | 2026-07-01 | `tests/test_bucket_low.py` |
| Dave's Sweater Index — the consensus of the 8 independent automated forecasters, scored as its own competitor | `src/lib/composite.ts`; homepage and scoreboard | 2026-07-15 | commit `b6a32edc` (PR #127); homepage renders "Dave's Sweater Index 95.8 / 59–0–0" |
| 5-day forecast strip and lead-time accuracy decay (score by how far ahead the forecast was issued) | `scripts/leadtime.py` → `data/leadtime_scores.json`; `src/lib/leadtime.ts` | 2026-07-09 | commit `e9203cdb`; homepage "The 5-day"; `/right-wrong-ray` decay chart |
| Precip chance taken as the median of every source that publishes one | `src/lib/composite.ts` | 2026-07-28 | commit `37676cf3` (PR #152); homepage prints "31 % chance … median of the 7 that publish one" |
| 18 tracked towns — per-town capture, per-town scoring, per-town forecast page and scoreboard | `scripts/capture_locations.py`, `scripts/compare_locations.py`; `/weather/[slug]`, `/right-wrong-ray/[slug]` | 2026-07-18 → 07-19 | <https://davessweater.com/api/v1/towns> returns `count: 18`; `/weather/blowing-rock` and `/right-wrong-ray/blowing-rock` 200 |
| Town selection that follows the reader across pages, from a header picker | `src/lib/townPicker.ts`, `src/lib/townMemory.ts`; site header | 2026-07-28 | commit `cffe394a` (PR #159); header picker lists all 18 towns on `/` |
| Public JSON API v1 — `forecast`, `today`, `scores`, `verdict`, `towns`; CORS preflight; CC BY attribution in every payload; JSON 404 naming the real endpoints | `/api/v1/[endpoint]` (one dynamic function) | 2026-07-25; consolidated into one catch-all 2026-08-22 | all five endpoints 200; `src/app/api/v1/[endpoint]/route.ts`; `src/app/api/__tests__/v1Route.test.ts` |
| Prerendered RSS feeds, one per town × horizon plus a verdict feed | `/feed/[town]/[feed]`, force-static with enumerated params | 2026-07-25 | `/feed/boone/forecast-1day.xml`, `/feed/boone/verdict.xml`, `/feed/beech-mountain/forecast-5day.xml` all 200 |
| Embeddable forecast widget — a one-line script that swaps itself for a self-sizing iframe, framable on third-party pages | `public/widget.js` + `/widget` | 2026-07-25; rebuilt around forecast data 2026-07-28 | `/widget.js` 200; `/widget?town=boone&days=3` 200; `frame-ancestors *` exception in `next.config.ts` |
| River gauge readings on the widget for towns a USGS gauge actually names (no nearest-gauge borrowing) | `scripts/capture_river_gauges.py` → `data/rivers/`; `src/lib/rivers.ts` | 2026-07-25 | `/widget?town=sugar-grove` renders "Watauga River 110 cfs, 1.82 ft (USGS)"; `data/rivers/2026-08-22.json` |
| Per-town predicted peak fall-color window, with the elevation arithmetic shown and the model's own `basis` disclosed | `src/lib/leaf.ts` + `src/components/FallColorWindow.tsx` reading `data/leaf/predictions.json`; renders on `/weather/[slug]` | 2026-08-30 | `src/lib/__tests__/leaf.test.ts` (20 tests); prerendered HTML for all 17 towns carries the module (`/weather/wilkesboro` shows "October 27–November 6", `/weather/beech-mountain` "September 28–October 8"). Self-retires 45 days past a closed window |
| Cross-town fall-color hub: all 18 predicted windows, the elevation-band gradient, the model's methodology and its stated limits | `/leaf` (static route, no dynamic segment, zero functions) reading `data/leaf/predictions.json`, `data/leaf/scores.json`, and the registry's grading sources through `src/lib/leaf.ts` | 2026-08-31 | Prerendered at `.next/server/app/leaf.html`; build reports `○ /leaf` (Static) and `check_function_budget.py` holds at 10 of 10. Inbound links from `SiteFooter` (all 60 URLs), all 17 `FallColorWindow` modules, and a self-retiring homepage line. Sitemap entry stamped from the model's own `generated_at`. Static share card at `public/og/leaf.png` |
| Leaf-model grading loop: hand-recorded observations from the three published color reports, scored on rules fixed before the season | `scripts/score_leaf.py` joining `data/leaf/predictions.json` + `data/leaf/observations.json` → `data/leaf/scores.json`; runs daily in `daily_capture.yml` | 2026-08-31 | `tests/test_score_leaf.py` (14 tests); `scores.json` committed with an empty scoreboard, which is the correct state until October. Weekly reading plan in `docs/leaf-model.md` and in the observations file itself |
| Busy-ness Index leaf term driven by the model rather than a flat calendar | `scripts/compute_busyness.py` `leaf_component()` reading `data/leaf/predictions.json`; the registry's `leaf-season-2026` row carries `superseded_by` and is skipped | 2026-08-31 | `tests/test_busyness.py` (11 new tests, incl. a guard that fails if the registry flag is dropped); the term runs ~0.8 pts in early October, ~11.7 on Oct 19, ~1.7 by November |
| Leaf model self-refreshes when September temperatures exist | `daily_capture.yml` date gate (Sep 18–30) running `predict_leaf.py --refresh`; `data/leaf/` added to the workflow's commit set | 2026-08-31 | Gate logic verified against the seven boundary dates; outside the window the step logs a skip and changes nothing |
| Human-readable API/data documentation page | `/api` | 2026-07-25 | <https://davessweater.com/api> (200) |
| Open datasets published under CC BY 4.0, with the attribution string echoed in API responses | `data/LICENSE`, `data/README.md` | 2026-07-25 | commit `44db043e`; `attribution` field in the `/api/v1/today` payload |
| Winter road-condition forecast plus live closures, incidents, and Parkway alerts | `scripts/roads.py`, `capture_roads.py`, `compare_roads.py`; `/roads` | 2026-07-25 | <https://davessweater.com/roads> (200); `data/roads_forecast.json`, `data/road_scores.json`; `tests/test_roads.py` |
| Traffic predict→grade loop — corridor flow sampled at 6 pins four times daily, yesterday graded before today is forecast, once per day on whichever run lands first | `.github/workflows/traffic_actuals.yml` + `scripts/capture_traffic_actuals.py`, `compare_traffic.py`, `forecast_traffic.py`; dataset lives in a private companion repository, never in this one | actuals 2026-07-25, model 2026-07-25, dataset moved out of this repo 2026-08-14 | workflow file; four runs succeeded 2026-08-22; `tests/test_traffic_model.py`, `test_traffic_compare.py`, `test_traffic_paths.py`. **No public surface yet** — this is pipeline only |
| Freshness sentinel — an independently scheduled, read-only job that catches a cron that silently never ran (today's capture present, comparisons not stale, town captures present, plus three traffic checks when the store is mounted) | `.github/workflows/freshness_sentinel.yml`, 16:30 UTC; `scripts/check_freshness.py` | 2026-07-26; traffic coverage 2026-07-28 | run succeeded 2026-08-22T16:45Z; `tests/test_check_freshness.py`. Reads committed data — **it does not verify the production deploy** |
| Traffic freshness backstop that runs where the private store is mounted, and treats an unmounted store as a failure rather than a skip | `traffic_actuals.yml` step "Traffic freshness backstop" (`check_freshness.py --traffic-only`) | 2026-08-14 | workflow file; `scripts/check_freshness.py` `--traffic-only` mode |
| In-run capture health checks: drop guard, rolling drift detection, and an auto-backfill sweep that recovers archive-lagged days | `scripts/check_capture_health.py`, `scripts/backfill_missing.py` via `daily_compare.yml` | 2026-07-01 | commits `61643d07`, `ee163d43`, `d80bd781`; `tests/test_capture_health.py`, `tests/test_backfill_missing.py` |
| Function-budget gate that fails a pull request before the Vercel Hobby cap can freeze production — a fast static model on every PR plus a real `vercel build` ground truth, no secrets required | `.github/workflows/function_budget.yml`; `scripts/check_function_budget.py` | 2026-08-16 | commit `a6c3a828` (PR #164); run succeeded 2026-08-22; `tests/test_function_budget.py` |
| Function-tracing payload fix — prediction screenshots excluded from every serverless bundle, which is what restored deployability (payload 246 → ~59 MiB, functions 10 → 4) | `next.config.ts` `outputFileTracingExcludes` | 2026-08-22 | commit `a0fa477f` (PR #165); production serves current data again |
| Share cards rendered to static PNGs at build time (per town, per post, per report-card month) so they cost zero serverless functions | `npm prebuild` → `scripts/generate_og_images.mjs` + `scripts/og/cards.tsx`; `src/lib/ogStatic.ts` | 2026-08-16 | commit `d355c979` (PR #163); `/og/weather/blowing-rock.png`, `/og/report-card/2026-06.png`, `/og/resources/articles/is-rays-weather-accurate.png` all 200 |
| Route-level Open Graph cards for the fixed pages | `src/app/**/opengraph-image.tsx` | 2026-07-02 | commit `0fb12f02` (PR #97); `/opengraph-image` 200; `src/lib/ogCard.tsx` |
| Copy lint that blocks the test suite — pulls user-facing strings out of the codebase and enforces the mechanically decidable style rules (separator standard, colon capitalization, straight quotes, banned vocabulary read from an external shared word list, never forked in) | `scripts/copy_lint.py`; `tests/test_copy_lint.py` runs it over the real `src/` tree | 2026-07-28 | commit `c0530d2a` (PR #156); 583 pytest pass 2026-08-23; separator re-sweep `1c5fd012` (PR #160) |
| One named type scale (`ds-*` classes) instead of ad-hoc size/weight combinations | `src/app/globals.css` `@layer components` | 2026-07-28 | commit `ce7f1f9f` (PR #154); table in `CLAUDE.md` |
| Native post engine and the resources hub — Markdown/Markdoc posts under articles, news, videos, and reports | `src/content/posts/*.{md,mdoc}`; `/resources`, `/resources/[category]/[slug]` | engine 2026-07-06, hub 2026-07-02 | `/resources`, `/resources/articles`, `/resources/articles/is-rays-weather-accurate`, `/resources/news/17-high-country-towns` all 200; 6 posts in `src/content/posts/` |
| Monthly report-card franchise — a hub plus `/report-card/{yyyy-mm}`, where a new card is a Markdown file with no per-month code | `/report-card`, `/report-card/[month]` | 2026-07-26 | commit `bbfb357e` (PR #143); `/report-card` and `/report-card/2026-06` 200 |
| Legacy-URL redirects, including per-post rules generated from post frontmatter so a new article is covered automatically | `next.config.ts` `redirects()` | 2026-07-18 onward | `/blog/is-rays-weather-accurate`, `/fireworks`, `/videos` all resolve 200 after redirect |
| Fireworks and dusk report with a terrain sightline checker, backed by a small geocoder proxy that stores nothing | `/reports/fireworks-fourth-july-2026`; `/api/geocode`; `scripts/compute_terrain.mjs`, `src/lib/sightline.ts` | 2026-07-02 | page 200; `/api/geocode?address=…` returns JSON; `data/terrain.json` |
| Highland Games planner report | `/reports/grandfather-mountain-highland-games-planner-2026` | 2026-07-07 | page 200 |
| Swag shop built from the merchant RSS feed, variants deduplicated by group | `/shop`; `src/app/shop` | pre-2026-07 | `/shop` 200 with product cards rendered |
| Sitemap with `lastmod` taken from real data dates, plus robots rules | `src/app/sitemap.ts`, `src/app/robots.ts` | 2026-08-17 | commit `1e022f50` (PR #161); `/sitemap.xml` and `/robots.txt` 200; `src/app/__tests__/sitemap.test.ts` |
| Analytics stack behind a single opt-out cookie so the owner's own browsing is excluded | `src/components/AnalyticsScripts.tsx` (`ds_track=off` gate) | 2026-07-07 → 07-09 | commits `c08f4076`, `3d477f7e`, `d4461196`, `d8776c53` |
| Security headers site-wide, with a deliberate framing exception scoped to the widget | `next.config.ts` `headers()` | 2026-07-25 | `next.config.ts`; widget embeds cross-origin |
| Screenshot upload endpoint accepting a phone-shortcut dispatch and committing the capture | `.github/workflows/upload_screenshot.yml` | pre-2026-07 | workflow file. Built and wired; **no runs in the recent Actions history** — see section 3 |
| Content editor route (Git-backed CMS) reachable in production; local editing fully functional | `/keystatic`, `/api/keystatic`; `keystatic.config.ts` | 2026-07-19 | commit `fb106495`; `/keystatic` 200. Live remote editing still gated — see section 2 |

---

## 2. In progress / staged

| Capability | Where it runs | Status | Gate |
|---|---|---|---|
| Live remote content editing through the CMS | `/keystatic` in production | Route ships and renders; production editor shows the setup screen | One-time GitHub App creation plus four environment variables, then a redeploy. Steps in `docs/cms.md` |
| Demand-signal capture bench — lodging prices, short-term-rental pacing, athletics and community event calendars, campus events, races, park visitation, attention signals, weather alerts, the busy-ness index | `daily_capture.yml` (capture scripts run green daily into `data/demand/`, `data/events/`, `data/alerts/`, `data/attention/`, `data/calibration/`) | Data flowing; test-covered | No public page or API surface consumes them yet. They exist to feed the tourism and traffic forecasts |
| Traffic forecast as a reader-facing product | pipeline live (section 1) | Forecast and grading run daily against the private dataset | No published page, feed, or API endpoint. Terms on the upstream traffic data are why the dataset is private; any public surface has to be designed around that |
| Monthly report cards for July and August 2026 | `/report-card/{yyyy-mm}` | Franchise route is live and auto-picks up a new file; June 2026 is the only published card (`/report-card/2026-07` 404s) | Writing and publishing the cards |
| Standing article cadence | `src/content/posts/` | Six posts published; a topic slate exists | An owner-set interval. Backdating was rejected — dates on this site have to be true |
| Accessibility contrast fixes on the scoreboard | branch `fix/a11y-contrast-right-wrong-ray` | Open pull request #157 | Review and merge |
| Ray's day-5 lead-time parse and rescore | `scripts/capture_rays.py`, `scripts/leadtime.py` | Diagnosed, not fixed: one forecast row fails to parse in every capture, so the decay chart drops that source's line early and the page prints a caption that flatters this site on a page about fair grading | Parser fix, honest backfill from stored raw text only, rescore, then correct the caption to whatever is true afterward |
| Mobile performance work | site-wide | A PageSpeed run flagged unused JavaScript, payload size, image delivery, and cache lifetimes; not yet triaged | Confirm which findings are real before optimizing against a lab number that earlier disagreed with observed throttling by 9 seconds |
| Ground-truth weather station | none yet | Hardware chosen, pipeline shape decided, nothing ordered | Purchase and siting, then an API key and a capture job |

---

## 3. Known NOT built / decided against

Things a reasonable contributor might assume exist. Each one is a decision, not an oversight.

| Not built | Decision date | Why |
|---|---|---|
| Popular-times / venue-busyness data purchase (the one commercial source that fit) | DECLINED 2026-07-25 | Owner call, closed. Even the bounded one-month trial was declined; do not re-propose it as a quick win |
| Grading a major mapping provider's predicted travel times | DROPPED 2026-07-25 | Its platform terms bar storing or deriving content from that data. The comparison was on-brand and is still off the table |
| Local collector appliance in the data path | NOT in v1 | It buys cloud-outage resilience and sub-minute polling, neither of which a daily accuracy tracker needs, at a real maintenance cost. Can be added later without changing anything upstream |
| Traffic data stored in this repository | REMOVED 2026-08-14 | This repo is public and `data/` is published CC BY 4.0. The upstream traffic terms cover neither persistent storage nor sublicensing to anyone who clones this. Workflow artifacts were considered as a store and rejected — on a public repo anyone can download them, which would rebuild the exposure. A `.gitignore` entry on `/data/traffic/` makes re-publishing it here impossible without a deliberate forced add |
| An automated check that production actually served a deploy | NOT built | Both 2026 outages were invisible precisely because nothing checks this. The function-budget gate catches the cap at pull-request time only. The durable fix needs a deploy hook the owner has to create; until then, after any merge, probe production for the new content rather than trusting a 200 |
| Real phone-app forecast data in the Apple slot | not running since 2026-07-01 | The upload endpoint exists and works, but no dispatch has fired recently; the slot is scored from the free-API fallback and is **labeled as the fallback** on the scoreboard so nothing is misrepresented |
| A numeric precipitation total carried over for the graded paid forecaster | deliberate | That source never publishes one. Hardcoding zero would misrepresent the forecast as predicting no rain. It earns amount credit on its dry-forecast days and forfeits it on wet ones |
| Coverage-normalized scoring (an earlier scheme that scaled scores by how many fields a source answered) | REPLACED 2026-06-30 | It let a forecaster outrank a more accurate one purely by leaving the hard field blank. Replaced by the implied-zero rule |
| Storefront-API-backed shop | blocked upstream | A persistent 403 on the storefront API, unresolved with the vendor. The shop reads the merchant RSS feed instead |
| `llms.txt` | declined 2026-07-02 | Owner call |
| Per-post `twitter:image` routes | retired | Every platform this site publishes to reads `og:image`, and the remaining one falls back to it. Reproducing the family would have cost functions for nothing |
| Additional `opengraph-image.tsx` routes under dynamic segments | do not add | Each one costs a serverless function even when fully prerendered — `generateStaticParams`, `dynamicParams = false`, and `force-static` were all measured and none removes it. Ten of them froze production for a week. Add cards to the build-time generator instead |
| Splitting the v1 API back into sibling route files | do not | Grouping is the builder's decision, not ours. One catch-all is one function no matter what it decides |
| Public camera or computer-vision traffic sensing | v3, not built | Researched and costed; sits behind the v2 pipeline in the phasing |

---

## Maintenance

1. **A row lands in the same change that ships the capability.** A change that ships
   without a row leaves the next contributor one unread file away from confidently
   asserting something false about this codebase.
2. **Re-verify on any audit pass and move the header date.** Never edit a row without
   re-checking its proof — a proof pointer that no longer resolves is not a row.
3. "Not found" is a search result, not a fact. Before writing that something does not
   exist here, check this file and the build logs, and say where you looked.
