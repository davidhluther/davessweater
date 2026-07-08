# Dave's Sweater — Checklist

This file is the durable single source of truth for outstanding work. Read it at the
start of each session and keep it current — check items off, add new ones, and update it
in the same change that completes a task. Do not rely on chat memory; this file wins.

> **📋 2026-07-08 morning:** start with `planning/2026-07-07-overnight-brief.md` — the scope-expansion
> session summary (multi-day scoring spec ready for review, disavow file ready to upload, 2 held blog
> posts, 3 things that need you). Then the "Scope expansion" section below.

## Decisions made
- **Migrating presentation to Next.js** (owner's standard stack) and growing DS from a low-effort
  joke into a substantive, Ray's-Weather-class local weather site; the **Right/Wrong Ray accuracy
  tracker is the signature differentiator**. Python data pipeline + scoring stay as the data source.
  See `planning/specs/2026-06-21-m1-nextjs-port-design.md`.
- Start with ONE full weather station in Boone; expand later.
- Hardware: Ecowitt Wittboy (WS90) all-in-one array + GW2000 gateway (~$200). Chosen over
  Ambient Weather WS-2902 (pricier, more locked-in). WS90 uses a haptic rain sensor (no
  moving parts to freeze/clog).
- Pipeline v1: station → ecowitt.net → Ecowitt API → GitHub Actions pull → commit to repo.
  Cloud-only path; fits the existing stack.
- Orange Pi NOT in the v1 pipeline. Local-push (GW2000 → Pi collector) only buys
  cloud-outage resilience / sub-minute polling / full data ownership — none of which a
  one-station daily/hourly accuracy tracker needs, and it adds a real maintenance tax. Add
  the Pi later only if local resilience or sub-minute multi-station data is genuinely needed;
  it can be added without changing anything upstream.

## Scope expansion — brainstorm open (2026-07-07)
Owner kicked off scoping: multi-day (5-day) forecast scoring, multi-location coverage, and going after
Ray's backlink strategy. Research pass DONE (two agents: live raysweather.com API/bundle dig + Ahrefs
teardown) → **`planning/seo/2026-07-07-rays-competitive-research.md`** (read it before touching any of
this). Headlines: all 125 Ray-era capture days already store every source's full multi-day arrays (incl.
Ray's 7-day) so lead-time scoring is scoring-layer + backfill only; Ray's has an unauthenticated tRPC API
(66 stations, one call); magnets are free iframe widgets (ToU mandates the backlink; ExploreBoone carries
one sitewide, dofollow, DR 60); redirect domains are his own legacy regional brands 301'd in (equity
decaying, not a strategy to copy); webcams are third-party-sponsored, aggregated by Ray's; four of his
town /Forecast pages 404 with 100+ RDs each (Hendersonville, Wilkesboro, Burnsville, Mount Airy); a
broken-backlink reclamation list is in the doc. ⚠️ A spam link network hit the whole *weather.com family
incl. davessweater.com (~all 239 of our RDs) — never trust headline RD counts.
- [ ] Design + spec the picks with the owner (multi-day scoring is the recommended first move; no
      implementation until a spec is approved).
- [ ] **Blog post: Ray's widget/magnet link strategy** (owner-requested 2026-07-07). The "Magnets" are
      free embeddable iframe badges (current conditions + 48-hr forecast) whose Terms of Use *require*
      keeping the backlink and forbid `rel="noreferrer"` — i.e., the price of the free widget is a link.
      3 per account, domain-registered, click/impression tracking (IP + pseudonymous visitor id).
      Recommended angle: pair the post with LAUNCHING OUR OWN widget — explain how the free-widget-for-
      backlinks trade works (quote the ToU briefly, commentary/criticism), then offer ours: real `<a>`
      link, works without JS, unlimited, accuracy-audited, "no strings — well, one string, and we tell
      you what it is." Voice guardrail: dry and factual, not bitter; every claim sourced to the ToU text
      or Ahrefs data (research doc has both).
- [ ] **Decide the Ray's-subscription capture policy** (owner subscribed 2026-07-07): what we capture
      from the paid tier, at what cadence, facts-only vs. quoted excerpts. See discussion in session +
      research doc; default posture = gentle daily facts capture + screenshots as evidence, criticism/
      review quotes only, no republication, no hammering authenticated endpoints.

### Compliance guardrails (agreed 2026-07-07 — "bulletproof in daylight")
The whole program routes around these lines (owner asked them defined; not legal advice):
1. **Facts vs. expression** — his numbers (highs/lows/wind/golfballs/snowman/dates) are uncopyrightable
   facts, free to record/score/archive/chart. His prose narratives, Fearless Forecast essays, and photos
   are protected expression — quote only briefly as criticism w/ attribution; never republish or clone-
   paraphrase.
2. **His ToU blesses the tracker IF non-commercial** — his terms explicitly permit sharing "forecasts
   data, analysis, quotes… for non-commercial use" with "RaysWeather.Com" cited as source. So everything
   hinges on the **commercial** question → the shop-as-charity-fundraiser positioning must be made
   watertight (DEFERRED discussion, owner flagged). Always attribute.
3. **"No archiving" clause** — can't override the fact/expression line and is contradicted by his own
   non-commercial-sharing grant; we store facts + attribute + stay non-commercial, not his prose/images.
4. **Automate only the PUBLIC unauthenticated tRPC endpoints**; use the paid login as a human for
   verification + scoring premium claims — never point a scraper at the authenticated session (subscriber
   ToS bars credential-sharing beyond immediate family + almost certainly bars paid-tier scraping).
5. **Parody/trademark** — keep "Not affiliated" prominent, no logo/trade-dress use (already clean).
6. **Defamation limit on marketing** — only truthful facts + labeled opinion. "Written once and stamped
   across N locations" is a checkable FACT (safe); "an AI wrote it" is unfalsifiable (unsafe) — do NOT
   assert AI-authorship as fact. Consumer AI-detection is unreliable.

### Multi-day scoring — gate check RAN 2026-07-07 (spike on existing archive, high/low MAE by lead)
Result: **multi-day does NOT hand Ray a win.** Open-Meteo beats Ray at every measurable horizon; free's
edge is largest at 1 day and narrows by day 4 as OM decays while Ray stays flat — a MORE credible story
than the single 1-day gap ("free's lead is biggest exactly when you're planning tomorrow").
MAE °F (Ray high / OM high) by lead: 0→7.1/1.9, 1→6.9/2.8, 2→6.7/3.5, 3→6.7/3.8, 4→4.4*/3.7 (*n=9).
Two SPEC MUST-FIXES before publishing:
- [ ] **Systematic-offset guard**: Ray's high error is FLAT ~7° across leads (not skill decay → a
      systematic station/elevation offset vs our grading lat/lon). Grade against a station-appropriate
      baseline or disclose/neutralize the bias, else "you graded me at the wrong spot" is his counter.
- [ ] **Honest horizon ceiling**: our archive reliably scores Ray to ~4 days out (sample cliffs 121→9
      at lead 4), even though he publishes 7. Call it 5-day scoring max, disclose the thinning.
- [ ] Spec multi-day scoring (lead dimension in comparisons/, backfill script, per-field fairness at
      extended leads since Ray gives no wind/QPF past day 0). RECOMMENDED FIRST BUILD.

### "How sure was Ray?" audit — golfballs + snowman-o-mometer (owner-requested 2026-07-07)
His per-day `golfballs` (1–5 self-rated confidence) and `snowmanometer` (snow-likelihood) are published
FACTS via the public API — nobody has ever audited whether his stated confidence tracks his actual
accuracy. Killer factual piece: "when Ray says 5 golfballs, is he actually right more often?"
- [ ] **Capture golfballs + snowmanometer** — NOT currently in `rays_boone.json` (confirmed 2026-07-07);
      add to the Ray capture (public API or scrape) so it accrues going forward; backfill from Wayback/
      raw_text where possible.
- [ ] Build the confidence-calibration analysis once enough days accrue (reliability curve: stated
      golfballs vs measured accuracy). Fold into the multi-day / audit milestone.

### Narrative audit — ✅ DONE 2026-07-07 (finding in research doc)
**"66 locations, 3 forecasts."** On 2026-07-07 all 66 stations collapsed to exactly 3 distinct narrative
texts (same author, `fujiwhara@gmail.com`); Mt. Mitchell (6,600 ft) and Boone valley read BYTE-IDENTICAL
prose — only the numbers differ. Reproducible by anyone via his public API. This is the provable dagger.
**Drop the AI-authorship angle** (human-signed, unfalsifiable, unsafe per guardrail #6); "written once,
stamped across 66 locations" is far stronger and needs no hedging. History: regional-stamp model ~18 yrs
old, roster scaled ~31→66 since 2008 (can't date the prose dilution — Wayback didn't capture JS-rendered
text). Full detail in `planning/seo/2026-07-07-rays-competitive-research.md`.
- [ ] Candidate article/section: "Ray's Weather has 66 locations and 3 forecasts" — a live, checkable
      teardown. Pairs naturally with the multi-location build (OUR per-town pages ARE genuinely per-town).
      Hold publish alignment same as widget post (don't tip the hand before our locations are live).

### Legacy / expansion domains — PARKED as a FUTURE MILESTONE (owner call 2026-07-07)
Owner: park domain research in the next-phase list, alongside the Ecowitt station and other down-the-road
work — not an immediate action. Ray's live legacy brands are defended anyway (booneweather.com renewed
Jan 2026 exp 2027, unlocked; ashevilleweather.com exp Jun 2027; asheweather exp Oct 2026 + averyweather
exp Sep 2026 both unlocked but he'll likely renew; wataugaweather.com fully lock-flagged exp 2028). Don't
chase live ones (backorder is a lottery + 301'd equity is stapled to raysweather).
- [ ] **[FUTURE MILESTONE]** When multi-location content is ready to front them, revisit registering the
      then-available real-town names. UNREGISTERED as of 2026-07-07 (~$12 each): blowingrockweather.com,
      linvilleweather.com, newlandweather.com, deepgapweather.com, vallecrucisweather.com,
      foscoeweather.com, sevendevilsweather.com, grandfatherweather.com. Rule: only buy a name once real
      per-town content will front it (a keyword domain with no content is worthless). Re-check availability
      at that time — these may get taken. beechmountainweather / sugarmountainweather are TAKEN (exp Oct 2026).
- [ ] **[FUTURE MILESTONE]** Optional low-priority drop-watch on asheweather/averyweather (exp fall 2026).

### Webcam as a backlink asset — FUTURE MILESTONE (with Ecowitt; researched 2026-07-07)
Webcams earn Ray ~380 referring domains; a live/snapshot Boone cam is a proven link magnet. **Ray charges**
(advertising from a **reported ~$75/mo**, per Ashvegas quoting his pitch — covers text/banner/station
sponsorship, NOT webcam-specific; no published cam rate. The ~$1.2–2.4k/yr cam figure is OUR estimate, not
his number — don't cite as fact). Host businesses clearly pay him → wedge for our free-widget/cheap-cam pitch. Our cost: cheapest viable ≈ **$130 one-time / ~$0–5-mo** (Reolink
RLC-810A ~$90 + PoE/mount ~$40 snapshot cam, JPG every few min, hosted ~free — what ~23 of Ray's 36 "cams"
are); nice live cam ≈ $400 + $6–12/mo self-hosting MediaMTX (vs Ray's one Wowza box ~$195/mo — we can beat
his economics). Backlink crux: expose ONE public snapshot JPG URL first; then submit to **Windy** +
**Ventusky** (both confirmed dofollow), WebcamGalore, EarthCam. ⛔ not Insecam. Real constraint is SITING
(power+internet+view); owner's fireworks-LOS vantage is unique but privacy-sensitive → deliberate decision,
not now. Detail in `planning/seo/2026-07-07-rays-competitive-research.md`.
- [ ] **[FUTURE MILESTONE]** Stand up one cheap snapshot cam + submit to Windy/Opentopia/etc. for links;
      decide siting + privacy first. Lower leverage than widget/locations — sequence after those.
      **Field playbook ready: `planning/seo/webcam-pitch-playbook.md`** — pilot-first path, scoping checklist
      (what to confirm from the business), siting checklist, hardware "make it better than his" menu, cost
      table (~$130–180/snapshot cam, ~$500–900 for 3–4 + $12/mo vs his ~$1–2k/yr EACH), and the pitch
      positioning that beats him beyond price (own-asset embed on the sponsor's site + they keep the SEO +
      timelapse/night/heater quality + "part of the accountability story" + directory reach; honesty
      guardrail: never claim we out-draw him). Pitch one-liner lives in §5.
- [ ] **⏸️ Leave-behind DEFERRED (owner, 2026-07-08):** don't build the customer-facing one-page pitch sheet
      until (a) pricing is ironed out (only ~$75/mo is sourced; the cam $/yr is our estimate) and (b) the
      quality story is locked. Ray's night cam grid (dark/fuzzy/obstructed/duplicative) is real before/after
      ammo — grab screenshots when we build ours.

### Traffic forecast — NEW long-term idea (owner, 2026-07-08; deeper, own milestone)
Owner wants to pursue a **Boone traffic forecast** — the accuracy bit extended to a universal local pain
(the 321/421 bypass, King St, App State game days / move-in, leaf + ski season, downtown events). Traffic
here is heavily **calendar/event/weather-driven → genuinely forecastable**, which is exactly what makes a
*forecast* (not just a live cam) winnable, and nobody local does it. **Cameras CAN double as the sensor**
(owner's insight: Ray's "Wendy's cam" is really 4 cams covering each approach of the intersection — the
template for a congestion sensor). Two data-source paths to weigh in a real brainstorm/spec:
  - **(a) Our own cams + computer vision** — vehicle-count/speed via a detection model on the snapshot feed →
    build a congestion "actuals" dataset → forecast AND score it (on-brand; owns the data; heavier lift;
    privacy = aggregate counts only, no plates/faces; night/weather robustness is the hard part). One
    multi-angle install per chokepoint (the Wendy's 4-way pattern).
  - **(b) Existing traffic data** — Google/TomTom/HERE traffic APIs or NCDOT DriveNC/511 cams+incidents →
    faster to a forecast, less "ours," proven data.
  - **Likely winning hybrid:** forecast from calendar + events + **weather (we already have it!)**, validate
    against a traffic API now and camera-CV later (mirrors the Ecowitt "own ground truth" arc). Weather→traffic
    (snow/rain/leaf-sun) is a natural bridge nobody local connects.
- [ ] **[FUTURE MILESTONE / brainstorm]** Scope the traffic forecast as its own project (data source a vs b vs
      hybrid, chokepoint list, CV feasibility, privacy, scoring model). Synergy: if we site backlink cams at
      chokepoints (bypass, King St), they do double duty as traffic sensors — site with that in mind.
  - **Brainstorm IN PROGRESS (2026-07-08). Scope locked by owner:** (1) PRODUCT = **hybrid** — scored
    predictive forecast (the differentiator) + live-conditions hook + winter road conditions as a first-class
    pillar; (2) GEOGRAPHY = **Boone chokepoints first** (~2-6 cams: US-321/421 bypass, King St, US-321↔Blowing
    Rock, NC-105/321 split), prove then expand; (3) DATA = **hybrid buy-now-build-later** — ship a forecast on
    NCDOT + a traffic API, add our own cameras + vehicle-recognition as independent ground truth later (the
    Ecowitt arc). Owner willing to expand further out once proven. Research running (data sources+pricing, CV
    cost, competitive whitespace) → spec when it lands.
  - **Killer on-brand angle (design):** we grade OTHERS' traffic predictions too — Google's "typical traffic"/
    predicted ETAs are a forecast we can score. Google's generic curve doesn't know about the App State game or
    tomorrow's snow; ours does. A traffic "Right/Wrong Ray" that beats Google on event/weather days, proven with
    a public scoreboard, is the differentiator.
  - **CV cost — RESEARCHED 2026-07-08 (big de-risk):** vehicle-recognition "actuals" run on the EDGE for ~$0/mo.
    Sweet spot = **Raspberry Pi 5 + Hailo AI HAT+ 13 TOPS (~$70 hat, ~$150/site)**; NOT cloud vision APIs
    (~$43–194/cam/mo, linear forever + worse) and NOT rented GPU (~$200–430/mo). **Target CONGESTION LEVEL
    (free-flow/heavy/stopped, ~94%+), not precise counts** (85–95% and fragile at night/snow) — which is also
    the honest, defensible metric for the bit (headline the level, footnote any count). Turnkey stack, ~nothing
    bespoke: **Frigate** (ingest + car detection, runs on Pi5+Hailo) → **supervision/ByteTrack** (track/count) →
    density rule → bucket. Cheapest viable **~$130–150 one-time/site, ~$0/mo**; does-it-well **~$500–900 for
    2–4 sites**. Slots into the existing `scripts/capture_*.py` → `data/actuals/{date}.json` pattern (greenfield;
    no traffic code yet). Honesty caveat: one cam = one segment sample — scope the claim per instrumented segment.
  - **Competitive whitespace — RESEARCHED 2026-07-08 (verdict: OPEN + on-brand):** nobody — local or national —
    publishes a *scored, event+weather-driven local* traffic forecast. Google/TomTom/INRIX do generic typical-day
    prediction (not event-aware in advance for a small town); DriveNC/511 + Ray do current-state cameras/conditions
    only (**Ray does NO road conditions/forecast — cameras+weather only**; his Wendy's cam sits at NC-105/US-321).
    **The scoring layer is the moat** ("we grade weather forecasts — now traffic too"). ⚠️ **WataugaOnline.com is
    a respected local incumbent** (ad-hoc predictive "allow extra time" alerts + beloved FB community) — position as
    systematic/complementary, do NOT attack.
  - **Grading (research-confirmed, maps onto `scripts/scoring.py`):** travel-time **MAE per corridor** (like temp
    tolerance) + **Brier score** for the binary "will it be jammed?" (the "chance of rain" lineage — on-brand) +
    **Brier Skill Score vs. a naive typical-day baseline** (same "free beats the baseline" story). Score per
    condition (game day / leaf Sat / ordinary Tue), not one blended number. Actuals = a traffic API now → camera-CV
    later (Ecowitt arc). We grade Google's predicted ETAs alongside ours.
  - **⭐ PHASING INSIGHT (reorders the build): the WINTER ROAD-CONDITION FORECAST is the sharpest, cheapest v1.**
    "Will roads be bad tomorrow AM?" reuses snow/ice/temp data the pipeline ALREADY forecasts — **no cameras, no
    traffic API needed for v1** — fills a gap every local channel leaves open (all report the present; nobody
    forecasts road surface), and is gradable against DriveNC's snow/ice layer. Ship this BEFORE full traffic-volume
    forecasting. Proposed phases: **v1 road-condition forecast (existing data) → v2 traffic forecast (traffic API
    actuals) → v3 camera-CV ground truth (Pi5+Hailo).**
  - **Demand + corridors (documented):** App State game days (Thu-night games worst), move-in, leaf season
    (mid–late Oct), winter closures — along **US-321 (Boone↔Blowing Rock), NC-105 bypass, US-421/Boone Mtn,
    King St**. NC-105/US-321 (the Wendy's-cam intersection) = natural first congestion-sensor site.
  - **Data sources — RESEARCHED 2026-07-08 (govt stack is FREE + covers our roads):** DriveNC v2 API (free
    key: `event`, `snowandice`, `cameras`, `messagesign`; 10/60s), WZDx work zones (no key), **AADT counts
    fully open — verified 186 Watauga segments up to 44k/day**, NPS Blue Ridge Parkway alerts (free key),
    NWS (api.weather.gov). Live congestion = paid/limited: **TomTom 2,500/day free (commercial OK)** best free
    pick, Google best rural coverage but paid past 5k/mo; Waze unavailable (public-sector only); NO DOT cams
    in Boone (Ray's are the de-facto road cams → reinforces v3 own-cameras); no public RWIS/plow feeds.
    Demand signal = **App State football ICS (free, auto-updating)** + fixed festival/leaf/ski calendar.
    Two free keys to get first: DriveNC + NPS. v1 & v2 are ~$0/mo within free tiers; v3 cams ~$560–840 one-time.
  - **▶ FULL DESIGN written: `planning/specs/2026-07-08-traffic-road-forecast-design.md`** — product, phasing
    (v1 road-condition → v2 traffic → v3 camera-CV → v4 parking), data have-vs-build table, grading model,
    camera placement/count/cost, CV approach, full phased cost, privacy/honesty, repo integration.
  - ✅ **OWNER DECISIONS (2026-07-08):** v1-first · own `/roads` product · build the v3 cameras. (Open, non-
    blocking: live-traffic vendor = default TomTom free; geographic-expansion trigger.)
  - ▶ **v1 IMPLEMENTATION PLAN written: `planning/plans/2026-07-08-roads-forecast-v1.md`** — 8 TDD tasks
    (rubric → scorer → forecast writer → DriveNC/NPS capture → compare → TS loaders → `/roads` page →
    pipeline+methodology). Execution-ready (subagent-driven or inline). ⚠️ executor must request free DriveNC +
    NPS keys and verify DriveNC field names against the live keyed API.
  - **v4 parking indicators** folded into the design (§2a). Parking-data RESEARCHED 2026-07-08: **no live
    occupancy feed exists for Boone/App State** → cameras are the buildable path (same Pi5+Hailo; Edge Impulse
    FOMO precedent; NC State's public deck-occupancy JSON feed = the target shape). Best REAL dataset =
    parking citations (demand proxy) via records request. **OWNER ACTIONS (require calls/requests under your
    name):** (1) file NC public-records request for citations/tows — Town Clerk form townofboone.net/327 + PD
    Records 828-268-6906; (2) ask Town/IPS if Boone has occupancy sensors or will share the meter API;
    (3) ask App State P&T (828-262-2878) re deck gate-counts; (4) confirm the new county deck's future gating.
  - [ ] **[NEXT]** Execute the v1 roads plan (owner to greenlight when ready) + request DriveNC & NPS keys.

### Disavow list (running 2026-07-07, background agent)
Building `planning/seo/davessweater-disavow.txt` (+ notes) — the ~239 spam-net RDs pointing at
davessweater.com, Google-disavow format, DRAFT for owner GSC review. ⚠️ conservative: never disavow a real link.

## Done: Next.js migration (M1)
Migrated presentation to Next.js 16 (App Router); Python data pipeline + scoring unchanged.
Spec/plan: `planning/specs/2026-06-21-m1-nextjs-port-design.md`, `planning/plans/2026-06-21-m1-nextjs-port.md`.
- [x] **M1 — Next.js port** — parity + real subfolder routes, native blog (sanitized), embedded
      Fourthwall shop modal, sitemap/robots, GA + both GSC tags, Ray's-style white logo.
- [x] **Cutover** — Vercel builds with `next build` (`vercel.json` framework=nextjs, outputDirectory=.next);
      daily Actions commit `data/` only; `build_site.py`, `docs/`, `rebuild_on_screenshot.yml` retired.

## Done: M2 — modern redesign + accuracy homepage
Original, dynamic design (own brand; shares only the teal/orange palette + the genre — **NOT a Ray's
clone**, for legal safety). Homepage leads with the joke *backed by data* — free Open-Meteo/Apple beat
paid Ray's — from `scores.json`. Mobile-first; daily iPhone screenshot co-anchors the hero (labeled
honestly real-Apple-vs-Open-Meteo-fallback); design system applied across all pages. Spec/plan:
`planning/specs/2026-06-21-m2-redesign-accuracy-homepage-design.md`,
`planning/plans/2026-06-21-m2-redesign-accuracy-homepage.md`.
- [x] **M2 — design system + accuracy homepage** — Style-A data-journalism on the dark-teal/orange
      palette; dark hero + dark feature-bands on a light body; mobile-first (header menu, tables→cards);
      brand mark "Boone's #1 weather ~~service~~ tracker"; Space Grotesk display + Inter. Lib fully
      unit-tested; `npm test`/lint/`build` green; verified mobile + desktop. **Final review corrected the
      false "dead last 29×" claim** — `totals.wrong` is the count of days *graded "Wrong" (< 60)*, not a
      per-day ranking; copy now reads "the free services were never once graded Wrong; Ray's earned that
      grade N times" and the W/L/M legend uses grade bands. **Merged to `main` + Vercel confirmed; live.**

## Done: Source Expansion (sibling pipeline milestone)
Grew the roster from 3 forecasters toward a broad set of free, automatable services behind a
source-registry/adapter pattern, and reworked scoring into the coupled, snow-aware, transparent model
(`scripts/scoring.py`, pytest-tested). Pipeline/scoring only — backward-compatible (`score`/`grade`/
`totals` + `precip_in` preserved). Spec/plan: `planning/specs/2026-06-22-source-expansion-design.md`,
`planning/plans/2026-06-22-source-expansion.md`.
- [x] **Source Expansion** — N-source adapters + coupled snow-aware scoring + per-source coverage index.
      **M3 visualizes this data.** ⚠️ Confirm the expanded roster + split rain/snow coverage actually
      reached `data/` on whatever branch M3 builds on before wiring N-source viz (the `feat/openmeteo-backfill`
      branch still carried only the 3 original sources + a single `precip_amount` field).

## Done: Open-Meteo backfill (PR #62 — merged)
- [x] **Open-Meteo historical backfill** — `scripts/backfill_openmeteo.py`; Open-Meteo has a **474-day record**;
      homepage derives a tracking-period head-to-head + a 474-day explainer; `trendSeries` scoped to the
      rays-present window. Merged to `main` + live.

## Done: Fair Ray scoring — capture fix + interval wind scoring (PR #67 — merged)
Fixed 3 capture/scoring bugs unfairly mis-scoring Ray + a latent append-only `entries[]` drift. Wind is now
scored as an **interval** with a 0.5× width vagueness tax (point forecasts unchanged → Open-Meteo provably
untouched); qualitative wind mapped via the NWS scale; precip amount honestly forfeited. Whole Ray era
backfilled from saved `raw_text` (originals preserved) + re-scored; guarded by `tests/test_scores_consistency.py`.
Plan: `planning/plans/2026-06-24-rays-capture-interval-scoring.md`.
- [x] **Ray fair scoring** — Ray ≈ 65.2 (≈flat — capture-deflation + vagueness-reward cancelled; now every
      point earned), Open-Meteo 91.65 unchanged, free wins by ~26.5, Ray's "Right" days 35→25. **Merged + live.**
- [x] **Methodology transparency (before promotion)** — shipped as **R4 + R8** (PR #72, 2026-06-27) + R5's
      actuals-provenance disclosure; `/methodology` live.
- [x] **Capture-quality monitoring** — shipped as **R3** (`check_capture_health.py` + drift detection +
      auto-backfill sweep, live 2026-07-01).

## Done: M3 iteration #2 — "Why we exist" scrollytelling section
Restrained, scroll-driven narrative section on the homepage (below the hero, replacing the standalone
"It's not a fluke" trend block; the existing `TrendChartInteractive` now lives at its climax node). Built
on a framer-motion timeline (scroll-driven beam via `useScroll`), five data-bound beats, spring
`NumberTicker`s, a `PointerHighlight` accent, and a `ChartReveal` clip-path draw-in. All stats derived via
`whyStats()` (vitest-tested); `prefers-reduced-motion`/mobile/no-CLS handled. Spec/plan:
`planning/specs/2026-06-25-m3-scrollytelling-design.md`, `planning/plans/2026-06-25-m3-scrollytelling.md`.
- [x] **M3 #2 — scrollytelling "Why we exist"** — framer-motion added; `NumberTicker`/`PointerHighlight`/
      `ChartReveal`/`WhyTimeline` built; `whyStats` helper; `npm test`/lint/`build` green. Aurora deferred
      → shipped 2026-07-01 as the weather backdrop's `wx-crisp` variant (next bullet).
- [x] **Right/Wrong Ray v2 + brand standards — ✅ DONE 2026-07-02 (owner-directed, pre-traffic).** Season
      Scoreboard moved above the daily cards and includes ALL tracked sources (sparklines for each); daily
      cards cover all 10 sources as a leaderboard (best first, emerald "day's best", slate "day's worst");
      verdict 1-5 scale renders in each service's own brand icon (ray faces only for Ray's); price chip
      centered between name and icons; grade-colored score bars + hover lift; dry section blurbs; "rest of
      the field" section retired (superseded). **Gate lowered 14 → 9 scored days** (`lib/gating.ts`).
      **Brand standards:** dates spell out as "Month D, YYYY" via `lib/dates.ts` (short "Jun 30" only in
      chart tooltips); data-line separators are pipes ("|"), swept site-wide. Ray's price chip says "Paid" —
      owner to supply the real figure.
- [x] **Homepage visual pass — ✅ DONE 2026-07-02 (PR #93; #92 was auto-closed by a GitHub stacked-branch
      quirk).** Owner-directed five items: orange restricted to brand/editorial (data = green vs slate-gray;
      winner card emphasized); DSI + Sweater Index merged into one Today module card; trend chart gained gap
      fill / legend / labeled grade lines / 12px axes / 7-day-average default with Daily toggle; rubric strip
      folded into the chart section footer; H1 phrase kept on one line. 87°-vs-85° source report delivered
      (build-time 8-forecaster mean vs live Open-Meteo fetch); reconciliation decision banked below.
- [x] **Hero weather backdrop — ✅ MERGED + LIVE 2026-07-02 (PR #91). Reworked LOUD at the owner's direction**
      (whisper register rejected): wandering/swelling sun bloom + rotating ray sweep, dense snowfall, driving
      rain sheets, fully lit aurora; a static quiet-zone mask on the wrapper keeps the text column ≤ ~40%
      intensity so AA holds while the visual field runs bright; axe 0 violations ×6 variants. Pure-CSS
      ambient layer behind the hero (`WeatherBackdrop` + the `.wx` system in `globals.css`); the variant is
      chosen at build time from the day's 8-forecaster composite (`lib/heroBackdrop.ts`; dry-day thresholds
      reuse the published 75/55°F sweater boundaries). Variants: rain = passing light-sheets, snow = two
      parallax fleck planes, mixed = both, hot = warm corner bloom, crisp = the deferred emerald aurora,
      mild = near-silent. All share a "consensus floor": an emerald glow under the Index strip scaled by
      today's forecaster count (`--n`); no composite → dim base only (never a fabricated glow). Invariants:
      no client JS; transform/opacity animations only; `contain: layout paint`; reduced-motion = designed
      still frame; light-add budget keeps hero text AA (worst stack ≈0.156 → ≥6.3:1). Verified: axe 0
      violations on all six variants (desktop + mobile), lint/tests/build green, adversarial review run —
      fixed its findings (reduced-motion specificity, snow fleck alpha cap, contributing-only precip vote
      with principled ties in `composite.ts`).
- [ ] **M3 #3 — N-source viz** — surface the 7 new forecasters; still gated on them accruing enough scored days.
  - [x] First surfacing: hero logo strip of the 8 index forecasters (`ForecasterLogos` + `FORECASTERS` map),
        homepage links `nofollow`, wraps on mobile (PR #78). Full N-source scoreboard/columns still pending.
  - [x] **PR2 — "the rest of the field" scoreboard** (R6 + M3 #3) — ✅ DONE (PR pending). New
        `/right-wrong-ray` section (`OtherSourcesBoard` + `otherSourcesRows`) surfaces all 7 free forecasters,
        ranked once past a shared `MIN_SCORED_DAYS` (=14) gate (`src/lib/gating.ts`), provisional with a day
        count until then (all 7 at 8 days today). `types.ts` source union widened to string-keyed. R11
        capture-day-low disclosure added to `/methodology` ("Reading the overnight low", mechanical copy).
        Full N-source trend sparklines still a future nicety.

## Done: P-DS-FW1 — /fireworks (Fireworks & Dusk asset) — ✅ MERGED + LIVE 2026-07-02
The "fireworks begin at dusk" page: per-venue dusk math (sunset / civil-dusk "dark enough" / nautical
"fully dark" / moonrise+phase), computed annually forever from each launch site's coordinates
(`src/lib/solar.ts` — interface is (lat, lon, elevationM, date, tz) → full solar packet, deliberately the
future `/sunset` spine; almanac convention, elevation-dip OFF with the mountain-horizon caveat disclosed
on-page). Boone Jul 4 2026: sunset 8:47 PM, dark enough 9:17 PM, fully dark 9:54 PM, 78% waning gibbous
rises 11:42 PM (after the finales). **MANDATORY tz build gate** (`solar.test.ts`, hardcoded UTC bounds)
runs in `prebuild` → a timezone slip fails the Vercel build. Fireworks Forecast (July 1–4): new seasonal
self-gating `scripts/capture_fireworks_forecast.py` (stdlib) in `daily_capture.yml` pulls Open-Meteo hourly
low/mid/high cloud, precip prob+amount, temp/dew-point spread, wind dir (smoke-drift note), visibility per
venue → `data/fireworks_forecast.json`; verdicts (Clear / Iffy / Likely obstructed / unavailable) come from
a rubric whose exact thresholds render on-page from the same `RUBRIC` const the code runs; fail-closed
>36h + visible fetch stamp. Venue matrix verified against PRIMARY sources 2026-07-02 (agent pass):
**confirmed** Boone (town says "around dusk"; the TDA listing's 9:00 stays out of schema), Tweetsie
(9:30 PM verbatim, Jul 4 only, exit-by-9/no-re-entry, light-rain-or-shine), Beech Mtn resort ("at dusk"),
West Jefferson/Ashe ("around dark", watch-from-vehicle). **Original corrections:** Blowing Rock = parade
only (the town's own page still runs stale Country-Club-fireworks text); Banner Elk 2026 = daytime only,
ends 3 PM ("Mile High Fourth"/9:30 = recycled 2024); Elk Park 9:30 = aggregator-only + textual copy-drift
→ unconfirmed row. Newland (Jul 3!) / Sparta / N. Wilkesboro / Sugar Mtn = "reported, could not verify"
tier. 7 FAQs (both-shows-no, Blowing Rock, Banner Elk, cancellations w/ confirmed Stage 2 water
restrictions eff. 2026-07-01 — NO burn ban as of 07-02, framed as context) + FAQPage + Event (clock time
in schema ONLY where the venue states one — Tweetsie) + WebPage JSON-LD built from the same data that
renders. Three date states built + build-tested (preview / tonight Jul 3–4 / archive Jul 5+;
`FIREWORKS_TODAY` env override); per-show anchors; nav + sitemap entries. 96 vitest (34 new) + lint +
3 prod builds green. Analytics check (addendum H): GA4 `G-7XL0TZ4GSS` live in layout.
- [x] **Answers-first restructure (2026-07-02 evening):** quick-answer cards (per-show time + verdict chip)
      + Blowing Rock/Banner Elk one-liner + jump-nav pills now open the page; section anchors #times
      #forecast #shows #faq #method (`SectionBand` gained an `id` prop). Owner flagged the overall visual
      design as "kind of ugly" — resolved by the 2026-07-02 brand + hero pass (PR #106, below).
- [x] **Both-shows FAQ corrected (owner ground truth):** attend-one stays, but "see several at once from a
      high open Boone vantage" is now affirmed — validated by a terrain line-of-sight POC (session
      scratchpad `los_poc2.mjs`): owner's vantage clears Boone/Tweetsie/App State bursts; Beech marginal
      on finale shells. Model = Census geocoder ($0) + AWS terrarium terrain tiles ($0) + own LOS math.
- [x] **Social carousel v1 (2026-07-02):** 7 PNG slides (1080×1350) generated from computed values
      (scratchpad `carousel.mjs`), delivered to owner. Regenerate after any venue-fact change.
- [x] **Sightline checker v1 — ✅ SHIPPED 2026-07-02 (the computational meat).** "Can you see it from your
      place?" on /fireworks (#checker): geolocation or address → per-show Clear / Marginal / Finale-only /
      Blocked with margins, blocker distance, and required burst height. Fully client-side ($0): AWS
      terrain tiles are CORS-open (browser-fetched, canvas-decoded); Census geocoder is not → tiny
      `/api/geocode` passthrough (first serverless route in the repo; stores nothing — privacy note
      on-page). Math in `src/lib/sightline.ts` (pure, injected elevation, 12 vitest tests incl. synthetic
      walls + earth-bulge); published bands: clear ≥ +15 m on 90 m shells, ±15 m = marginal, 150 m finale
      tier. Verified live: police-station address → Boone marginal 0.7 mi / Tweetsie blocked (needs 206 m).
- [x] **Checker v1.1 — ✅ SHIPPED 2026-07-02 (owner-directed same day):** now a DECISION tool, not just
      visibility — each result pairs the sight chip with that show's **sky-forecast chip** (verdicts passed
      as props from the server page), and a "The call from here:" line ranks sight × sky × distance; if
      nothing clears, it routes the user to a verified public spot with a computed clear line. **All
      user-facing units imperial** (ft/mi; math stays metric — helpers in `sightline.ts`). Privacy line
      rephrased (no store/log/track; address converted once by the Census geocoder then forgotten; shared
      location never leaves the browser). **Elk Park demoted from ratings** (owner call): removed from
      VENUES/matrix/forecast/checker + both generator scripts (data regenerated, 4 venues), now an
      "Also asked" line + no-show-style card + FAQ ("listed everywhere, verified nowhere" + call-first
      phone) — the FAQ auto-joins the existing FAQPage schema. `scripts/compute_terrain.mjs` (offline, DEM
      static, rerun only when spots change) → `data/terrain.json`; page renders spot × show verdicts:
      Rec Center lot Boone +90 m; **Howard's Knob clears BOTH Boone (+17) and Tweetsie (+11)** (gate-hours
      caveat printed); State Farm overflow lot does NOT see typical Boone shells (−29 m — park, then walk
      down); Jones House = Tweetsie finale-only; downtown Blowing Rock blocked from Tweetsie (−26 m).
      Western shows unreachable from any Boone-area public spot — stated on-page.
- [x] **Terrain last-direct-sun — ✅ SHIPPED 2026-07-02** as the "Last sun*" column in the dusk table
      (`solar.ts lastDirectSun()` + committed horizons): Boone field goes to shade 8:22 PM (25 min before
      sunset); **Tweetsie's valley at 7:29 PM (78 min before!)**. Physics distinction printed: terrain
      moves last direct sun, NOT civil-dusk "dark enough" (sky-scatter). Convention-guard test pins this
      suncalc build's getPosition = DEGREES/azimuth-from-north (a dependency update that flips it back to
      radians fails the suite loudly). This column + horizons are the working /sunset spine.
- [x] **Observed-record slot SHIPPED (2026-07-02):** research concluded — no public first-shell minute
      exists anywhere (official FB pages post parking, never times; YouTube night-of uploads give only
      BOUNDS). What we proved and now publish on venue cards, sourced: Boone 2024 shells in the air by
      ~9:50 PM (clip uploaded 9:56 PM night-of); Boone 2025 bounded to civil-dusk→~10:40 PM; Tweetsie 2025
      full-show video runs 15.5 min (≈9:30–9:46); Sugar Mtn's own site says "around 9:15 pm". **THE SLOT:**
      when the owner's own Facebook dig finds a 2025 first-shell time, set `firstShell: "21:XX"` on the
      2025 entry in `src/lib/fireworksVenues.ts` (marked "← THE SLOT") — venue card + FAQ update on next
      build. Owner searches FB independently; broad-net agent research is DONE, don't repeat it.
- [ ] **Observe 2026-07-04 live:** clock first-shell for Boone + Tweetsie (+ App State if firing) from the
      owner's vantage; add as `observed` entries (year 2026) and publish "observed vs computed" July 5 —
      original data nobody else has; repeat annually.
- [x] **IA/copy restructure — ✅ SHIPPED 2026-07-02 (owner-approved plan).** New order: hero → checker →
      merged outlook grid → dusk table → show details → tested spots → FAQ → methodology. H1/title now
      "{year} Fourth of July fireworks in Boone & the High Country"; dek names Watauga County + Boone +
      High Country. Redundancy killed: quick-answer cards + forecast section merged into ONE outlook grid
      (one chip per show, time + single flag line + details link); the cloned per-card wind sentence became
      one "Smoke check" line; rubric box moved into methodology (single methods home); "Official says"
      column dropped from the dusk table (wording lives in cards/FAQ). Jump pills → 3 CTA buttons
      (Check my view / outlook / Show details) + small text links. Reason strings rewritten
      (condition → number → consequence; no rubric jargon on cards). Section heading is date-aware
      ("Tonight's outlook" on Jul 3–4; archive variant after). 110 tests + lint + build green; verified in
      preview. **Visual/design pass shipped 2026-07-02 (PR #106, below).**
- [x] **Labels/AP-case + spots-up pass — ✅ SHIPPED 2026-07-02 (owner-directed).** Verdict taxonomy is now
      user-facing: sight = Clear View / Limited View / Blocked View (marginal + finale-only share the
      Limited label; margins + detail text differentiate), sky = Clear Skies / Iffy Skies / Bad Skies /
      No Forecast — consistent across checker, outlook cards, and spots table. Checker rows lead with
      "{Show} Fireworks", distances read "X mi from you", em-dashes trimmed from data strings. Headings
      retitled in AP title case: "When Will the Fireworks Start Around Boone?" (Our Read column highlighted
      orange + defined as "when we expect the first shell"), "High Country Fourth of July Firework Show
      Details" (+ 6 town quickjump pills), "Where to Watch Boone Fireworks" (moved up, directly under the
      checker). Hero CTAs: Check My View / Fireworks Forecast / Event Details. THREE NEW SPOTS geocoded
      (Census) + terrain-computed: Watauga High lots (Clear View +98 ft on Boone — best public find yet),
      Boone Mall lot (Limited +10 ft), Daniel Boone Park/Horn in the West (Limited both shows); Brookshire
      Park dropped (geocoder mismatched the street). 110 tests + lint + build green; owner live-tested the
      checker from his own address mid-session (Boone Clear View +87 ft — ground truth holds).
- [x] **State Farm lot verdict corrected + coordinate-sensitivity guard — ✅ 2026-07-02 (owner caught it).**
      Owner ground truth ("literally the best spot") contradicted the model's "Blocked −95 ft"; profile
      dump showed the shipped pin was invented ~800 m NW of the real lot, behind a genuine 130-ft knoll —
      right math, wrong input. Real lot (off Dale St, verified against terrain profile, robust ±100 m):
      **Clear View +141 ft**. Audit of other eyeballed pins: Jones House was ~750 m off (Census-geocoded →
      now Limited −30 ft, was Blocked), Memorial Park corrected ~80 m, Howard's Knob unresolvable by
      geocoder (kept, guarded). `compute_terrain.mjs` now runs a **±100 m sensitivity check** per
      spot × show; verdicts that flip get a `sensitive` flag and render "treat it as a maybe" on the page
      (currently flags: state-farm/Tweetsie, Howard's Knob/Tweetsie, Horn-in-the-West/both). Standing rule
      encoded in the script comment: every viewpoint pin needs geocode- or profile-verified provenance.
- [x] **Clutter allowance for known spots — ✅ 2026-07-02 (owner challenged 3 more verdicts; all upheld his
      way).** Profile dumps confirmed the GEOMETRY is right (full-path sampling names the exact blocking
      ridge per case: Jones→Boone 3,387 ft ridge @1.3 mi; Jones→Tweetsie 3,611 ft @2.1 mi; Memorial→Tweetsie
      3,726 ft @2 mi, blocked even for finales at −19 ft — answers the owner's "maybe?" with no); the
      failures were thin bare-earth margins in cluttered places (Jones finale +40 ft over King St's DIRT;
      Horn finale +4 ft in a wooded bowl). Fix: viewpoints carry `environment: open|built|wooded`; built/
      wooded spots pay a published ~50 ft clutter allowance (`CLUTTER_PENALTY_M`, `spotVerdict()` in
      sightline.ts, 3 new tests) before any non-blocked verdict. Table now: Jones House Blocked/Blocked,
      Horn Blocked/Blocked, Memorial Blocked/Blocked, Howard's Knob honestly degrades to Limited both
      (wooded). Open lots unchanged. Allowance disclosed in the spots intro + methodology. Checker
      (arbitrary addresses) can't know environment — bare-earth caveat stands there; possible future:
      let the user tag their own surroundings.
- [x] **Owner's 8-item polish batch — ✅ SHIPPED 2026-07-02 (crawler-safe throughout).** Show cards are now
      native `<details>/<summary>` expandables — collapsed content stays in the prerendered HTML (verified
      by grepping `.next/server/app/fireworks.html`: observed-record text, FAQ answers, schema all present;
      JSON-LD = WebPage + 4 Events + FAQPage + site WebSite/Organization); `OpenTargetDetails` (tiny client
      enhancement) auto-expands the card a quickjump/shared #anchor targets. "Also asked" line retired
      (all three towns already have FAQs → FAQPage schema). Checker intro re-copyedited per owner; the
      "call from here" recommendation now renders FIRST in results. Hero text links = "Start times | Where
      to watch | Our methodology | Fireworks FAQs". Smoke Check got pipes + a line break. Section order:
      hero → checker → forecast ("Boone Fireworks Forecast: Fourth of July | {year}") → dusk table →
      spots ("Where to Watch Fireworks in Boone") → show details → FAQ → methodology. 113 tests + lint +
      build green; verified live incl. quickjump-opens-card behavior.
- [x] **Ship-final polish (owner, 2026-07-02):** Our Read column moved to first-after-Show; em-dashes
      minimized across all user-facing strings (kept only as empty-cell placeholders); all external links
      rel="nofollow". SHIPPED TO PRODUCTION same day (after #104/#105), owner refining in main project.
- [x] **Brand + hero pass — ✅ MERGED + LIVE 2026-07-02 (PR #106).** The page opens on the branded dark band
      now (orange-300 kicker, hero-scale display h1, brand CTA shapes, sentence-case labels; tonight/archive
      callouts restyled onto the band). A red, white, and blue six-shell volley animates behind the hero:
      `.fw` in `globals.css`, built in the homepage `.wx` dialect — compositor-only transforms, static
      quiet-zone mask over the text column, base rules double as the reduced-motion still frame, fixed-size
      three-shell volley on phones. Fireworks left the top-level nav; the report is the first `REPORTS`
      entry in `src/content/resources.ts` (the Reports hub + hub card list it automatically); BreadcrumbList
      (Home → Resources → Reports → page) joined the Event/FAQ schema; data-line middots → pipes; section
      h2s to the sitewide text-2xl scale.
- [x] **Reports-page checker teaser — ✅ MERGED + LIVE 2026-07-02 (PR #106).** `/resources/reports` embeds
      the checker's input module (`SightlineTeaser`): Check routes to `/fireworks?check=<query>#checker`,
      where the on-page checker auto-runs the same geocode-or-geolocate path on mount (reads
      `window.location` in an effect, not `useSearchParams`, so the static prerender survives). Verified
      end-to-end: address submitted on the Reports page landed at the checker with the full verdict rendered.
- [x] **Route-scoped OG/Twitter share card — ✅ 2026-07-02.** `/fireworks` shares no longer inherit the
      site scoreboard card: `src/app/fireworks/opengraph-image.tsx` (+ twitter-image re-export) renders a
      build-time next/og card — red/white/blue blooms quoting the hero volley, headline «"At dusk" is not
      a time. These are.», three chips (Sunset / Dark enough / First shells-our-read in orange), and the
      URL + date footer. Dusk numbers bake from the same `lib/solar` the page uses (readWindow duplicated
      with a keep-in-sync comment), so the card cannot disagree with the page.
- [x] **Share-week promo round — ✅ 2026-07-02.** Homepage gets a seasonal fireworks banner under the hero
      (`FireworksBanner`: teal-900 dot-grid strip, static volley blooms — owned art, deliberately no stock
      photo pending the owner's own July 4 shots; renders only through the season via `pageMode()` and
      retires itself in archive mode). Reports teaser optimized for phones (the location button appears from
      `sm` up; mobile is a clean input + Check row). Report summary + teaser pitch rewritten outcome-first
      (what you get: per-show weather, projected start times, event details, sightlines from any address).
      **Photo landed same day:** owner supplied a CC0 1.0 fireworks shot (Feuerwerk_1) →
      `public/assets/fireworks-photo{,-sm}.webp` (sharp, 1200w/640w); used as the report thumbnail on
      /resources/reports and the banner's masked backdrop. Generic fireworks — alt text makes no local
      claim; swap in the owner's own July 4 shots when they exist.
- [ ] **Owner, NOW THAT IT'S MERGED:** request indexing for `/reports/fireworks-fourth-july-2026` in GSC immediately (moved from /fireworks, which now 301s) — the only
      realistic organic lever this week; the organic play is the evergreen URL accruing for 2027.
- [ ] **Owner, ads (Phase 5):** UTM every Meta variant, e.g.
      `?utm_source=meta&utm_medium=paid-social&utm_campaign=fireworks-2026&utm_content=<variant>` — GA4 is
      already on the site so cost-per-visitor is measurable.
- [ ] **Jul 3–4:** glance at the daily-capture run — first unattended fireworks-forecast fetch commits that
      morning (the initial JSON ships with this branch, so day one isn't fail-closed).
- [ ] **Jul 5+:** confirm the archive flip on prod (forecast hidden, "in the books" banner, dusk math stays).
- [ ] **If a primary source surfaces:** upgrade Elk Park (828-387-3003) / Sparta / N. Wilkesboro / Sugar
      Mtn (seesugar.com) rows to confirmed in `src/lib/fireworksVenues.ts`.
- [ ] **June 2027 (annual, ~1 hr):** re-verify venue facts + flip `SEASON.year` in `src/lib/fireworks.ts`;
      dusk math, page metadata, and the capture season-gate re-arm themselves.
- [ ] **Phase 2 (deferred by design):** terrain-adjusted `/sunset` page (DEM horizon profiles on top of
      `solar.ts`), golden-hour tables, overlook viewing claims, NYE/Tweetsie-nights reuse of the module.

## Done: GMHG 2026 planner — /reports/grandfather-mountain-highland-games-2026 (2026-07-06, PR pending)
Franchise instance **#2** after /fireworks: a genuinely-useful, self-contained planner for the 70th Grandfather
Mountain Highland Games (Jul 9–12, MacRae Meadows). Owner worked up the authoritative dataset + spec in Claude
Browser (`gmhg-2026-events.json` = 171 events, 15 zones, walk-time matrix + congestion factors, full logistics).
Built STRAIGHT where people rely on it (schedule/arrive-by/lot/cash/walk warnings), fireworks-voice humor in the
intro + packing list. Plan: `~/.claude/plans/…-gm-playful-flask.md`.
- [x] **Data + types + loader** — `data/gmhg_events.json` (verbatim), `Gmhg*` types in `src/lib/types.ts`,
      `getGmhgData()` in `src/lib/data.ts`.
- [x] **Pure engines (`src/lib/gmhg/`, vitest-tested, 31 tests)** — `walk.ts` (one `transitionVerdict` driving
      BOTH timeline badges and path-map leg colors; matrix base + 1.5× peak tax; reproduces the dataset's
      caber→Gaelic ≈21-min worked example → won't-fit); `plan.ts` (lot-per-day rules, nearest-to-origin pick,
      concert-only drive-up mode, accessibility override, arrive-by, $10×party×shuttle-days cash); `ics.ts`
      (RFC 5545 w/ explicit America/New_York VTIMEZONE + night-before CASH VALARM + morning leave-by VALARM +
      Google-Calendar URL); `packing.ts` (forecast→items, fail-closed to static). Constants/tunables +
      MacRae coords centralized in `constants.ts`; `schedule.ts` day/time helpers.
- [x] **Client island (`src/components/gmhg/Planner.tsx` + `PathMap.tsx`)** — day tabs, proportional
      time-axis timeline, cluster-colored cards, live overlap/walk badges, running "your day" panel
      (arrive-by/lot/cash/packing), highlights on-ramp, numbered SVG path map (bows around the oval, honesty
      label), ICS download + print. Live Open-Meteo fetch at **MacRae's own coords** (verified live: 42% rain /
      UV 8 for the field), NOT Boone's pipeline coords.
- [x] **Route + SEO + registration** — server page with metadata + Event/FAQPage/BreadcrumbList JSON-LD +
      server-rendered logistics answer-blocks (parking-by-day table from data, cash, 5 PM concert cutover,
      accessibility, pets) + 8 FAQs; `REPORTS[]` entry (Resources → Reports hub) + `sitemap.ts`.
- [x] **Print one-pager** (`@media print`) — full itinerary/day, lot, leave-by, cash, packing, key info; hides
      interactive chrome. Verified: 148 vitest pass, lint clean, `next build` green, browser-verified end-to-end
      (conflict detection, arrive-by, cash, live forecast, path map, valid ICS, mobile no-overflow).
- [x] **Owner-feedback refinement pass (2026-07-06)** — (1) **co-visibility**: the dance platforms +
      review stand are field-adjacent (bleachers), so they + center-field are one "field/bleachers area" —
      short hops between them, and simultaneous picks there read "watch both" (teal) not a red conflict
      (`inFieldArea`/`coVisible` in `walk.ts`, `FIELD_AREA_WALK`); (2) **walk recalibration**: dance↔field
      was mis-read as 12–18 min → now a ~5-min field hop; cultural-village↔field dialed 14→11 (owner
      flagged both as too high — still framed as generous estimates, tunable in one file); (3) dropped the
      2 redundant "Celtic Groves entertainment begins" umbrella rows (duplicated the specific act cards);
      (4) **path map rebuilt** — stops sharing a zone now fan into a ring so no number hides another (the
      "can't see #2" bug), gentler bows; (5) **print fixed** — hero/logistics/FAQ/methodology now
      `print:hidden` so only the plan sheet prints, the sheet gained the per-day map, and a serif print
      font (`.gmhg-print`) so lowercase "l" stops reading as a bar; (6) **"Save my plan as an image"** —
      canvas-rendered PNG shown inline with press-and-hold-to-save (`planImage.ts`), far friendlier than
      PDF/print for the older crowd. 152 vitest (+4) / lint / build green; browser-verified all six.
- [x] **Owner-feedback pass #2 (2026-07-06)** — (1) **consolidated multi-day plan**: the browser "Your
      plan" now stacks every selected day Thu→Sun (was active-day only); the save-image + print produce
      that same single consolidated file; mobile-first single column, verified no-overflow at 375px.
      (2) **4-day forecast section** on the page (hi/lo, rain%, UV per day) with a "checked {time}" stamp
      and a "forecasts change, check again the morning you go" note; the **downloaded image + print carry
      the timestamp** and a Weather row. (3) **Filter by type**: one dropdown (All events / Highlights /
      each category). (4) **Map rebuilt again** per owner: dropped the abstract route curves, now numbered
      pins labeled with the start time, faint dotted sequence only, honest "approximate positions" label;
      the numbered event list beside it is the legend. (5) **No emojis anywhere** (removed the phone glyph
      and the highlight star; highlights now a left orange rule). (6) **Em-dashes limited** across page copy,
      packing, ICS alarms, and image/print. 152 vitest / lint / build green; browser-verified all six.
- [x] **Owner-feedback pass #3 (2026-07-06)** — (1) **map rebuilt as a real field diagram** (`PathMap.tsx`):
      modeled on the GMHG field map (oval track + East Meadow inside, Review Stand/Bleachers/Highland Dancing
      along the top, Groves/Alex Beaton/Bagpiping east, merchant + culture tents west/south, West Meadow
      parking, First Aid/EMS, compass); each zone has hand-placed coordinates matching the real layout, and
      selected events drop as numbered, time-labeled pins on the actual area (replaces the "circle + dots").
      (2) **hourly rain chart** (`HourlyRain.tsx`) for the active day, from a new Open-Meteo hourly fetch.
      (3) **separators are pipes now**, capitalized after, everywhere incl. the saved image + print.
      (4) **"Last shuttle back leaves 5:00 PM (10:30 PM Thu). Do not get stranded."** on every daily plan
      (parsed from the schedule; verified against the owner's shuttle PDF). (5) **"Leave by" clarified**:
      reads "Leave Boone by …" (the chosen origin) with a one-line explanation of what it includes.
      (6) **co-visibility note above the schedule** (watch a dance + field event from the hillside/bleachers).
      (7) **"Good to know" section** (EMS tent, card readers common but shuttle cash-only, little rain shelter,
      coolers welcome, expect mud, grassy hillside for chairs) on the page + saved image. (8) **per-day
      forecast** in each daily plan + image + print. (9) **packing rewritten as flowing prose**, not choppy
      fragments. 153 vitest / lint / build green; browser-verified desktop + mobile.
- [x] **Owner-feedback pass #4 — the real field map (2026-07-06).** Replaced the hand-drawn SVG entirely:
      the official GMHG field map is now a raster asset (`public/assets/gmhg-field-map.webp`, from the owner's
      `IMG_1612.PNG` via sharp), and selected events drop on it as numbered, time-labeled **pins** positioned
      by per-zone image fractions (`FieldMap.tsx`, `MAP_XY` tuned to the asset; co-located pins fan out).
      Retired `PathMap.tsx`. Added a **Field Map section** on the page above Parking/Shuttle (reference map,
      no pins, with gmhg.org attribution) + a **"Field map" jump link** in the hero. The per-day pinned map
      renders in the on-screen plan, the **print sheet**, and the **saved image** (canvas now async: it
      rasterizes the same-origin map with drawImage and draws the numbered pins on top). 36 gmhg vitest /
      lint / build green; verified desktop + mobile + saved image + print structure.
      ⚠️ **Pin coordinates are estimates** tuned to `IMG_1612.PNG` (a cropped screenshot). If the owner drops
      a clean full-res map, swap `gmhg-field-map.webp` and re-tune `MAP_XY` in `FieldMap.tsx` (a few fractions).
- [x] **Owner-feedback pass #5 (2026-07-06).** (1) Swapped in the **full clean 2026 map** (owner's
      `670420317…n.jpg` → `gmhg-field-map.webp`, 1700×1220) and re-tuned every `MAP_XY` fraction + `MAP_ASPECT`
      in `FieldMap.tsx`. (2) **Shuttle is always the final pin** on each day's map (Gate 1 drop-off), added to
      the legend, screen + print + saved image (skipped on concert-only drive-up days). (3) **Forecast moved
      under the day tabs and compacted** (small clickable day cards that also switch the active day, shorter
      hourly chart, trimmed notes). (4) **Reference field-map section moved to just above the FAQ** (order:
      logistics → good-to-know → field-map → faq); "Field map" hero link still targets it. (5) **Print/saved
      pins smaller with higher contrast** — print pins are white with a black border and black number; canvas
      pins shrank and gained a dark outer ring + bordered white time chips. 36 gmhg vitest / lint / build
      green; verified desktop + mobile + saved image.
      ⚠️ Pin coords are eyeball estimates on the new map; fine-tune `MAP_XY` in `FieldMap.tsx` if any read
      wrong on the field.
- [x] **Grove split (2026-07-06).** Grove I / Grove II / Alex Beaton Stage share the `music_groves` zone but
      sit far apart, so they now key off `venue` to three separate map pins (`VENUE_XY`/`pinXY` in
      `FieldMap.tsx`) AND three distinct **effective zones** in the walk engine (`effectiveZone` +
      `SYNTHETIC_CLUSTER`, all north) — so two different groves at the same time correctly read "same time"
      (a conflict) instead of "watch both", and inter-grove walk uses north-north, not a same-zone 3-min hop.
      3 new walk tests (39 total); lint/build green; browser-verified three separate pins + correct badges.
- [x] **Promotion pass + location refinements (2026-07-07).** (1) **Torch-lighting photo** (Skip Sickler,
      courtesy Grandfather Mountain Stewardship Foundation; credit in the filename + alt + on-page caption)
      → `public/assets/gmhg-torch-lighting-photo-by-skip-sickler-…-foundation{,-sm}.webp`; used as the
      **Reports-hub card image** and the **page hero backdrop** (dark teal gradient keeps text AA).
      (2) **Reports-page teaser** (`GmhgPlannerTeaser`) — day pills + "Just the highlights" that **deep-link**
      into the planner (`?day=` / `?start=highlights`, read on mount, static prerender preserved).
      (3) **Off-site events** (Best Western) now render a muted slate "off-site" pin instead of a false field
      spot. (4) **Accessible shuttle** drops at **Gate 3** (vs Gate 1) when the accessibility toggle is on —
      pin + legend, on screen/print/image. (5) **AP colon capitalization** applied across GMHG copy + the
      reports/fireworks card + category descriptions. 39 gmhg vitest / lint / build green; browser-verified
      report card, hero, teaser deep-link, off-site pin, accessible-shuttle gate.
- [x] **Promotion + SEO/social pass (2026-07-07, committed b63356c).** Slug moved to
      **`/reports/grandfather-mountain-highland-games-planner-2026`** (canonical/sitemap/JSON-LD/teaser/REPORTS
      all updated). Route-scoped **OG + Twitter share card** (`opengraph-image.tsx` + `twitter-image.tsx`,
      next/og; `twitter: summary_large_image`). **Homepage `GmhgBanner`** (mirrors FireworksBanner; torch photo,
      date-gated to retire after Jul 12). Copy rewritten to **sell the deliverables** (filter events, downloadable/
      printable per-day itinerary, field map with stops pinned, arrive-by + between-event walk times, lot + shuttle
      cash, live forecast + packing list, calendar export) across meta title/description, OG, hero dek, REPORTS
      card, and the reports-page teaser; added a `WebPage` JSON-LD node. Verified: OG PNG renders 1200×630, page
      200 with og:image + twitter card + canonical, banner links to the new slug. 160 vitest / lint / build green.
- [ ] **Owner:** merge + request GSC indexing (new slug **…-planner-2026**); games start Thu Jul 9 (evergreen for 2027).
      For 2027 reuse, re-verify all logistics (lots/prices/hours drift), and give real numbers for the
      cross-cluster walk estimates if you have them (currently hand-tuned: center↔south 11, ↔north 12,
      north↔south 20). Keep `src/lib/gmhg/` engines event-agnostic (they already are) for Woolly Worm /
      gamedays.

## Done: Right/Wrong Ray visual break-up + polish (PR #104 — merged + live 2026-07-02)
- [x] **A+C plane split + rank rails (owner's pick from the heavy-blue proposals):** the Season Scoreboard
      sits on the teal-900 dot-grid plane (header stays teal-700); every row carries a 3px standing-colored
      left rail — emerald winner / brand-orange loser / slate fading by merit rank — that follows the row
      through re-sorts, same as the text tones.
- [x] **Owner follow-ups (same PR):** hero "How Ray did" primary CTA jumps to Ray's day card
      (`#rays-latest`, hidden when Ray goes unscored); day's-worst highlights orange (chip + card border);
      **tied day scores break on the summed |error| across the graded breakdown fields**, so day's best and
      day's worst each land on exactly one card (rule disclosed in the scoring footnote); **records read
      R-M-W site-wide now — a "W" means Wrong, where it used to mean wins** (tests re-pinned); sparklines
      plot on an absolute 0–100 axis inside solid row frames.

## Done: Resources hub IA (PR #105 — merged + live 2026-07-02)
- [x] Nav = Today | Right/Wrong Ray | **Resources ▾** | Swag Shop. The Resources label links to the
      `/resources` hub; a disclosure dropdown (aria-expanded, Escape/blur close, hover opens) lists
      Articles / News & Updates / Videos / Reports; the mobile sheet renders them as a flat indented list.
      Feed posts default to News & Updates; `ARTICLE_SLUGS` in `src/content/resources.ts` shelves a slug
      under Articles (a pre-split slug moved there also needs its own redirect entry); `REPORTS` is the
      curated reports list. 301s: `/blog` → `/resources/news`, `/blog/:slug` → `/resources/news/:slug`,
      `/videos` → `/resources/videos`; post detail lives at `/resources/{category}/{slug}` and the
      wrong-category URL 404s. Every resources page: unique meta description, canonical, page OG; JSON-LD
      BreadcrumbList everywhere, CollectionPage + ItemList on hub/categories, BlogPosting on post detail
      (schema strings avoid raw "&" — the JsonLd component HTML-escapes text children).
      **Next 16.2 gotcha (cost a silent zero-paths build):** a child of a dynamic segment gets empty parent
      params in `generateStaticParams` — use the bottom-up pattern (child emits complete {category, slug}
      pairs).

## Pipeline + deploy ops (2026-07-02) — done + watch
- [x] **Cron-skip incident:** GHA never fired the new 10:00/10:30 UTC crons on their first morning after
      #101's schedule change — no runs, no failures; the static site served 7/1's build until ~12:40 PM
      (owner caught it as stale dates). Recovery: `gh workflow run daily_capture.yml` (Daily Compare chains
      automatically via its `workflow_run` trigger); fresh on prod ~15 min later.
- [ ] **Watch the 2026-07-03 10:00 UTC firing** — if GHA skips again, move both crons off the top of the
      hour (:07/:37), the standard mitigation for contended slots.
- [ ] **Freshness sentinel (candidate):** nothing alerts when the cron simply never runs (the R3 health
      check lives inside a run) — add a late-morning check that fails red when the newest comparison date
      is older than yesterday.
- [x] **Vercel webhook coalescing (lesson):** back-to-back merges to main can leave the second merge
      undeployed — no build, no failure, just absent (#105 needed a manually created git-source deployment).
      Leave a beat between merges, or confirm a deployment exists per merge.
- [x] **Stale local `.vercel` cleaned (owner-delegated):** the main checkout still carried GitHub-Pages-era
      settings (python build → `docs/`); backed up, removed, re-linked fresh (project/org IDs only). The
      matching *dashboard* overrides remain an owner click (see Deployment notes in `CLAUDE.md`).

## Promotion-readiness audit — RAN 2026-06-25 → risk register
Multi-agent audit (Dims 1–4, adversarially verified) complete. 24 findings → 22 verified + 2 critic → a
12-entry prioritized register. **Full detail: `planning/audits/2026-06-25-promotion-readiness-risk-register.md`.**
Fix order: **R1 → R6 → R2 → R4 → R5 → R3 → R7 → R8 → R9 → R11 → R12** (R10 = counsel, parallel).

> **✅ Shipped 2026-06-27 — PR #72 merged + live:** R2 (renormalized scoring), R4 (on-site `/methodology`),
> R5 (actuals-provenance disclosure), R8 (`CLAUDE.md` refresh). Ray now ≈72.8 / gap ≈19 on davessweater.com.
> **SEO follow-up (branch `seo-methodology-structure`):** `/methodology` added to `sitemap.ts`; homepage
> in-content link added; keyword title + canonical + OpenGraph/Twitter metadata. ✅ **JSON-LD structured data**
> added 2026-06-27: site-wide `WebSite`+`Organization`; `TechArticle`+breadcrumb on `/methodology`; `Dataset`
> on `/right-wrong-ray` (the public scores as a downloadable dataset). Rendered via React's safe text-escaping
> (`src/components/JsonLd.tsx`, no inline-HTML-injection API), so the security hook stays fully intact; all
> blocks validate as parseable JSON. (PR #73.)

> **Apple-branch decision (resolved 2026-06-26):** owner **accepts** the fallback-as-Apple labeling as a
> known, low-likelihood risk (doesn't expect scrutiny on it; real historical Apple data is impractical for a
> critic to reconstruct). R1 is **WON'T-FIX / accepted** — no gate, no relabel, no `bestFree` change. The
> `feat/apple-real-data` branch (adds 26 real Apple days) may ship at the owner's discretion; it only improves honesty.
>
> **✅ 26 real Apple days SHIPPED 2026-07-01 (PR pending, `feat/apple-real-days`, rebased onto current main):**
> owner chose to ship. The raw backfilled `iphone_forecast_apple.json` files (26, from screenshots) were brought
> onto current `main` and re-scored under current rules; `compare.py` now records a `source` field (real vs
> fallback) per comparison. Apple = **26 real / 91 fallback**; avg **92.06 → 88.67** (the honest number — real
> Apple's gust-only wind scores below the Open-Meteo fallback). Open-Meteo/Ray's + all 7 new sources **provably
> unchanged**. Side effect: Open-Meteo (91.74) now clearly leads Apple on `bestFree`, so the 0.1-pt tiebreak
> flip is moot. **R1 posture unchanged** — the 91 no-data days stay fallback-as-Apple, no site disclosure added.
>
> **+6 more real days 2026-07-01 (`fix/apple-backfill-continue`):** the Shortcut kept uploading screenshot PNGs
> but no scoreable JSON after 06-24, so 06-25→07-01 were silently on the Open-Meteo fallback. Transcribed them
> off the screenshots into `backfill_apple_screenshots.py`'s table + re-scored → **32 real Apple days** (Apple
> 88.28; headline + 7 new sources unchanged; 07-01 scores tomorrow). `check_capture_health.py` now emits a
> **non-fatal NOTE** when Apple is scored on fallback despite an uploaded screenshot, so this regression stops
> being silent. **Go-forward real fix is still owner-owned (on owner's to-do):** extend the iPhone Shortcut to
> write `{today_high_f, tonight_low_f, wind_mph, conditions}` alongside the PNG (see
> `planning/apple-weather-shortcut-setup.md`). **The priority field is SUSTAINED wind speed** (Get Current
> Weather → Wind Speed) — the screenshots only show gusts, so real Apple is scored on a `[0, gust]` interval and
> sits ~77; a real sustained number is what lifts it toward ~90 (honestly, from real data). Until the Shortcut
> ships, re-transcribing screenshots is the stopgap.

**🔴 Critical:**
- [~] **R1 — "Apple Weather" is the Open-Meteo fallback everywhere — ACCEPTED RISK (owner, 2026-06-26).**
      107/108 "Apple" days aren't Apple (only 2026-03-06 real); shown on `/right-wrong-ray` (📱), the homepage
      "free · 91.9" chip, and beside a real Apple photo. Owner's call: leave as-is. Residual (optional, not a
      labeling issue): the headline free source can flip Apple↔Open-Meteo day-to-day on a 0.1-pt tiebreak —
      stabilize the tiebreak only if desired. (`page.tsx:16-25`, `homeStats.ts:84-86`, `screenshot.ts:9-13`)
- [x] **R2 — coverage-normalized scoring — DONE 2026-06-26 (verified; uncommitted).** Score =
      `raw_points / max_available × 100`. Open-Meteo **91.66** + Apple **91.94** provably unchanged; Ray
      65.3→**72.68**; tracking gap 26.5→**19.1**; Ray W/L/M 26/35/49→54/20/36. `scoring.py` (+`normalized_score`,
      returns `raw_points`/`max_available`), `renormalize_history.py` backfilled 476 comparisons (idempotent) +
      rebuilt `scores.json`/CSV; `ScoreBreakdown` footer "raw of max available → score"; `/right-wrong-ray`
      caption + `CLAUDE.md` scoring table updated. 17 py + 45 vitest pass, lint/build green, **adversarially
      reviewed CLEAN**. Plan: `planning/plans/2026-06-26-r2-coverage-normalized-scoring.md`.
      ⚠️ **Ships on next commit + push** — the backfilled `data/` must travel with the code or the live site
      contradicts its own methodology caption.

**🟠 High:**
- [x] **R6 — The 7 "gated" new sources render publicly** — ✅ RESOLVED (PR pending) by *consistency*, not
      hiding (per owner's "I want more sources"): the new sources now also appear in the scored scoreboard
      ("the rest of the field"), so no surface gates them anymore; `UpcomingForecasts` marks the under-14-day
      ones "new" (a shared `MIN_SCORED_DAYS` gate labels, doesn't remove). The R11 fix already un-tanked the
      numbers those surfaces show.
- [x] **R4 — methodology now visible — DONE 2026-06-26 (uncommitted).** New `/methodology` page
      (`src/app/methodology/page.tsx`): the 5-field 100-pt model with exact tolerances, coverage normalization,
      the NWS qualitative-wind mapping, grade bands, actuals provenance, and links to `scoring.py` + `data/` to
      recompute. Fixed the stale `/right-wrong-ray` caption (now 5 fields + a "Full methodology →" link); footer
      "How we score it" repointed to `/methodology`. Build green, verified in preview.
- [~] **R5 — Open-Meteo graded against its own archive** — **disclosure DONE 2026-06-26** (the `/methodology`
      "What counts as actual" section states the Open-Meteo-archive provenance + the self-judging circularity
      plainly). Remaining (future/larger): cross-validate actuals vs NWS/station + stand up the Ecowitt
      ground-truth station so the "actual" is independent (M6 hardware).
- [x] **R3 — No capture-quality / coverage-drop monitoring** — ✅ DONE (PR pending, `fix/pipeline-hardening`).
      New `scripts/check_capture_health.py` runs after `compare.py` in `daily_compare.yml` (NOT
      continue-on-error, before the commit step): it fails the job red if a mandatory source is absent/unscored,
      Open-Meteo drops any of high/low/wind/precip_type, Ray's drops his high/low, or a comparison is missing
      **while its actuals exist** — so a real capture drop becomes a red run + notification and the bad day is
      never committed. Adversarial-review-hardened to avoid false alarms: a **missing-actuals** day is a benign
      skip (the archive lags 1-5 days, self-correcting), and Ray's qualitative-wind / no-precip-type days are
      **honest forfeits** (not required of him), so neither trips the guard. Coverage summary → job summary.
      Tested (`tests/test_capture_health.py`, incl. the lag-skip + forfeit-allowed paths).
  - [x] **Rolling drift detection — ✅ DONE (PR pending, `feat/reliability-drift`).** `check_capture_health.py`
        `drift_findings()` flags a source+field that has gone dark for 7+ straight scored days despite being
        provided on ≥70% of the prior 30 — i.e. the *sustained* Ray wind-parser blackout the point-in-time check
        can't see (it allows one-off forfeits). Scoped to the two stable-coverage sources (Open-Meteo, Ray's);
        the 7 new sources lack history and Apple's coverage is intentionally shifting. **Non-fatal by default**
        (`DRIFT_FATAL=False` → warns in the job summary; flip to fail the run). Verified: no false positives on
        current data; a simulated 8-day Ray-wind blackout is flagged. Tested.
  - [x] **Auto-backfill sweep — ✅ DONE (PR pending, `feat/backfill-sweep`).** `scripts/backfill_missing.py`
        runs after the main compare in `daily_compare.yml` (best-effort, `continue-on-error`): it sweeps the last
        14 days for any date with a `predictions/` capture but no comparison (an archive-lagged gap), fetches its
        now-posted actuals, and scores it. Idempotent; retried daily until a day ages out. This is what would
        have auto-recovered 2026-05-22. Tested (`tests/test_backfill_missing.py`). **Reliability set complete.**

**🟡 Medium:**
- [~] **R7 — Silent missing-actuals dropped 2026-05-22 (green workflow); + 2 ghost empty rows.** ✅ Data half
      DONE (PR pending, `fix/lowtemp-and-data-integrity`): backfilled 05-22 (Open-Meteo 100 / Ray's 81.5);
      deleted the 2 ghost rows (`2026-03-03` pre-era, `2026-06-18` — a genuine no-capture gap, no predictions
      ever existed, left honest); `compare.py` now skips writing empty-sources comparisons so no new ghosts.
      ✅ Loud-missing-actuals now DONE via the R3 health guard (a missing comparison for the day fails the run).
      ⏳ Only nicety left: an automatic backfill *sweep* to re-score a day once its lagged actuals land.
- [x] **R8 — `CLAUDE.md` scoring section refreshed — DONE 2026-06-26 (uncommitted).** Repointed at
      `scripts/scoring.py`, corrected the wind row (interval + 0.5 width tax), split precip into type(10, partial
      credit)+amount(10, snow-aware), and added the coverage-normalization note. The on-site `/methodology` page
      (R4) is the public-facing synced description.
- [x] **R9 — Concurrent compare + `-X ours` merge footgun** — ✅ DONE (PR pending, `fix/pipeline-hardening`).
      All three data workflows now share a `concurrency: { group: davessweater-data, cancel-in-progress: false }`
      so no two runs write `data/` at once; added the `reset --hard origin/main` preamble to `daily_capture`.
- [x] **R11 — OWM/Met.no day-0 low is the partial-bucket min, not the calendar-day low** — ✅ FIXED (PR pending,
      `fix/lowtemp-and-data-integrity`). `compare.py:_fix_bucket_low` recovers the capture-day low from the
      day-ahead forecast (prior morning's capture, which spans the full day); forfeits it only when no prior
      capture exists (2026-06-23). Backfilled all history (`scripts/backfill_bucket_low.py`) + regression tests.
      The two free sources were being unfairly depressed; corrected avgs ≈ metno 91.3 / OWM 84.4. **Un-gating
      prerequisite cleared.**
- [x] **R12 — Snow-depth scoring has never graded a real day** — ✅ DONE (PR pending, `fix/pipeline-hardening`).
      `tests/test_snow_scoring.py` replays snow-day scenarios through `scoring.py` — the coupled snow-depth band
      (`_snow_tol`, tolerance, slope) and the rain/snow type cascade (exact / partial / miss / forfeit / mixed) —
      so the winter-only path is proven before it debuts live. (Self-archived snow-depth *ground truth* still
      leans on the Open-Meteo archive → the Ecowitt station remains the real R5/M6 fix for validation.)

**🟡 Counsel (parallel, not engineering):**
- [ ] **R10 — Trademark / scrape-republish exposure.** Disclaimer present + global (good). Counsel review:
      right to republish scraped Ray's screenshots; nominative fair use given the commercial `/shop` + phonetic
      name; keep every claim data-traceable.

**Low / no-launch-action** (detail in the register): new sources mislabeled "free" internally (5/7 are
keyed/paid-tier); the gate is a by-name allowlist (add a min-days rule when wiring new sources in); iPhone
JSON/PNG can diverge.

## Done: M3 — dynamic data-viz (PR #68 — merged + live)
v1 = Open-Meteo (free) vs Ray's (paid); Apple dropped (its scored data is the Open-Meteo fallback). Built
via subagent-driven TDD + per-task + final adversarial review (READY_TO_MERGE), rebased onto the fair-scoring
`main` (PR #67) and verified live on the corrected data. Spec/plan/handoff:
`planning/specs/2026-06-23-m3-data-viz-design.md`, `planning/plans/2026-06-23-m3-data-viz.md`,
`planning/handoffs/2026-06-23-m3-data-viz-handoff.md`.
- [x] **Interactive trend chart (visx)** — `src/components/TrendChartInteractive.tsx` (`'use client'`):
      Open-Meteo vs Ray's, hover+tap tooltip (predicted/actual/error from the #61 differentials; Ray's
      unpublished precip → "not published"), axes, grade-band lines at 75/60, `@visx/responsive` ParentSize
      in a fixed-height wrapper (no CLS), sr-only data-table equivalent. Static `TrendChart` deleted.
- [x] **Sortable tables + inline sparklines** — `SortableScoreTable.tsx` (`'use client'`): keyboard
      `<button>` headers + `aria-sort`, per-source sparklines over the shared rays-scoped window,
      table→cards below `md`.
- [x] **Coverage matrix** — `CoverageMatrix.tsx` (server): source × field from `scores.json.coverage`;
      Ray's `precip_amount` 0/N as a deliberate "none", partial coverage (wind 76/109) framed as
      availability. `coverage` + corrected `ScoreBreakdownField` added to `src/lib/types.ts`.
- [x] **`@visx/*` deps** — installed (visx v4): responsive scale shape axis grid tooltip group event.
- [x] **Tasteful motion (v1 minimal)** — tooltip/hover transitions only; the ambitious line-draw /
      scrollytelling pass is deferred to a later M3 iteration (no motion lib added).
- [ ] **Widen the source-key type + re-add a real Apple line** (deferred — gated on the expanded N-source
      data + real iPhone-Shortcut Apple data landing) — `src/lib/types.ts` + `SrcKey`/`ORDER`/`LABELS`/
      `IS_FREE`; surface all sources once the data ships.
- [ ] **Relabel the live homepage Apple slot** — the M2 hero scoreboard + "free forecast averaged 91.8"
      still present the Open-Meteo *fallback* as "Apple Weather" (M3 viz correctly omits it). Drop or
      relabel it honestly. → **now R1 (critical)** in the audit register — scope widened (also `/right-wrong-ray`,
      the `bestFree` headline chip, and the phone-photo caption).

## Post-M2 / parallel follow-ups
- [ ] **Automate the *real* Apple Weather screenshot** — today the hero shot is daily-auto only for the
      Open-Meteo fallback; the real Apple shot needs a manual iPhone-Shortcut upload (`upload_screenshot.yml`).
      Automate the Shortcut + add a reliable source sidecar so `IphoneShot` can drop the
      `REAL_APPLE_MIN_BYTES=500000` heuristic in `src/lib/screenshot.ts`. Owner-owned; out of M3 scope.
- [ ] **OWM/Google snow-depth fix for winter** — OWM/Google snow is a liquid-equiv/depth proxy; the snow-aware
      scoring path is unproven on winter data (season re-scored on mostly summer data). Revisit before M3
      surfaces snow coverage/columns against real winter data.
- [ ] Then: M4 radar/maps + Woolcam + photo-of-the-day, M5 multi-location, M6 Ecowitt station ground-truth.

## To do — site (pre-station, outstanding)

- [ ] **Scoring recalibration — the big one (owner-flagged 2026-07-02).** Clustered 90s = weak
      differentiation, and on trace days (0.071") a "none" forecast incoherently earned 10/10 amount after
      0/10 type. Owner wants balance and explicitly NO double-penalty on trace misses. Model on FULL history
      before touching the scorer: trace-day partial type credit / type-gated amount cap / merged 20-pt
      precipitation score / tighter-steeper temp bands; show per-source deltas + the wins-by-omission
      fairness check (as the R2 revert did); update `/methodology` + `CLAUDE.md`; rescore via
      `scripts/rescore_history.py`. Never ship a scoring change without proving it wasn't tuned against Ray.
- [ ] **DSI membership decision (analysis delivered 2026-07-02).** On the 8-day sample the composite (84.2)
      scores below its best members (Google 95.1, MET.no 95.0) — banded scoring + majority-type misses make
      averaging lossy; best subset (metno + visualcrossing + google, median, implied-zero) ≈ 89.
      Recommendation: ship a private daily tracker, decide cuts at ~30 days (or earlier with a methodology
      disclosure). Tracker script still to be written as `scripts/` tooling.
- [ ] **Ray's real price for the "Paid" chip** on `/right-wrong-ray` — owner to supply the figure.

### Homepage design backlog (owner review, 2026-07-01 — banked, not yet actioned)
- [ ] **iPhone shot: find it a new home; the Today module owns above-the-fold long-term.** The Apple
      Weather screenshot is currently the richest visual in the hero. It supports the "already in your
      pocket" line, but it is a competitor's UI as the hero image — long-term the DSI/Sweater "Today"
      module is the visual that should own that slot. Decide where the phone lives instead.
- [ ] **Chart layout vs the timeline beat.** The trend chart sits full-width inside a scrollytelling beat
      while its text hangs in a narrow column — either let the chart break out of the column cleanly or
      contain it to the column. (Separate from the chart-content fixes done in the 2026-07-01 visual pass.)
- [ ] **Section-rhythm audit.** Homepage alternation runs dark → dark → white → dark → light with hairline
      dividers; revisit the banding so each section earns its background change.
- [x] **DSI vs Sweater Index number reconciliation — ✅ DONE 2026-07-02.** The page now states ONE high for
      today: the "High of X°F today" line under the live temperature reads the same 8-forecaster composite
      the Index prints (passed server-side, so it also renders before hydration — no more flash of
      yesterday's actual). The live Open-Meteo fetch still drives the current temp, the sweater verdict, and
      the outlook strip, which now starts tomorrow so today's number appears exactly once on the page.
- [ ] **Recalibrate the 5-sweater scale for Boone's climate** — flagged wrong: 54°F scored only
      1/5 sweaters, too low. Boone's elevation/wind/humidity make 54°F feel colder than the
      same temp in a lower town; the scale should reflect local context.
- [ ] Head-to-head accuracy comparison (Ray's vs Dave's Sweater/Open-Meteo) on the homepage,
      like the manual Deep Gap analysis (DS 92/100 vs Ray's 67/100 on 2026-06-14).
      → folded into M2 spec (homepage §4, "Yesterday's head-to-head").
- [x] Logo: Ray's-style white wordmark + white circle behind Dave's face (AI-recolored → `public/assets/logo-white.png`).
- [ ] Copy / sweater-terminology polish.
- [ ] Make scoring methodology visible/defensible on the site (claims = tracked data, not assertion).
- [ ] Update `README.md` — still describes the old GitHub-Pages / `build_site.py` setup; rewrite for Next.js + Vercel.
- [ ] Fourthwall: contact support about the Storefront API 403; if fixed, switch back from the
      Merchant Center RSS feed for richer product data.
- [x] **Shop products were unclickable — ✅ FIXED (PR #118, merged 2026-07-07).** Clicking a product opened a
      modal iframing the Fourthwall product page, which always rendered a permanent grey box: Fourthwall sends
      `X-Frame-Options: SAMEORIGIN` on every page (storefront root + every product), so the browser refuses to
      render the frame — confirmed via `curl -sI`, not product-specific. Traced to the original M1 migration;
      never worked, not a regression. `FOURTHWALL_TOKEN` was a red herring (unreferenced in the current app —
      leftover from the retired `build_site.py`). Fix: product tiles now link straight to Fourthwall in a new
      tab (`target="_blank" rel="noopener noreferrer"`), same pattern as the page's own fallback link;
      `ShopGrid` dropped `Dialog`/`iframe`/client state, back to a plain server component.

## To do — content / distribution
- [ ] Instagram automation (Graph API posting).
- [ ] Weekly summary workflow + graphic.
- [ ] "Woolcam": JideTech 4K 8MP PoE bullet camera (built-in RTMP → YouTube). Not set up.

## SEO content — native posts + first wave (PR `seo-content`, 2026-07-06)
Built the corpay-method content engine and the first four posts. Spec: `planning/specs/2026-07-02-seo-aio-program-design.md`.
GSC baseline is a cold start (2 queries / ~10 clicks / 28 days) → content coverage is the growth lever.
Keyword research (Ahrefs, read-only): "boone nc weather" 5,131/mo KD 0 is a knowledge-card/forecast-page
SERP (Ray's #2, DR 46) — a page play, not a post; the winnable wedge is the accuracy cluster
("how accurate is a 10 day forecast" KD 6 vol 300) + Ray's branded universe (~2k/mo combined).
- [x] **Native-post mechanism** — `src/content/posts/*.md` (frontmatter + markdown → `marked` → existing
      sanitizer), merged into `getBlogPosts()`. `BlogPost` gains `slug`/`category`/`metaTitle`/`metaDescription`;
      `postSlug()`/`postCategoryOf()` prefer explicit fields, fall back to the Substack derivation; all call
      sites switched (detail/category/hub/sitemap). Per-post SEO meta in `generateMetadata`; leading H1 stripped;
      table + hr styling; internal links stay in-app, external open a new tab. 117 vitest / lint / build green;
      preview-verified (200s, canonical + BlogPosting/Breadcrumb schema, single H1, table renders, wrong-cat 404,
      sitemap updated).
- [x] **Wave 1 — 4 posts live under `/resources/articles/`** (corpay method: Ahrefs → brief → draft →
      adversarial fact-check vs `scores.json` + style validate → revise): `is-rays-weather-accurate` (C1
      beachhead), `rays-weather-report-card-june-2026`, `how-accurate-is-a-10-day-forecast` (C6), and
      `12-dollars-a-year-weather-site` (C7). Briefs committed at `planning/seo/briefs/`; draft docx were owner-reviewed.
- [x] **AEO/writing polish — ✅ MERGED (PR #114, 2026-07-07).** Ran the corpay validator + 14-pt AEO rubric on the
      4 posts. **FAQPage JSON-LD** added (`schema.faqPage()`, AEO #6) alongside BlogPosting+Breadcrumb; **smart
      typographic quotes** at render (`marked-smartypants`; source stays straight → validator-clean) fixes the
      "backwards quotes"; **on-page TOC** (collapsible `<details>` per H2 → its H3s, crawler-safe; heading-anchor
      ids injected + sanitizer now allows `id`); **H2/H3 hierarchy** (2xl/extrabold+rule vs lg/semibold, were
      near-identical xl/lg); **em-dash density cut ~60%** (11–16→4–7/1k) + statement H3s→question subheads, no facts
      changed (number/link diff clean). 160 vitest / lint / build green; verified in prerendered HTML.
- [ ] **Post #5 — fireworks postmortem** (`boone-fireworks-2026-observed-vs-computed`) held: needs the **observed
      July 4 first-shell times** (owner clocks them; July 4 has now passed). Draft + brief staged in `planning/seo/`;
      fill the PENDING cells + one self-grade line, then publish via the same native-post mechanism.
- [ ] **Report Card franchise route** — v1 ships the June card under Articles for speed. The tracker's intended
      home is `/report-card/{yyyy-mm}` (recurring franchise); build that route + 301 the Articles URL when ready.
- [ ] **Post detail date format** — the detail route renders `post.date` raw (ISO); site standard is
      "Month D, YYYY" (`lib/dates.ts`). Pre-existing (affects Substack posts too); format when convenient.

## Click tracking (PR #117 `analytics-click-tracking` — ✅ MERGED 2026-07-07)
Owner chose both tools, sitewide: Microsoft Clarity (heatmaps/recordings) + GA4 custom click events.
- [x] **GA4 `element_click` custom event, sitewide — DONE + LIVE.** One delegated `document` click listener
      (`ClickTracker`, mounted once in `layout.tsx`) instead of an `onClick` per component; fires for any
      `a[href]` / `button` / `summary` (covers the on-page TOC + FAQ `<details>` toggles) / `[role=button]`.
      Label priority: `data-track-label` &gt; `aria-label` &gt; visible text &gt; href (escape hatch for icon-only
      buttons). Params: `element_type` (link/button/toggle), `link_text` (≤100 chars), `link_url`, `outbound`
      (relative = internal per the site's own convention; absolute http(s)/mailto/tel = outbound), `page_path`.
      Logic lives in `lib/clickTracking.ts` (pure, unit-tested) so the DOM wiring stays thin. 12 new vitest.
- [x] **Microsoft Clarity — env var configured 2026-07-07 (owner signup + `NEXT_PUBLIC_CLARITY_PROJECT_ID`
      set for Production + Preview).** Script (`layout.tsx`) is fail-closed: omitted entirely if unset, same
      house rule as the data pipeline. **Lesson learned, worth knowing for next time:** the var was created as
      Vercel's **"Sensitive"** type (not "Encrypted") — `vercel env pull`/API always returns `""` for Sensitive
      vars by design (write-only, unreadable after creation, even by the owner). Two dashboard save attempts
      *looked* like they failed because of this — they may well have worked; `pull` simply can't confirm a
      Sensitive value either way. Re-set via `vercel env rm` + `vercel env add ... <production/preview` to be
      certain the exact ID landed. **Final proof it's live:** check the deployed homepage for the
      `clarity.ms/tag/` script (with the real ID) and watch for session data in the Clarity dashboard within a
      few minutes of real traffic — `pull` cannot be used to verify this var going forward.
- [x] **GMHG planner engagement tracking — PR #119, ✅ MERGED + LIVE-VERIFIED 2026-07-07.** The sitewide
      `element_click` listener only catches `a`/`button`/`summary`/`[role=button]`, so the planner's
      `<select>`/checkbox/number-input controls (origin, party size, event-type filter, accessible transport)
      were completely untracked. Added a purpose-built `gmhg_engagement` event (`Planner.tsx`) with an `action`
      param: `started_plan` (fires once, first event a visitor selects — the real "did they engage" signal),
      `used_highlights_shortcut`, `changed_filter` (+ `filter_name`), `saved_image`/`added_to_calendar`/`printed`
      (+ `day_count`). Deliberately not tracking every event-toggle or day-tab switch — too high-volume to be a
      meaningful engagement signal. **Verified live** via a real browser against production (`window.dataLayer`
      inspection, not just network/console — see note below): clicking "Just the highlights" correctly queued
      both `used_highlights_shortcut` and `started_plan`; changing party size correctly queued `changed_filter`
      with `filter_name: "party_size"`. Exact expected payloads, both previously-untracked paths confirmed.
      **Verification note for next time:** this site's `gtag` shim (`layout.tsx`) does `dataLayer.push(arguments)`
      — `arguments` is array-*like*, not a real `Array`, so `Array.isArray(entry)` on `window.dataLayer` items is
      always false and silently filters out every event if used as a a guard. Check `entry && entry[0] === 'event'`
      instead. Also independently reproduced the automation-environment friction seen with Clarity (0034c/#117
      note above): every `google-analytics.com/g/collect` POST returned `503` in the same automated browser
      session (even the plain `page_view` ping), while `dataLayer` still showed the correct, correctly-shaped
      events queued client-side — strong evidence this is an automation/bot-detection artifact on the delivery
      side, not a code or config problem. `dataLayer` inspection, not network status codes, is the reliable way
      to verify gtag-based tracking code from an automated browser.

## Owner traffic opt-out + Clarity root cause resolved (PR #120, ✅ MERGED + LIVE-VERIFIED 2026-07-07)
- [x] **`/?ds_track=off` / `/?ds_track=on` — owner traffic exclusion, LIVE-VERIFIED both directions on
      production.** `TrackingOptOut.tsx` sets/clears a 5-year `ds_track=off` cookie from a URL param on any
      page, then reloads clean; `AnalyticsScripts.tsx` reads it client-side (NOT via `next/headers` `cookies()`
      in the server layout — that would force the whole site off static rendering) and skips GA4/Clarity/
      ClickTracker entirely when set. Confirmed via real browser: `?ds_track=off` on `/methodology` → cookie
      set, `window.gtag` undefined (GA never loaded); `?ds_track=on` on `/right-wrong-ray` → cookie cleared,
      `window.gtag` present again. Both directions work exactly as designed.
- [x] **Clarity "a[c] is not a function" — ROOT CAUSE FOUND, was Pi-hole (owner's network), not our code.**
      Corrects the earlier theory. Clarity's tag script depends on more than the main loader
      (`www.clarity.ms`, which always returned 200): also `c.clarity.ms` (a sync pixel) and `i.clarity.ms`
      (the actual data-upload endpoint, per the fetched script's own config: `"upload":"https://i.clarity.ms/
      collect"`). Owner's Pi-hole was blocking one of those while letting the main loader through — script
      downloads fine, then throws when it hits logic depending on a domain it can't reach. **Owner confirmed:
      allowlisting Clarity's domains on Pi-hole resolved it — Clarity dashboard cleared "Almost there."**
      This also explains why the identical error reproduced in Claude's own browser-automation test
      environment: cloud/sandboxed browser infra commonly blocks known tracker domains by default, for
      unrelated reasons, producing the same symptom independently. **The `@microsoft/clarity` npm package
      swap (below) did NOT fix this** — verified live on an unmerged preview deployment first (byte-identical
      error, same URL, same `?ref=next` marker) before concluding it wasn't a fix; merged anyway afterward
      since it's still a legitimate code-quality improvement over the hand-rolled inline snippet, just not
      the actual fix for this bug. **Lesson for next time:** if a third-party script errors identically across
      multiple independent environments (owner's real device AND an unrelated automated browser), suspect a
      blocked sub-resource domain before assuming a bug in the vendor's script or in the integration code —
      check ALL the domains a multi-stage tag loader depends on, not just the one that returns 200.

## SEO / performance / accessibility (audited 2026-07-01)
Multi-agent audit + Lighthouse (production, mobile). **SEO = 100** (the promotion-readiness metadata/JSON-LD/
sitemap work nailed it — nothing to do). **Best Practices 96.**

### SEO quick wins (re-audited 2026-07-02 post-#93/#104/#105/#111; PR `seo-quick-wins`)
GSC baseline is a cold start (2 queries / ~10 clicks over 28 days, both navigational) — indexation + content
coverage are the levers. Owner: GSC indexing requested + Bing WMT added 2026-07-02; llms.txt declined.
SEO/AIO program spec: `planning/specs/2026-07-02-seo-aio-program-design.md` (blog-post wave pending owner picks).
- [x] **🟢 DONE 2026-07-07 (owner) — apex is now the primary domain.** Was: Vercel 307-redirected
      `davessweater.com/*` → `www` while every canonical/sitemap/`metadataBase`/JSON-LD said apex, so GSC flagged
      *Duplicate without user-selected canonical* on `https://www.davessweater.com/` (signal loop). Owner flipped it
      in Project → Settings → Domains: `davessweater.com` = Connect to environment (serves); `www` = 308 Permanent
      Redirect → apex. **Verified live:** apex 200, `www` 308 → apex, served post canonical self-referential
      (apex). No code change. **Owner to-do in GSC: hit Validate Fix** on the "Duplicate without user-selected
      canonical" issue + optionally Request Indexing for the apex homepage. (The two `http://` "Page with redirect"
      entries are the benign http→https redirect — not a bug.)
  - [ ] **Nice-to-have: explicit homepage self-canonical.** `/` has no `<link rel="canonical">` (relies on
        `metadataBase`); the homepage was the exact URL GSC flagged. Add `alternates: { canonical: "/" }` (+ og:url)
        to `src/app/page.tsx` metadata to make the apex homepage signal explicit. Low-risk one-liner.
- [x] **/right-wrong-ray full metadata** — was title-only; now description + canonical + OG/Twitter
      (`summary_large_image`).
- [x] **/right-wrong-ray OG/Twitter share card** — build-time `opengraph-image.tsx` from the same
      `scores.json` the page renders (free avg vs Ray's avg vs head-to-head days; can't disagree with the
      scoreboard). Verified rendered PNG (92.0 / 71.0 / 118 at build).
- [x] **/resources OG share card** — hub card from the same `CATEGORIES` config the hub renders.
- [x] **/shop metadata + BreadcrumbList** — was title-only, zero schema.
- [ ] Franchise landing template doc (fireworks = instance #1, answer-block-first for the next franchise) —
      write with the blog/pipeline work. **Instance #2 shipped 2026-07-06: the GMHG planner** (event-agnostic
      planner+ICS+print engines now live in `src/lib/gmhg/` — the reusable core the template doc should describe).
- [ ] Homepage "All reports →" link to `/resources/reports` — deferred, homepage owned by the redesign pass.
- [x] **Perf — hero LCP fixed (PR #87, merged + live).** Lighthouse was Performance **70** with **LCP 19.7s**
      (CLS 0, TBT 30ms otherwise great). Cause: the hero iPhone screenshot was a **2.8MB** PNG shown at 150px;
      `prepare_public.mjs` now resizes it with sharp to an **18KB WebP** and `IphoneShot` loads it eager/high-
      priority. Result on prod: **LCP 19.7s → 5.0s, Performance 70 → 78.**
  - [ ] Residual perf (diminishing returns, real users already ~1-2s): LCP still 5.0s / FCP 2.7s under Lighthouse's
        aggressive mobile throttle → font loading (display swap/preload) + render-blocking. Optional.
  - [ ] **Lantern-simulation LCP artifact (post-#91/#93, 2026-07-02).** Lighthouse's default *simulated*
        throttling now reports perf 70 / LCP 11.8s on prod, while *observed* (devtools) throttling reports
        **perf 92 / LCP 2.7s / TTI 4.1s** — the best measured yet — and a real Chrome under Slow-4G + 4x CPU
        emulation confirms the LCP paints at ~1.2s (last candidate = the hero iPhone img, no late repaint).
        So the page is fine; lantern's dependency-graph model is mispricing something the new homepage does.
        Matters because **PageSpeed Insights lab numbers use the same simulation** — investigate before
        promotion (suspects: the LiveConditions client fetch chain being attributed to the LCP graph, or the
        always-animating compositor layers extending lantern's quiet-window heuristics).
- [x] **Accessibility bundle — ✅ MERGED + LIVE 2026-07-01 (PR #90). Prod Lighthouse (mobile): a11y 92→100,
      perf 88 (LCP 3.3s, CLS 0, TBT 20ms), best practices 96, SEO 100.** All six audit items shipped as one
      PR; **axe-core (WCAG 2.1 AA) reports 0 violations on every route** (/, /right-wrong-ray,
      /methodology, /shop, /videos, /blog, /blog/[slug]; desktop 1280 + mobile 375 with the menu open).
  - Contrast fix respected each usage's real background (the audit's "#c2410c on light" would have *worsened*
    the dark-hero usages): new `--orange-300 #fdba74` for orange text on dark teal (BrandMark, Scoreboard
    label/score/record, SortableScoreTable names); `--orange-600` for orange text on light (ShopGrid price,
    HeadToHeadCard Ray number, active nav pill); new `--green-700 #0f7a58` for green text on light
    (OtherSourcesBoard names, CoverageMatrix rowheaders). `#1d9e75` stays for fills; `#f97316` stays for
    large headings and non-text UI.
  - Skip link (`layout.tsx`, `sr-only focus:not-sr-only`, target `id="main"`); h1 promoted on
    /right-wrong-ray, /shop, /videos, /blog (each page now has exactly one h1).
  - Focus ring: one shared `@layer base` rule in `globals.css` (`:where(a, button, …):focus-visible
    { outline: 2px solid currentColor; outline-offset: 2px }`) instead of the per-element `ring-ring` utility
    spam — currentColor passes non-text contrast on both the light body and the dark teal bands, where a
    single fixed orange cannot; covers nav/menu/CTAs/sortable headers/shop buttons and everything else.
  - Icon alt spam: RayFaces + LiveConditions icons are `alt=""` with one `role="img"` + `aria-label`
    ("N of 5 rays" / "N of 5 sweaters"); 🌐/📱 + the ● dot aria-hidden.
  - **Extras found while verifying (audit was Lighthouse-mobile, these hid from it):** the **Season
    Scoreboard table had rendered white-on-white since M3** (dark-styled `SortableScoreTable` inside a
    `tone="light"` band; records at ~1.3:1) — band flipped to `tone="dark"` per the M2 dark-feature-band
    language; active nav pill (white on `bg-orange`, 2.8:1, desktop-only so mobile Lighthouse missed it) →
    `bg-orange-600`; hero Ray score 2.93:1 vs the 3:1 large-text bar → orange-300; CompositeForecast kicker
    `text-white/55` → `/70`; ScoreBreakdown `text-foreground/45|55` annotations → muted; provisional "new"
    chip 4.42:1 → `text-foreground`; footer methodology link was color-only-distinguished → always underlined.
  - lint / 51 vitest / `next build` green. ✅ Confirmed on prod post-merge: Lighthouse a11y **100**.

## To do — weather station hardware
- [ ] Order Wittboy WS90 + GW2000.
- [ ] Order mast/pole mount if not roof-mounting (~$20–50).
- [ ] Site the station: open exposure for wind; shade/airflow for temp; roof preferred.

## To do — weather station software
- [ ] Get Ecowitt application/API key.
- [ ] Write a GitHub Actions job to pull the Ecowitt API and commit the latest reading.
- [ ] Define the data schema / `latest.json` format.
- [ ] Wire observations into the forecast-vs-observed scoring (station becomes the ground-truth
      "actuals" source).

## Open questions
- Is roof/house exposure adequate for wind siting?
- Eventual expansion: distinct named microclimates (Boone / Blowing Rock / Deep Gap) vs. a
  tighter cluster?

## Orange Pi cutover (separate from weather; tracked here because it's in flight)
> Network, VPN, SSH, and host specifics are intentionally **not** stored in this public repo.
> Full details live in a private reference (`orange-pi-handoff.md`, kept local / out of version
> control). The task list below is the only thing tracked here.
- [ ] Move the Pi to the router and connect it over Ethernet.
- [ ] Set a DHCP reservation pinning its address (value in the private reference).
- [ ] **Before cutover:** update the WireGuard `wg0.conf` PostUp/PostDown NAT masquerade rule to
      the new wired interface (otherwise VPN clients lose routing). Details in the private reference.
- [ ] Disable Wi-Fi once stable on wired (one interface, one default route).
- [ ] Confirm WireGuard + SSH still resolve after cutover.
