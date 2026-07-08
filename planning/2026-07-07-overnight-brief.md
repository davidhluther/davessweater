# Overnight brief — morning of 2026-07-08

Everything from last night's scope-expansion session, ready to pick up. Written while you slept; nothing
here was pushed, deployed, spent, or sent — it's all local files for your review.

---

## TL;DR (read this, skip the rest if busy)

1. **Multi-day scoring is a GO** and the data makes a *better* story than the 1-day gap: free beats Ray at
   every horizon, and the *location-fairness* question that could've bitten us is closed (he's graded at his
   own station's exact elevation and still runs 3.5° warm with a 7° miss). One honest correction to last
   night: a *separate* fairness angle — whether our "actual" is truly independent — is NOT fully closed, but
   it cuts in Open-Meteo's favor, not Ray's (see finding below), and the Ecowitt station is its fix. Spec is
   written and waiting for you.
2. **"66 locations, 3 forecasts"** is the sharpest thing we found — provable, live, reproducible. Blog post
   drafted and held. We dropped the "AI-written" angle because this one is stronger *and* safe.
3. **Your disavow file is ready to upload to GSC** — 250 domains, 100% spam, nothing legit to lose.
4. **Three things need you** (below): upload the disavow, review the scoring spec + answer 4 questions, and
   the fundraiser/non-commercial conversation we parked (it's the single fact that makes everything clean).

---

## Things only YOU can do (in priority order)

1. **Upload the disavow file to GSC** (~5 min). File: `planning/seo/davessweater-disavow.txt`. Go to
   search.google.com/search-console/disavow-links → pick the davessweater.com property → upload the .txt.
   Rationale + instructions in `planning/seo/davessweater-disavow-notes.md`. It's a DRAFT only in that I
   want you to eyeball it first; the analysis found 0 legitimate links among 250, so risk is nil.
2. **Review the multi-day scoring spec** (`planning/specs/2026-07-07-multi-day-scoring-design.md`) and
   answer its 4 open questions (also listed below). Once you approve, I'll write the implementation plan
   and build it — it's the recommended first build and it's low-risk (additive, fully backfillable, no
   change to existing scoreboard numbers).
3. **The fundraiser / non-commercial conversation** (we parked this — it's important). Ray's own Terms of
   Use *explicitly permit* sharing his forecast data "for non-commercial use" with attribution. That means
   the entire tracker may be blessed by his own terms — IF we're non-commercial. Your shop is positioned as
   a charity fundraiser; making that airtight (how proceeds are handled, how it's stated on-site) is what
   converts "defensible" into "his own terms say we're allowed." Worth 20 minutes when you're fresh.

---

## What I built overnight (all local, all for review)

| File | What it is |
|---|---|
| `planning/specs/2026-07-07-multi-day-scoring-design.md` | Full design for 5-day lead-time scoring + Ray golfballs/snowman capture. **Your review gate.** |
| `planning/seo/drafts/rays-66-locations-3-forecasts.md` | Blog post: "66 locations, 3 forecasts." HELD until our per-town pages are live. |
| `planning/seo/drafts/rays-widget-backlink-teardown.md` | Blog post: the widget/backlink teardown + our-widget launch. HELD (written earlier in session). |
| `planning/seo/davessweater-disavow.txt` | Your GSC disavow file (250 spam domains). |
| `planning/seo/davessweater-disavow-notes.md` | Disavow rationale + upload instructions. |
| `planning/seo/2026-07-07-rays-competitive-research.md` | The master research doc (site internals, backlinks, magnets, webcams, narrative audit). |
| `CHECKLIST.md` | Updated: guardrails, gate-check results, golfballs gap, domains parked to future milestone, both blog posts, subscription policy. |

---

## Key findings, in one place

**Multi-day scoring (the gate check).** Ray vs Open-Meteo, mean absolute error °F by forecast lead:

| Lead | Ray high | OM high | Ray low | OM low |
|---|---|---|---|---|
| same-day | 7.1 | 1.9 | 4.1 | 1.7 |
| 1 day | 6.9 | 2.8 | 3.8 | 2.5 |
| 2 day | 6.7 | 3.5 | 4.0 | 1.9 |
| 3 day | 6.7 | 3.8 | 3.8 | 2.1 |

Free wins everywhere; its edge is biggest at 1 day and narrows by day 4 (OM decays, Ray's flat).
**Location-fairness closed:** Ray's error is a +3.5° *warm* bias (not a cold-station offset), and his Boone
station is 3,240 ft vs our 3,242 ft grading point — 2 feet apart. No "wrong location" defense exists. We'll
disclose the bias anyway; he still loses on scatter.

**The actuals-independence caveat (your Open-Meteo question — verified 2026-07-08).** Our "actual" comes
from Open-Meteo's archive, which is **ERA5/ERA5-Land + ECMWF IFS reanalysis** — a physics model fed by
*official* stations, satellites, aircraft, buoys, radar. It is **NOT Ray's station and NOT Weather
Underground** (that's a personal-weather-station network — different product; Open-Meteo doesn't use PWS
data). So Ray has no "you graded me against my own numbers" complaint — he's graded against something
independent of him. The real, known caveat (already tracked as **R5** on `/methodology`) is the opposite
direction: our *forecast* source (Open-Meteo) and our *actual* (Open-Meteo archive) are the same provider,
and for the most recent ~5 days the archive uses ECMWF IFS — a cousin of models Open-Meteo also forecasts
from. That **flatters Open-Meteo's absolute score, not Ray's** — it can't explain Ray's 7° miss. Two
consequences: (1) the Ray-vs-field *ranking* and Ray's bias/scatter are robust; (2) Open-Meteo's absolute
number carries a self-judging asterisk we already disclose, and the **Ecowitt ground-truth station** is the
real fix (independent thermometer = the actuals stop being a model). Bottom line: your instinct was right to
ask, but it strengthens us — the circularity that exists helps the free source, so it can't be the reason
Ray looks bad.

**"66 locations, 3 forecasts."** On July 7, all 66 of Ray's station pages served just 3 distinct written
forecasts. Mt. Mitchell (6,600 ft) and downtown Boone got byte-identical prose; only the numbers differ.
Reproducible by anyone against his public API. **We are NOT claiming AI authorship** — it's human-signed
and unprovable; "one forecast published as sixty-six" is the stronger, safe, checkable claim.

**Disavow.** davessweater.com's 250 referring domains are 100% the SEOExpress-style spam network (0
dofollow, 0 organic traffic on any). Same network hitting Ray's — useful context if we ever compare
profiles publicly (don't trust his headline referring-domain count either).

**Ray's public API** (no login needed — this powers multi-location + the audits): `weather.station.list`
(66 stations + elevations), `weather.station.blurbs` (all stations' 7-day highs/lows + golfballs in one
call, date format `YY-MM-DD`), `weather.station.getForecastSummary` (per-station narratives + golfballs +
snowmanometer). Guardrail: automate only these public endpoints, never your paid login.

**Domains** (parked to a future milestone per your call): 8 real High-Country town `*weather.com` names are
unregistered today (~$12 each) — revisit when multi-location content is ready to front them.

**Webcams.** **Ray DOES charge** — his advertising starts at ~**$75/month**, and a webcam/"weather station"
sponsorship is estimated at **~$1,200–2,400/yr** (no public cam-specific rate — it's contact-for-quote at
ray@raysweather.com / 828-264-2030; the $75/mo floor is the only hard public number). So the businesses
hosting his cams are *paying* him ~$1–2k/yr for the privilege — which is itself a wedge: the same "we'll
give you a free weather widget / cheap cam listing" pitch that beats his magnet program also undercuts a
paid cam sponsorship. The important part is what a cam would cost US:
- **Cheapest viable ≈ $130 one-time, ~$0–5/mo:** weatherproof Reolink RLC-810A (4K PoE, IP67, ~$90) +
  PoE injector/mount (~$40), run as a **snapshot cam** — a cron `curl`s the camera's snapshot URL to a
  JPG every few minutes; hosting one overwritten ~200 KB still is ~$0 (Vercel/R2/B2). This is what most
  "webcams" are, including ~23 of Ray's 36 (only ~13 are live video). ~90% of the weather value at ~0% of
  the cost.
- **Nice live cam ≈ $400 one-time + $6–12/mo:** scenic PTZ (Reolink RLC-823A 16×, ~$350) + self-hosted
  **MediaMTX** (free) on a $6–12/mo VPS. Managed cloud live is the pricey path — Cloudflare Stream ~$88/mo
  (purge recordings), Mux ~$329, AWS IVS ~$831 for 24/7. Ray runs his ~13 live cams on ONE self-hosted
  Wowza box (~$195/mo), so his marginal cam ≈ just another $130 camera. **We can beat his economics
  outright** — same open-source stack on one cheap VPS, or skip live entirely and post snapshots for ~$0.
- **The crux for backlinks:** expose ONE public, auto-updating snapshot JPG URL (e.g. davessweater.com/cam/
  latest.jpg), pointed at open sky. That single URL is what every directory ingests — do it first.
- **Directories (free → link), in ROI order:** **Windy Webcams** (windy.com/webcams/add — best; DR-huge,
  confirmed dofollow "source" link, and seeds the downstream travel-site re-embed cascade that is most of
  Ray's ~380 domains), **Ventusky** (ventusky.com/webcam/add — separate queue, confirmed dofollow "Provided
  by" link), **WebcamGalore**, **EarthCam** (free form; don't buy their hardware). ⛔ NOT Insecam
  (unauthorized feeds — reputational liability); Wunderground webcams discontinued 2021.
- **Siting is the real constraint** (power + internet + view — why Ray uses sponsor businesses). Your
  fireworks-LOS vantage is unique content but privacy-sensitive; a mountains-only framing or partner
  location is cleaner. A deliberate decision, not overnight.
- **Verdict:** genuine backlink asset at near-zero cost (snapshot path), and the "businesses PAY Ray ~$1–2k/yr
  for this" angle is a real widget/cam wedge — but it belongs in the later (Ecowitt) milestone; lower
  leverage than widget/locations, and siting needs a call.

---

## Decisions locked last night

- **5-day scoring ceiling** (days 6–7 are paywalled narrative, not cleanly scoreable). ✓
- **Drop the AI-authorship angle** in favor of the provable "3 packaged as 66." ✓
- **Domains → future milestone** with Ecowitt, not now. ✓
- **Guardrails** ("bulletproof in daylight"): facts not prose, attribute, non-commercial, automate only
  public endpoints, no unprovable claims. Full text in CHECKLIST.md. ✓
- **Attack order stays:** clean up our own house + lock in defensible locations → build our widget → place
  it on sites → then publish the teardown posts → ExploreBoone/TDA last (diplomacy, his likely relationships).

## The 4 open questions on the scoring spec

1. Extended-lead scoreboard: full 100-pt model (recommend) or high/low-only? (I'd keep full model as the
   number, lead the *chart* with high/low MAE.)
2. Where does the accuracy-decay chart live — `/right-wrong-ray` (recommend), `/methodology`, or homepage?
3. Show a bias-corrected view, or just disclose the +3.5° bias number? (Recommend: disclose the number.)
4. Confirm 5-day ceiling is final (lead-4 sample is thin today, n≈9, but thickens as history accrues).

## Recommended build order (once you approve the spec)

1. **Multi-day 5-day scoring** (backfill + daily + `/methodology` disclosure) — the recommended first build.
2. Fold in **golfballs/snowman capture** (same Ray-capture code) so the "how sure was Ray?" calibration
   starts accruing.
3. **Multi-location** (reuses the lead-time model + location registry the spec already defines) — this is
   what makes the "3-forecasts" post publishable and what the parked domains front.
4. **Our widget** (the backlink play we fully control) → placement → then the held posts go live.
5. Later milestone: webcam, Ecowitt station, domain grabs.

Nothing is blocked on me. When you've reviewed the spec and answered the 4 questions, I'll write the
implementation plan and start building.
