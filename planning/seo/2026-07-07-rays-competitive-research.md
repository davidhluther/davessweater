# Ray's Weather competitive research — 2026-07-07

Two-agent research pass (live site/API dig + Ahrefs backlink teardown) supporting the scope-expansion
brainstorm: multi-day scoring, multi-location coverage, and the backlink strategy. Raw findings below;
design decisions live in the eventual spec, not here.

## Ray's site internals (recovered from JS bundles + public tRPC API)

raysweather.com is a client-rendered Next.js SPA (Prisma/tRPC backend, NextAuth, PostHog). The read
endpoints are **publicly queryable without auth**:

- `GET /api/trpc/weather.station.list` — all **66 forecast stations** (Wytheville VA → Waynesville NC).
- `GET /api/trpc/weather.station.blurbs?input={"json":{"date":"YY-MM-DD"}}` — ONE call returns all 66
  stations: 7-day `forecastContent` (high/low/iconDay/iconNight/golfballs per day) + current obs
  (temp, wind speed/dir/gust, humidity, rainToday). Date format is `YY-MM-DD`.
- `GET /api/trpc/weather.station.getForecastSummary?input={"json":{"stationName":"Linville"}}` — per-station
  7-day with the **human-written `dayForecast`/`nightForecast` narratives**, `golfballs` (1–5 self-rated
  confidence), `snowmanometer`, plus free-text `introduction`/`discussion` and `publishedBy` (human author).
- Legacy mobile backend: `gamma.raysweather.com/mobile`.

Forecast facts: 7 days (today + 6), same format for all 66 stations. **No numeric wind, no precip %, no
QPF anywhere** — wind/precip live only in the prose narrative. `golfballs` is Ray's own per-day confidence
self-rating (a scoreable "how sure was he" signal nobody has exploited).

Business model: freemium, **$26/yr** (5-day trial). Free tier: 7-day forecasts, current conditions, radar,
webcams, magnet creation. Paid: forecast discussion, snow tools (Snowman-O-Mometer, 200+ spotter network,
Fearless Winter Forecast), alerts, personalization, archives, 30-day outlook. No published ad/sponsorship
rate card; `/sponsors` route is an unbuilt placeholder. ~7 employees, ~65 stations, ~30 webcams (their copy).
Merch via RaysMarketplace.com.

## Magnets (raysweather.com/magnet/*)

- Embeddable per-station weather badge in an `<iframe>`; creation UI at `/my/magnets` + `/widgets` with a
  "Copy Embed Code" button; configurable colors/size (default 350px).
- **Free** — "no subscription required," capped at **3 per free user** (admins unlimited). No charge found.
- Terms of use REQUIRE the backlink: "You must maintain the link back to the corresponding forecast page…
  do not use attributes that would prevent referral information." Ray's tracks impressions/clicks per embed
  (`magnets.logClick`, collects IP + pseudonymous visitor id).
- Ahrefs: only **8 referring domains** embed magnets, but they include **exploreboone.com (DR 60, sitewide,
  dofollow frame link, empty anchor — homepage, /things-to-do/, /restaurants/, /about/live-webcam/ etc.)**,
  dev.mountainx.com (DR 73), hcpress.com (DR 54), parkwaycabins, vacationsugar, wolflaurelcommunity.
- "Broken" experience confirmed: magnet pages are JS-only (blank without JS), silently render null on unknown
  station ids; legacy ids survive via hard-coded remaps + mag.raysweather.com redirects.
- SEO note: iframe `frame` links pass far less than a real `<a>` — the magnet's value to Ray's is brand
  exposure + referral traffic + the handful of dofollow frames.

## Webcams

- ~36 camera groups (58 views): **sponsored/hosted by third-party businesses** (every cam has a `sponsorURL`:
  Wendy's, LifeStore Bank, App Ski Mtn, Boone Golf Club, Skyline National Bank ×4, chambers/TDAs, etc.);
  Ray's aggregates them. Still images at `raysweather.com/images/webcams/...`; live streams are HLS off a
  Wowza server (`6182b61737503.streamlock.net`), 13 views live.
- No "sponsor a webcam" pricing page — sponsor-funded model, rates private.
- Cam pages earn ~380 referring domains (Roaring Gap 131, Wendy's Boone Street Cam 116, Downtown West
  Jefferson 101) — mostly travel/directory sites. Webcams are a genuine link magnet.
- Some cam URLs are dead and still linked: `/Webcams` (14 RD, 404), tailofthedragon.com (DR 58) →
  dead `/Webcams/Howards+Knob`, ventusky.com (DR 73) → dead `/Webcams`.

**Cost to sponsor his (does he charge?) + DIY to match him (researched 2026-07-07, 3 sub-agents):**

*He DOES charge — but sourcing is thin, be precise.* The ONLY sourced number is "advertising options
starting at **$75 a month**," covering "text ads, banner advertising and weather station sponsorship"
(Ashvegas, quoting Ray's own pitch; he claims 200–300k monthly uniques). That's a starting floor across ALL
ad types, **not webcam-specific**, and no published webcam rate exists (contact-for-quote,
ray@raysweather.com / 828-264-2030). The **~$1,200–2,400/yr cam figure is OUR estimate** (extrapolated from
the $75 floor + comparable weather-site sponsorships) — do NOT cite it as a Ray's number. What's defensible:
"Ray sells sponsorships from a reported ~$75/mo" and "host businesses clearly pay him" — the wedge (free
widget / cheap cam) holds regardless of the exact figure.

*DIY, our cost:*
- **Cheapest viable ≈ $130 one-time / ~$0–5-mo:** Reolink RLC-810A (4K PoE IP67, ~$90) + PoE injector/mount
  (~$40), run as a **snapshot cam** (cron `curl`s the camera's snapshot URL → overwritten ~200 KB JPG,
  hosted ~free on Vercel/R2/B2). ~90% of the weather value at ~0% of the cost; what ~23 of Ray's 36 cams are.
- **Nice live cam ≈ $400 one-time + $6–12/mo:** PTZ (Reolink RLC-823A 16×, ~$350) + self-host **MediaMTX**
  (free) on a $6–12/mo VPS. Managed cloud live = pricey: Cloudflare Stream ~$88/mo (purge recordings), Mux
  ~$329, AWS IVS ~$831 for 24/7. Ray runs ~13 live cams on ONE Wowza box (~$195/mo) → his marginal cam ≈ a
  $130 camera. **We can beat his economics** (same open-source stack on one cheap VPS, or snapshots for ~$0).
- **Backlink crux:** expose ONE public auto-updating snapshot JPG URL — that single URL is what every
  directory ingests; stand it up first.
- **Directories (free → link), ROI order:** **Windy Webcams** (windy.com/webcams/add — best DR, confirmed
  dofollow "source" link; seeds the downstream travel-site re-embed cascade = most of Ray's ~380 domains),
  **Ventusky** (ventusky.com/webcam/add — separate queue, confirmed dofollow "Provided by" link),
  WebcamGalore, EarthCam (free form, skip their hardware). ⛔ NOT Insecam (unauthorized feeds); Wunderground
  cams discontinued 2021.
- **Siting** = the real constraint (power+internet+view — why Ray uses sponsor businesses). Owner's
  fireworks-LOS vantage is unique but privacy-sensitive; mountains-only or partner location is cleaner.
- Verdict: real backlink asset at near-zero cost + a wedge against his paid cam sponsorships, but a later
  (Ecowitt) milestone — lower leverage than widget/locations, and siting needs a deliberate call.

## Backlink profile (Ahrefs, 2026-07-07, subdomains, live)

- raysweather.com: **DR 46**, 1,479 referring domains (798 dofollow), 17,084 backlinks, ~8K/mo est. organic.
- ⚠️ A spam/link-selling network started blasting the whole `*weather.com` family ~May 2026 — hundreds of
  the RDs and the top-3 anchors are this junk (all nofollow). It also hit **davessweater.com** (DR 0,
  239 RD ≈ all spam, 0 dofollow). Never benchmark against his headline RD number.
- Top link targets: homepage (~950 RD across variants); /Forecast/* town pages in aggregate (Boone 365,
  Asheville 347, Hickory 229 …) though spam-diluted; webcams ~380; magnets 8.
- **Four town forecast pages are 404 with 100+ RDs each: Hendersonville (119), Wilkesboro (114),
  Burnsville (103), Mount Airy (102)** — he apparently dropped those markets; links still point at them.
- Top legit anchors are all brand/domain names (RaysWeather, booneweather, ashevilleweather, averyweather,
  Ray's Weather) — essentially no generic "forecast"/"webcam" anchors at scale.

## Redirect domains (booneweather.com, asheweather.com, …)

**Not purchased keyword domains — his own original regional editions** ("Ray's Weather Center" network),
later consolidated and 301'd into raysweather.com:

| Domain | DR | RD | Verdict |
|---|---|---|---|
| booneweather.com | 30 | 513 | Original brand; real legacy profile since ≤2014; live links from grist.org (83), appstate.edu (79), seventeen.com (77), summitpost.org (75) still point at it; deep links to dead paths (`/snowforecast.shtml`, `/Forecast/Valle+Crucis`) |
| averyweather.com | 27 | 369 | Legacy regional edition (only ~67 dofollow RD are real) |
| asheweather.com | 14 | 311 | Legacy edition; own old content paths; spam-spiked Mar→Jul 2026 |
| bannerelkweather.com / wataugaweather.com | ~0 | ~275 | Spam-inflated shells |
| blowingrockweather.com | 0 | 0 | Nothing indexed |

A meaningful slice of his DR 46 is inherited 301 equity, and it's **decaying** (dead deep paths, rotting
legacy links; booneweather RD peaked ~320 in 2016 → ~190 by 2024). Buying exact-match domains to 301 is a
dated strategy — 301s pass real equity he had already earned, but fresh keyword domains earn nothing today.
Not worth copying; the decay is the exploit (see reclamation list).

## Broken-backlink reclamation targets (legit, spam filtered)

| DR | Linking page | Dead target | Angle for DS |
|---|---|---|---|
| 79 | dsoftp.appstate.edu/web/FavLinks.htm | /snowforecast.shtml | Boone snow forecast page |
| 75 | summitpost.org/round-bald/218638 | old Roan Mtn forecast path | forecast page |
| 73 | ventusky.com/id/webcam-769741618 | /Webcams | needs a live Boone cam |
| 73 | dev.mountainx.com (Shuler article) | /Fearless+Forecast | seasonal forecast content |
| 64 | smokymountainnews.com | /Photo+Contest | — |
| 58 | **tailofthedragon.com/area-web-cams/** | /Webcams/Howards+Knob | wants a live Boone webcam |
| 58 | newschoolers.com forum | /Almanac/Boone+Snow/2014+2015 | **Boone snow-history data** |
| 54 | hcpress.com article | /Archive/Boone | historical Boone temps — our actuals archive |
| 78 | myplace.frontier.com | /Forecast/Burnsville | dropped-market town page |

Plus the four 404 town pages above (100+ RD each). Ray's dead `/Almanac/Boone+Snow` = snow-history content
gap our actuals archive can fill.

## ExploreBoone specifics

exploreboone.com (DR 60) links to Ray's **only** via the sitewide magnet iframe
(`raysweather.com/embed/magnet/157945a2-…`), dofollow frame, empty anchor — no editorial citation found.
Their `/about/live-webcam` page embeds Ray's widget. Displacing it = offering the TDA a better free widget
(and eventually a cam). Note it's a widget partnership, likely relationship-backed — probably not the
*first* target despite being the flashiest.

## Narrative audit (2026-07-07) — "66 locations, 3 forecasts"

**The provable finding (confidence VERY HIGH, live public API, reproducible by anyone):** On 2026-07-07,
all **66 stations collapsed to exactly 3 distinct narrative texts**, all authored by the same person
(`publishedBy: fujiwhara@gmail.com`):

| Group | # stations | Elevation span | Title |
|---|---|---|---|
| 1 (mountains/High Country) | 45 | 2,280 → **6,600 ft** | "Dodgeball Showers/Thunderstorms" |
| 2 (foothills/valley) | 13 | 1,030 → 1,620 ft | "Same Old Song and Dance" |
| 3 (Asheville basin) | 8 | 2,120 → 2,880 ft | "Same Old Song and Dance" |

Group 1's byte-identical prose is shared by **Mt. Mitchell (6,600 ft, highest peak east of the Mississippi),
Boone (3,240 ft), Beech Mountain (5,028 ft), Sugar Mountain Top, and Linville Ridge** — a >4,300 ft range
reading the same sentence word-for-word (verified `==` in Python on `introduction` + `discussion`). Only the
NUMBERS (`forecastContent` high/low) are per-station — same day, Mt. Mitchell 67°F vs Hickory 93°F, a 26°F
spread under identical prose. `mediaForecast`/`gametimeForecast`/`announcements`/`promotionalContent` are
identical across ALL 66. Re-pulled to rule out a caching fluke — 3-hash clustering reproduced.

Provable public claim: *"Ray's advertises a 7-day forecast for 60+ locations. On 2026-07-07 all 66 shared
just 3 written forecasts — a 6,600-ft summit and a valley town read word-for-word identical. Only the
temperature numbers differ."* Checkable by anyone against his own public API.

**API shape correction:** narrative is NOT in `dayForecast`/`nightForecast` (those don't exist). It's in
`forecast.introduction` (~4 sentences) + `forecast.discussion` (~870 chars) from `getForecastSummary`;
`blurbs` returns numbers only. `weather.station.list` includes each station's elevation + a `site` field
(the legacy subdomain it belongs to, e.g. Mt. Mitchell → BurnsvilleWeather.Com).

**⚠️ DO NOT assert AI-authorship (confidence LOW / unfalsifiable, and legally unsafe per guardrail #6).**
Prose is human-signed (`fujiwhara@gmail.com` — the Fujiwhara effect is a real meteorology term), has
idiosyncratic human voice ("dodge-'em PM thundershowers," em-dash tics). Consumer AI-detectors are
unreliable. The "written once per region, stamped across 66 locations" claim is FAR stronger — it's proven
outright and needs no hedging. Drop the AI angle; keep the factual one.

**History (Wayback, confidence MEDIUM-HIGH on structure, LOW on dating the prose):** the regional-narrative-
across-many-towns model is ~18 years old — stations were grouped under ~10 regional subdomains by 2008
(~31 station archives) → ~13 subdomains / ~47 archives by 2012 → full ~60-town roster by Jan 2021 →
66 today. Could NOT extract historical prose text (JS-rendered, not in Wayback HTML), so we can say the
roster "scaled ~31→66 since 2008, fed by a handful of regional writeups" but CANNOT claim a dated
narrative-dilution trend. Lead public framing with the live (present-tense) finding, not the archive.

## Our own data inventory (multi-day readiness)

Every daily capture since **2026-03-04 (125 days, the whole Ray era)** already stores full multi-day arrays
for all 10 sources, including Ray's 7-day scrape (extended Ray days: high/low/precip_type from icons/prose;
wind_mph null, precip_in null). Days captured per source (2026-07-06): Ray's 7, Open-Meteo 7, NWS 7,
Visual Crossing 15, met.no 11, OWM 6, Tomorrow.io 6, Google/Apple-fallback/WeatherAPI 3.
`compare.py` already row-matches by exact date → lead-time scoring is a generalization + backfill, no new
capture infra. This also unlocks the parked "how accurate is a 10-day forecast" article's missing original
dataset (its brief currently forbids implying we measured decay — after this, we'll have measured it).
