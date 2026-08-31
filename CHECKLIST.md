# Dave's Sweater — Checklist

This file is the durable single source of truth for outstanding work. Read it at the
start of each session and keep it current — check items off, add new ones, and update it
in the same change that completes a task. Do not rely on chat memory; this file wins.

## FALL-CRITICAL, OWNER (2026-08-30)
Peak color in the High Country runs roughly Oct 5–25 and search interest ramps from early
September, so the fall runway is about five weeks. These are the items only David can move.
One line each; detail lives in the linked sections below. Prune as they close.

- [x] **left917.net courtesy ping — DROPPED, David's ruling 2026-08-31.** Draft stays at
      `planning/2026-07-28-left917-courtesy-ping-draft.md` as a record; do not send, stop
      surfacing. (The compute_busyness event-feed wiring idea survives separately if a
      session ever picks it up on its own merits.)
- [x] **AirROI Redistribution Addendum — PERMISSION OBTAINED (David, confirmed 2026-08-31), with a naming caveat RESOLVED by David 2026-08-31: indirect references are fine; the vendor must not be INDICATED AS THE SOURCE where that is not allowed — visible "Data source: <vendor>" attributions on public surfaces become indirect descriptors (change riding the pigasus site-copy PR); internal code references may keep the name.** Ingest wiring dispatched same day. Travelpayouts backup token remains optional/owner (optional, upgrades
      the tourism demand signal before its page ships Sept 2). Draft email and steps were
      provided 2026-07-25 under Tourism forecast.
- [x] **Disavow upload — ✅ DONE 2026-08-30 23:45 EDT** (443 domains, full replacement, via the
      **URL-prefix property** `https://davessweater.com/` — the tool rejects Domain properties).
      This line read "still pending" until 2026-08-31 because the upload was stamped in the detailed
      entry below and not here; the standing task now checks both places. Next refresh 2026-09-20.

## Fall readiness sweep (2026-08-30, from OVERALL IA)
Brief executed: `IA-BRIEF-2026-08-30-fall-readiness.md` (deleted on landing, per its own
instruction). Local checkout was 24 commits stale and carried one unpushed commit
(CAPABILITIES.md); rebased and current.

**Landed this pass (PR `fall-readiness-2026-08-30`):**
- [x] **Fall-freshened all 17 town pages with a per-town peak-color module.**
      `src/lib/leaf.ts` is now the single reader for `data/leaf/predictions.json`;
      `src/components/FallColorWindow.tsx` renders the town's predicted window, the
      elevation band, and the arithmetic behind it. Every number including the 6.5 days
      per 1,000 ft lapse rate is derived from the record (`lapseRatePerThousandFt`), so
      page copy cannot drift from the model. Copy states plainly that the window is
      elevation-climatology only until September temperatures accrue, and that this is
      the model's first live fall. Module self-retires 45 days after a window closes
      (`leafWindowIsCurrent`) so last fall never ships as this fall. 20 new vitest
      (366 green), 583 pytest green, copy_lint 0 errors, eslint clean, build green,
      verified at 360px / 390px / desktop with zero horizontal overflow.
      ⚠️ **Note for the /leaf build (Aug 31):** reuse `src/lib/leaf.ts`, do not re-parse
      the JSON. The cross-town view belongs to /leaf; the town pages deliberately carry
      only their own window, so the two do not compete for the same query.
- [x] **`/roads` given a site-wide inbound internal link** in `SiteFooter.tsx`. GSC
      reported it "Discovered - currently not indexed" with **no crawl on record** and
      zero impressions all August, against two weak inbound links (the reports listing
      and one line in /methodology). The footer renders on all 60 URLs, which are being
      crawled daily. This is the highest-value indexing fix available before the season.
- [x] **Sitemap `lastmod` discipline audited: already correct, no change needed.** Town
      pages stamp their own latest scored comparison date, which moves daily, so the new
      fall module inherits a fresh, honest `lastmod` automatically. Verified live: 60
      URLs, newest lastmod = today.

⚠️ **READ THIS BEFORE THE Aug 31 / Sept 2 BUILDS — the function budget is AT ITS CEILING.**
`python3 scripts/check_function_budget.py` on this branch reports **10 bundles, budget 10,
Hobby cap 12**, and prints "At budget. The next dynamic route family fails this check."
`/leaf` and `/tourism` are safe only as **static routes with no dynamic segment**. A
`[slug]`/`[...param]` segment, a route handler, or a dynamic `opengraph-image` route each
adds a function family, and the Hobby cap is precisely what froze production for two days
in August. Static `opengraph-image` files are fine (the existing `/reports/*` ones compile
as Static). This pass added no routes and did not move the number.

**Queued behind the two scheduled builds** (each is one commit once the page exists):
- [ ] **Internal links to `/leaf`** (after the Aug 31 build). Exact insertion points, in
      priority order: (1) `src/components/SiteFooter.tsx`, same row as the /roads link
      added this pass, label "Leaf forecast" — this alone gives it all 60 pages;
      (2) `src/components/FallColorWindow.tsx`, appended to the closing "graded like
      every other forecast" paragraph, where an in-file comment marks the slot — one
      sentence pointing at the cross-town map, giving 17 contextual in-body links from
      pages Google crawls daily; (3) `src/app/page.tsx`
      near `AlsoTracking`, seasonal. Files: those three. Add `/leaf` to
      `src/app/sitemap.ts` with `stamp(leafGeneratedAt)` from `generated_at`.
- [ ] **Internal links to `/tourism`** (after the Sept 2 build). Same footer row, label
      "Busy-ness Index"; plus `src/app/roads/page.tsx` (traffic and crowding are the same
      reader) and the `/api` docs page once `/api/v1/tourism` exists. Sitemap entry
      stamped from the index artifact's own generated date.
- [ ] **OG/social cards for `/leaf` and `/tourism`.** House pattern is prerendered static
      cards, NOT `opengraph-image` routes — a dynamic image route costs a Serverless
      Function against the Hobby cap of 12 and that cap is what froze production for two
      days in August. Follow `src/lib/ogStatic.ts` + `scripts/generate_og_images.mjs`
      (runs in `prebuild`); add `ogPath`/`ogAlt` entries and reference them from each
      page's `generateMetadata`. The function-budget gate
      (`.github/workflows/function_budget.yml`) will catch a regression on the PR.
- [ ] **Decide whether town-page metadata gets a seasonal fall-color variant.** Not done
      deliberately: a peak window in the meta description goes stale in November and
      title/description churn across 17 pages during the ramp is a real risk. The on-page
      H2 plus the unique per-town data is doing the topical work for now. Owner or
      /leaf-build call.

**GSC health check, post-outage (run 2026-08-30, findings only):**
- [x] **No indexing or coverage damage from the 08-21 → 08-22 outage.** Sitemap processed,
      0 errors, 0 warnings, last downloaded by Google 08-26. `/` and
      `/weather/blowing-rock` both crawled 2026-08-30 with SUCCESSFUL page fetch; the
      latter passes Rich Results for Breadcrumbs and Datasets. Nothing stale, nothing
      de-indexed. robots.txt and canonicals correct.
- [x] **The 2026-07-28 "town pages undiscovered" finding is RESOLVED.** August impressions:
      foscoe 814, north-wilkesboro 404, spruce-pine 239, banner-elk 167, blowing-rock 156,
      beech-mountain 150, valle-crucis 141, plus seven more non-zero. They are found.
- [~] **Impressions dipped 08-22 → 08-25** (49–73/day vs 100–134 flanking) and recovered by
      08-26. NOT attributable to the outage: a same-depth dip happened pre-outage on
      08-16/17, and at this traffic volume day-to-day noise swamps the signal. Watch,
      do not act. Fall volume will make swings legible.
- [ ] **Re-check `/roads` indexing ~2026-09-13.** If the footer link has not pulled it into
      the index within two weeks, the next lever is a contextual link from `/` and the
      town pages, not more sitemap work. Nothing is wrong repo-side.
- Caveat on scope: the GSC MCP server exposes no site-wide coverage enumeration, so
  "no other errors" is not established — three URLs were inspected individually. That is
  a limit of what was looked at, not a finding about the site.

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
- [x] ~~**Observe 2026-07-04 live**~~ — MISSED (owner confirmed 2026-07-18: times not captured; postmortem
      post dropped). **Re-arm for 2027-07-04:** clock first-shell for Boone + Tweetsie from the owner's
      vantage; add as `observed` entries and publish "observed vs computed" July 5 — original data nobody
      else has.
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
- [x] **Owner GSC round — ✅ DONE 2026-07-07 (morning of):** merged, requested indexing for the planner slug,
      **submitted sitemap.xml to GSC for the first time** (it had never been submitted; robots.txt was the only
      discovery path), and started Validate Fix on the duplicate-canonical issue. Context: a GSC inspection that
      evening showed the planner URL "unknown to Google" pre-request while the fireworks report (which got the
      same treatment 07-02) was indexed with rich results PASS and 904 impressions / 36 clicks in 11 days —
      the franchise playbook works, the planner just needed the same push.
- [x] **Pre-games SEO/internal-linking pass — 2026-07-07 evening (PR pending).** (1) GMHG title/meta/h1/WebPage
      JSON-LD/REPORTS-card title now lead with query language: "…2026: Schedule, Parking & Day Planner" +
      description names parking-by-day and shuttle cash (fireworks query data shows event + logistics-modifier
      searches; OG card art keeps "Plan Your Days" as display copy). (2) Report cross-links: fireworks report
      (most-crawled page) → planner callout band; planner → fireworks + /resources/reports footer line.
      (3) Article mesh completed — every missing edge added contextually: 12-dollars → report-card + is-rays +
      10-day; report-card → 10-day; 10-day → 12-dollars; is-rays → 12-dollars (the 4 posts previously had
      partial linking, and "12 dollars" linked no siblings). (4) Main pages now link the articles (were
      orphaned outside the nav dropdown): homepage head-to-head band, /right-wrong-ray scoring footnote, and
      /methodology coverage section each carry "longer story" links. All links verified present in prerendered
      HTML; 172 vitest / lint / build green.
- [ ] **2027 reuse:** re-verify all logistics (lots/prices/hours drift), and give real numbers for the
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
- [x] **Freshness sentinel — ✅ MERGED 2026-07-26 (PR #144).** `scripts/check_freshness.py`
      + `.github/workflows/freshness_sentinel.yml` (16:30 UTC + manual dispatch, read-only, fails red):
      checks BOTH today's `data/predictions/` capture exists AND newest comparison ≤2 days old. 14 new
      pytest, verified in passing + simulated-failing states.
  - [x] **Extended to the traffic predict→grade loop — 2026-07-28 (PR pending).** Motivated by the
        2026-07-26/27 silent skip: the traffic model's daily predict→grade step never fired for two days
        (its "UTC hour == 12" gate never matched GitHub's hours-delayed cron; gate fixed in e5ed6322), and
        the weather-only sentinel stayed green through it. Added three read-only traffic checks to
        `check_freshness.py`: newest `data/traffic/forecast/` ≤1 day old, newest `data/traffic/comparisons/`
        ≤3 days old (slack absorbs one legit missing-forecast gap day), newest `data/traffic/actuals/` ≤1 day
        old. Real repo state passes; the incident state fails. 15 new pytest (546 total green); no workflow
        change (CLI contract unchanged).
- [x] **Vercel webhook coalescing (lesson):** back-to-back merges to main can leave the second merge
      undeployed — no build, no failure, just absent (#105 needed a manually created git-source deployment).
      Leave a beat between merges, or confirm a deployment exists per merge.
  - [ ] **Recurred TWICE 2026-07-26/27** (#144+#142 batch; then #148 after #147) — both times caught
        only by probing prod for the new build's content, both recovered by pushing another commit.
        "Leave a beat" is not a fix. **Durable fix needs one owner click:** create a Deploy Hook in
        Vercel (Project → Settings → Git → Deploy Hooks, branch main) and add its URL as GH secret
        `VERCEL_DEPLOY_HOOK`; then we add a tiny workflow that, a few minutes after each push to
        main, asks Vercel whether a deployment exists for that SHA and POSTs the hook if not —
        coalescing becomes self-healing. Until then: after any merge, verify prod actually serves
        the change before calling it live (probe for new content, not just 200s).
- [x] **Stale local `.vercel` cleaned (owner-delegated):** the main checkout still carried GitHub-Pages-era
      settings (python build → `docs/`); backed up, removed, re-linked fresh (project/org IDs only). The
      matching *dashboard* overrides remain an owner click (see Deployment notes in `CLAUDE.md`).

### ⚠️ DEPLOY OUTAGE 2026-08-21 → 08-22 — Vercel Hobby 12-function cap — ✅ RESOLVED
- [x] **✅ RESOLVED 2026-08-22.** PR #165 merged (`a0fa477f`); the triggered production deploy went
      **Ready**, reporting `lambdaRuntimeStats {"nodejs": 2}` — two Lambdas, down from 54. Verified on
      davessweater.com the same hour: all five v1 endpoints 200 through the new catch-all
      (`/api/v1/towns`, `/today`, `/forecast`, `/scores`, `/verdict`), an unknown endpoint 404s with
      `valid_endpoints`, and `/`, `/right-wrong-ray`, `/weather/blowing-rock`, `/widget` and
      `/feed/boone/forecast-1day.xml` all 200. **Freshness confirms the freeze is over:**
      `/api/v1/today` returns `generated_at 2026-08-22T06:48` for date `2026-08-22`, where production
      had been pinned to the 08-20 build for two days.
- [x] **Symptom.** Every production deploy from 2026-08-21 failed with
      `exceeded_serverless_functions_per_deployment` at the `patchBuild` step — three a day, one per
      bot commit. Production froze on the 2026-08-20 build and stayed up serving stale data. Same
      hiding place as August 6–16: the build reports success and only then is the deployment refused.
- [x] **✅ ROOT CAUSE: payload size, not route count.** Measured 2026-08-22 by reading the Vercel Next
      builder's own source (`@vercel/next/dist/index.js`): routes are merged into shared Lambdas only
      while a group fits `DEFAULT_MAX_UNCOMPRESSED_LAMBDA_SIZE` (**150 MiB**) minus
      `LAMBDA_RESERVED_UNCOMPRESSED_SIZE` (**25 MiB**) — a **125 MiB** budget. Summing each function's
      own `filePathMap`: **246 MiB per function, 224 MiB of it `data/`.** At 246 MiB *no two routes
      can ever share a Lambda*, so the emitted function count equals the route count and climbs as the
      route tree and the data grow. `data/` grows ~170 files a day; 08-20 it still merged enough to
      land ≤12, 08-21 it did not. **Nothing in the repo had to change for this to break, which is why
      a pure-data commit broke it.**
- [x] **Why `data/` was in the Lambdas at all.** `src/lib/towns.ts` builds paths with a dynamic
      `join()`, and the tracer answers a dynamic path by globbing the whole tree — the
      "matches 24452 files" build warnings. So all of `data/` rode in, **including the 192 MB of
      prediction screenshots**, which nothing reads at request time.
      ⚠️ **The 2026-08-16 entry called this a red herring and dropped it. That was the wrong call** —
      it measured the `outputFileTracingIncludes` list (8,283 → 8,242 entries) and concluded the
      include list was not the lever. True, but it never measured the *bytes*, and the bytes were the
      whole problem. The note's own last line — "the dynamic filesystem reads **are** the lever" —
      was right, and got filed under "dropped".
- [x] **✅ THE FIX (PR #165): exclude `data/**/*.png` from function tracing.** One entry in
      `next.config.ts`'s `outputFileTracingExcludes`. **Measured: payload 246 → ~59 MiB per function,
      function count 10 → 4, and a real `vercel deploy --prebuilt` of that output SUCCEEDS** (the
      same command on the 10-function build was refused, which is how we know the count, not the code,
      was the blocker). All **8,670** `data/**/*.json` files are still traced into every bundle, so no
      request-time read can miss. Safe because nothing reads a `data/` image at request time:
      `prepare_public.mjs` copies screenshots to `public/screenshots/` at build, and the one reader
      (`src/lib/screenshot.ts`, a `statSync` for file size) is reached only from the prerendered
      homepage.
- [x] **Also in PR #165, and worth keeping on its own merits, but NOT the fix:** the five
      `/api/v1/*` route files became one catch-all `/api/v1/[endpoint]`, handlers moved to
      `src/lib/api/v1/`. Every public URL unchanged; an unknown endpoint now returns a JSON 404 naming
      the real ones. Took the count 14 → 10 — **and the deploy still failed at 10**, which is what
      finally pointed at size instead of route count. `src/app/api/__tests__/v1Route.test.ts` covers
      the dispatch against real committed data.
- [x] **⚠️ TWO WRONG DIAGNOSES ARE RECORDED HERE ON PURPOSE.** First: "the builder stopped grouping
      the `/api/v1/*` handlers" — killed by building the last GREEN commit (`09eefc90`, deployed Ready
      08-20) and getting *the same 14 bundles*. Second: "cutting route files will fix it" — killed by
      cutting to 10 and being refused anyway. Both came from counting `.func` directories and never
      measuring what was inside them. **If this recurs, measure the payload first:**
      `python3 -c "import json,os;fpm=json.load(open('.vercel/output/functions/<route>.func/.vc-config.json'))['filePathMap'];print(sum(os.path.getsize(s) for s in fpm.values())/1048576)"`
- [x] **Guard updated.** `scripts/check_function_budget.py` now says in its docstring that count is a
      function of payload size, not just route count, and the model-vs-emitted test asserts
      `modeled >= emitted` (the model is a ceiling; the builder merges below it) instead of equality —
      under-counting is the only direction that can ship a refused deployment.
- [x] **Headroom is now real: 4 emitted, cap 12.** The static model still reads 10 because it counts
      route files and cannot see merging. That gap is expected and safe.

### ⚠️ DEPLOY OUTAGE 2026-08-06 → 08-16 — Vercel Hobby 12-function cap — ✅ RESOLVED
- [x] **RESOLVED 2026-08-16.** PR #163 merged; the triggered production deploy went **Ready**
      (12m build, verified via `vercel ls`) after ten days of every deploy erroring on the cap.
      Prod re-verified same morning: serving the new build (tracker shows the Aug 15 graded day,
      not the frozen Aug 13 build) and one static card per family returns 200 image/png
      (`/og/weather/beech-mountain.png`, `/og/right-wrong-ray/beech-mountain.png`,
      `/og/resources/articles.png`, `/og/report-card/2026-06.png`), with page metadata pointing
      at the static paths. Note: no `/og/right-wrong-ray/boone.png` exists by design — Boone's
      tracker is canonical at `/right-wrong-ray` with no slug twin. OVERALL IA's
      `IA-HANDOFF-2026-08-16-vercel-function-limit.md` is closed and deleted.
- [x] **Symptom.** Every production deployment failed with
      `exceeded_serverless_functions_per_deployment` ("No more than 12 Serverless Functions can be
      added to a Deployment on the Hobby plan"), so prod served stale content while the data pipeline
      stayed perfectly healthy — Actions green, committing `data/` daily, nothing red in CI. **It hid
      because the build SUCCEEDS** ("Build Completed", "Deploying outputs…") and only then fails at
      the **`patchBuild`** step. Rollback was never a mitigation — prod was already serving the last
      good build. Each daily `data/` commit re-triggered a failed deploy (3/day) plus an alert email.
- [x] **Share cards became static files (the fix).** The five `opengraph-image.tsx` routes under
      `weather/[slug]`, `right-wrong-ray/[slug]`, `resources/[category]`, `resources/[category]/[slug]`
      and `report-card/[month]` were deleted. `scripts/generate_og_images.mjs` (new `prebuild` step)
      esbuild-bundles `scripts/og/cards.tsx` and renders all 42 cards to `public/og/**.png` using the
      **same** `src/lib/ogCard.tsx` renderer and the **same** data loaders, so there is no second copy
      of the design to drift. `src/lib/ogStatic.ts` shares the URLs + alt text with the pages'
      `generateMetadata`. `public/og/` is gitignored like `public/screenshots/`. **18 → 9 emitted
      function bundles.** Cards come from committed data that changes at most once a day, so
      per-request rendering was always wasteful.
- [x] **Every `twitter-image.tsx` route deleted, site-wide (owner product decision, not just a cap
      workaround).** The owner shares only to LinkedIn, Instagram and Facebook — all of which read
      `og:image` — and X falls back to `og:image` when no twitter-specific image is declared, so
      nothing breaks for third parties posting links there. All 15 files were re-exports of their
      `opengraph-image` sibling, so no card was lost. `twitter.card`/title/description stay; Next
      mirrors the OG image into `twitter:image` on its own.
- [x] **⚠️ `generateStaticParams` does NOT reclaim a function.** Next emits one Lambda per route
      directory containing a dynamic segment, prerendered or not; `generateStaticParams`,
      `dynamicParams = false` and `dynamic = "force-static"` were each measured and none removes it.
      The only way to drop that function is to not have the route. (An earlier attempt took the
      `next build` route table from 19 `ƒ` to 9 `ƒ` this way and the deployment failed identically.)
- [x] **⚠️ `outputFileTracingIncludes` narrowing is a red herring here — measured, and dropped.**
      Narrowing the `/api/v1/*` + `/widget` entries from `./data/**/*.json` to the five paths those
      routes actually read moved the traced file list from **8,283 → 8,242 entries**: a 0.5% change.
      The tree is dragged in by the *automatic* tracer instead, because `towns.ts` builds paths with
      `readdir`/dynamic `join` (Turbopack warns "matches 17452 files" / "matches 21192 files"). So the
      include list is not the lever it looks like; **the dynamic filesystem reads are**. Left at the
      broad glob rather than shipping a narrow list that only *looks* safe and 500s the day a route
      reads a path nobody remembered to add.
- [ ] **STANDING BUDGET — Vercel Hobby, hard 12-Serverless-Function ceiling.**
      **Every new route directory with a dynamic segment costs a function** — API routes,
      `/widget`-style dynamic pages, and metadata image routes (easy to forget: they are not
      "pages"). Adding a new dynamic route *family* is what risks re-tripping the cap. Prefer one
      catch-all over N sibling routes, and prefer a build-time file over a route whenever the output
      is derived from committed data. **Emitted today: 4** (measured 2026-08-22, post-fix):
      `/api/geocode`, `/feed/[town]/[feed]`, `/keystatic/[[...params]]`, `/report-card/[month]` —
      everything else merged into those groups. The static model still reads **10** because it counts
      route files and cannot see merging; that gap is expected, and the model is the ceiling.
      ⚠️ **The number that moves is payload size, not route count.** Merging stops the moment a
      group exceeds ~125 MiB, and then every route becomes its own Lambda at once. Before deleting
      routes, measure what they are dragging in — see the 2026-08-21 outage below.
      **How to check:** `python3 scripts/check_function_budget.py` (one second, no build), or the
      ground truth — `npx vercel build` then
      `find .vercel/output/functions -name '*.func' -type d ! -name '*.rsc.func' ! -path '*.segments*' | wc -l`
      (same thing: `python3 scripts/check_function_budget.py --build-output .vercel/output`).
      Do **not** trust the `ƒ` column in the `next build` route table — it is not the function count.
      Treat the local number as an indicator and **a real deployment as the ground truth**: push the
      branch and read the preview's status before merging.
- [x] **CI guard — SHIPPED 2026-08-16.** `scripts/check_function_budget.py` counts the deployment's
      Serverless Functions two ways and fails at **>10** (two under the 12 cap, so a model that
      under-counts by one still trips the check before a deployment does). Its default mode is a
      static model of the `src/app` route tree — every route file under a dynamic segment costs a
      function (metadata image routes included, since they are routes and not pages), `/api/**` handlers
      share one bundle *unless* they opt out of prerendering (corrected 2026-08-22 — see the
      2026-08-21 outage below), a `force-dynamic` route costs one without a dynamic segment, and a
      plain prerendered page costs nothing; `--build-output` counts the real bundles a `vercel build`
      emitted, skipping the `.func` symlinks, `.rsc.func` halves and `.segments/` payloads that make
      the output directory look bigger than it is. Both read **9** today, and both moved to 10 in
      lockstep when a throwaway `[probe]` route was added, so the fast model is calibrated against
      the measurement rather than asserted. `tests/test_function_budget.py` gates the real tree in
      pytest and pins each counting rule against synthetic route trees;
      `.github/workflows/function_budget.yml` runs the static gate plus a full `vercel build` on
      every PR touching `src/app`, `next.config.ts`, `vercel.json` or the lockfile, and warns when
      the two counts drift apart. **The build job needs no secret** — measured: `vercel build` wants
      project settings, not credentials, so a placeholder `.vercel/project.json` written in the
      workflow is enough and nothing touches the Vercel API; if a future CLI release starts demanding
      auth the job posts a notice naming the owner step (add `VERCEL_TOKEN`) and steps aside rather
      than going confusingly red, with the static gate still biting.
- [ ] **Reclaim options if the budget is ever tight again:** `/keystatic` + `/api/keystatic` occupy 2
      of the 9 for an admin UI no public visitor loads; gating them out of production builds behind an
      env flag returns the count to 7. Not done here — it removes the hosted editor, which is an owner
      decision, not a cleanup.

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

## Done: Voice repositioning + data-democracy thesis (2026-07-07, PR pending)
Owner call: the site has moved from pure parody/hostility to "complex and subversive" — credible alternative
positioning for expansion to other domains. Ray's stays the named symbol of gated expertise (pointed at, never
bitter); the data is the knife, the copy stays gracious. New throughline in CLAUDE.md: "Every forecast is a
claim about tomorrow. We check them all — including ours," framed as **data democracy** (public data, found,
vetted, handed over free — weather, fireworks dusk math, the Games planner all being the same move).
- [x] Homepage "Why this exists" timeline reworked to six beats carrying the thesis: bill+credentials setup →
      "so somebody started checking" → gap chart → rain-total fact (depersonalized, "he won't even" cut) →
      NEW "The weather was never his" (data-democracy beat) → "So we publish the receipts" close that names
      fireworks + the Games (expansion posture; replaced the gloating "The old way is out" triplet).
      Timeline copy migrated to `src/content/copy.ts` so the owner can tune wording in the GitHub editor.
- [x] Softened: hero iPhone aside ("A better forecast may already be in your pocket"), footer ("We just check
      the math" replaces "not on speaking terms"), OG description (no longer names Ray's in share cards),
      /right-wrong-ray header (fixed the muddled "trust us…held to account" line; now "Same rubric for
      everybody"). KEPT deliberately: hero headline, BrandMark strikethrough, "most mostly reliable",
      the Right Ray / Wrong Ray name, timeline beats 1–3 (accountability register, not hostility).
- [x] AI-voice pass per the new universal styleguide (`shared-skills/writing-styleguide.md`): killed the
      "Better data is free. Good design is cheap. This site is the proof." triplet; colon pass on the two Ray
      articles (~11 and ~15 body-colon restructures; remaining validator counts are frontmatter/heading
      artifacts); fixed one negative-parallelism construction in the June report card.

## Done: Ownership thesis above the fold + /about (2026-07-08, PR pending)
Follow-on to the voice repositioning, owner-directed: land the message immediately, restore the sweater
joke's connective tissue, make service-not-business explicit. NOTE: the satire's political dimension stays
OUT of the public repo per the standing contributor rule — the copy targets the gated-expertise business
model only.
- [x] **Hero dek (above the fold):** "Scored daily, published free, because nobody owns the weather.
      A sweater, you can own." — the sweater clause links to /about. Lands data democracy +
      service-not-business + the name joke in one line. In `copy.ts` (hero.dekLead/dekLink).
- [x] **Sweater Index tagline:** "The forecast belongs to everybody. The sweater call is yours." —
      ownership made personal (the index answers the one forecast question that's about YOU). In `copy.ts`.
- [x] **/about page** — consolidates the thesis: A service, not a business (h1); the short version; the
      name (sweater earns its place; links the Realest Quarter-Zip as "the only thing around here with a
      price on it" — the shop closes the ownership joke); why it's free ($12/yr, public data); held to the
      same standard (our station joins the same rubric); beyond the weather (fireworks + Games as the same
      habit; invites reader suggestions). AboutPage + BreadcrumbList JSON-LD, canonical, sitemap entry,
      footer "What this is" link. Satire disclosure: "Satire, with receipts."
- [x] 172 vitest / lint / build green (31 routes); hero dek, tagline, and /about all verified in
      prerendered HTML.

## ⚠️ BLOCKED 2026-07-28: Anthropic monthly spend limit hit
The `fix/rays-day5-leadtime` agent died mid-run with "You've hit your monthly spend limit"
(claude.ai/settings/usage). **Its work was lost — nothing pushed, branch never created.** Further
background agents will fail the same way until David raises the limit or the month rolls. Items
below that say "dispatch" are queued behind that.

- [ ] **REDO: Ray's day-5 lead-time parse + rescore** (was in flight when the limit hit). Full
      diagnosis already done and recorded here so the redo does not re-derive it: Ray publishes 7
      days, `capture_rays.py` stores 7 rows, but **row index 5 is empty in 143 of 143 captures
      (100%)** while row 6 parses partially (precip_type + daytime_desc, no high/low). Confirmed
      parser bug, not a publishing gap. Consequence: `leadtime_scores.json` has raysweather n=1 at
      lead 5 vs 138-142 at leads 0-4, so the accuracy-decay chart drops his line at day 4 and the
      page prints "Ray's single day-5 row sits out until it accumulates" — **a false claim that
      flatters us on a page about fair grading.** Fix the parser, backfill from saved `raw_text`
      where it genuinely exists (never fabricate), rescore, and correct the caption to whatever is
      true after. If recovered data changes the "free wins at every horizon" story, the copy changes
      with it.

## PERFORMANCE — PageSpeed Insights, mobile (owner-run 2026-07-28: "need to fix these too")
Not yet triaged by DS IA; recorded verbatim from the owner's run so nothing is lost. Note the last
perf work (PR #87, hero LCP) is a year-old context and the site has grown a lot since.
- [ ] **Reduce unused JavaScript — est. 192 KiB** (flagged red). Likely suspects: visx bundles on
      the trend/decay charts, framer-motion in the scrollytelling timeline, Keystatic's editor
      route. Check whether the client islands can code-split or go server-rendered.
- [ ] **Avoid enormous network payloads — 3,423 KiB total.** The biggest single lever on this list.
- [ ] **Improve image delivery — est. 246 KiB.** `prepare_public.mjs` already resizes the hero
      iPhone shot; audit the rest (logos, report photos, GMHG field map).
- [ ] **Use efficient cache lifetimes — est. 167 KiB.**
- [ ] **Legacy JavaScript — est. 26 KiB** (transpile targets).
- [ ] **Forced reflow + network dependency tree** (both flagged red) and **8 long main-thread tasks**.
- [ ] Also open from the earlier audit: the **lantern-simulation LCP artifact** (PSI lab numbers use
      the same simulation that reported 11.8s while observed throttling reported 2.7s) — re-check
      whether these new findings are real or partly the same modeling artifact BEFORE optimizing
      against a number that may not reflect real users.

## NEXT BUILD: design/template consistency gate (IA brief, 2026-07-28)
Brief: `IA-BRIEF-2026-07-28-design-consistency-gate.md` (repo root, from OVERALL IA at David's
direction). Diagnosis: rapid feature bursts (PRs #129–#152 across three days) add pages, routes,
and widgets that never get fitted to the site's design/template, and nothing corrects the drift
until David notices by reading a page. **Fix the system, not the pages.**

**The principle: new work must FIT the template or CHANGE the template deliberately in the same
PR, with reasoning. Divergence-by-omission is the failure mode this kills.**

- [~] **GATE — David's manual correction pass must land first** (in progress 2026-07-27/28; the
      corrected state IS the seed of the standard, so codifying earlier would enshrine the
      patchwork). Correction pass so far: nav trim (Videos hidden, Reports→"Reports and Tools",
      Roads folded in), footer trim, homepage town toggle, 5-day detail cut, precip labels as
      words, R/M/W legend, reading cards, typographic quotes ×17, stat-caption capitalization,
      attribution backlink. STILL OPEN in the pass: forecaster logos on one line, drop the
      Open-Meteo hero card, remove the Apple Weather spot, article cadence decision.
  - [x] **Town selection now carries across pages — 2026-07-28 (branch `town-selection-persistence`).**
        Owner report: "The dropdown selector should carry across pages. If they change from one town
        to the next, then the next page with a town selector should match it." The header picker read
        the town from the URL only, so the nav's Today / Right-Wrong-Ray links were hardcoded to
        Boone's canonical URLs and the choice was lost on every cross-surface move. Fix: the chosen
        town is remembered in `localStorage` (`ds:town`) by `src/lib/townMemory.ts` — banked both on
        an explicit pick and on ARRIVING at any town page (deep link, internal link, back button),
        and cleared by "All towns", which deliberately means no single town. The two primary nav
        links (desktop row and mobile sheet) then point at that town's copy of each surface.
        Hydration-safe by construction: the memory is an external store whose server snapshot is
        null, so the prerendered HTML keeps Boone's crawlable `/` and `/right-wrong-ray` and the
        swap happens after mount. Unit-tested (`townMemory.test.ts`, `townPicker.test.ts`) and
        walked in a browser end to end.
  - [x] **Town pages mirror the canonical Boone page — 2026-07-28 (same branch).** Owner report:
        "the pills on the towns are still in the hero, these new town pages are supposed to mirror
        the canon Boone page." The homepage's in-hero town band moved into the header on 2026-07-28,
        but both town templates still rendered the old "Switch town" pills. Removed from
        `weather/[slug]` and `right-wrong-ray/[slug]`, and `TownSwitcher.tsx` deleted — it had no
        consumers left. The town control now exists exactly once site-wide, in the header. No
        crawlable links lost: `TownPicker` ships its full town list in every page's HTML (hidden
        attribute, not conditional rendering), verified in the built output.
- [x] **Separator standard re-swept, and made enforceable — 2026-07-28 (branch
      `separator-standard-lint`).** The 2026-07-02 brand standard (data-line separators are pipes,
      swept site-wide; see the Right/Wrong Ray v2 entry above) had drifted back a **second** time.
      Found during the widget's cross-origin verification: the embeddable card rendered "TODAY |
      JUL 28" two lines above "Sunrise 6:24 AM · Sunset 8:41 PM · Waxing gibbous, 99% lit" — one
      card contradicting itself inside one box. **8 sites converted** across 5 files: `/widget`
      (almanac join, the day-row wind suffix, and both consensus-line suffixes — 4), `ScoreBreakdown`
      (2), `OtherSourcesBoard` (2 — note this component is now orphaned, no importer since the "rest
      of the field" retirement), `GmhgBanner` (1), and the GMHG planner's parking table (1).
      **2 exemptions, both deliberate:** a middot **opening an `<li>`** is a hand-rolled bullet glyph,
      not a separator (the fireworks report's venue logistics and observed-record lists, 16 items —
      nothing sits to its left), and **next/og share cards** (`opengraph-image.tsx` /
      `twitter-image.tsx`) are satori-rasterized poster art running their own display typography.
      **The durable half is the lint:** `scripts/copy_lint.py` grew a `SEPARATOR` rule (error) that
      catches the literal `·` and every entity spelling, reading SOURCE rather than extracted
      snippets — because the drift that started this was `almanac.join(" · ")`, and a bare " · " is
      too short to survive `_looks_like_copy`. It was invisible to extraction exactly where it did
      the most damage. The `<li>`-opening exemption is anchored to `<li>` specifically, not to
      "leading glyph", so `ScoreBreakdown`'s `<span>· not published</span>` — which also led its
      element and WAS drift — still fails. 8 new tests; pytest blocks on it. Documented in the
      script docstring, `CLAUDE.md`, and `guidelines/seo/DS_WRITING_QUALITY.md`. The 07-02 sweep
      cannot silently drift a third time.
- [ ] **Layer 1 — `docs/DESIGN-STANDARD.md`.** Walk the corrected site and codify: the page shell
      (layout/partials every page extends); navigation/discovery registration rules (a new route
      must register in nav/hubs/indexes — /weather hub, report-card franchise — so pages can't
      become orphans); typography, spacing, color as NAMED TOKENS with a rule against hardcoded
      one-offs; component patterns (cards, tables, charts/scoreboards, callouts) each pointing at
      its canonical implementation so new pages reuse rather than re-invent; responsiveness +
      asset conventions; and a **page-inventory table** (every route → template → conformance
      status) that doubles as the sweep scoreboard.
- [ ] **Layer 2 — `/design-check` skill** in `.claude/skills/`, run against a PR's changed
      pages/components BEFORE merge. Mechanical where possible (extends the shell? registered in
      nav? tokens not hardcoded? reuses canonical components?), judged against DESIGN-STANDARD.md
      otherwise; returns pass or a concrete fix-list. **Wire it so it actually runs:** a CLAUDE.md
      rule giving it the same standing as tests in the definition of done, the rule mirrored here,
      and a PR-template checkbox if one exists. When a feature legitimately needs a NEW pattern,
      the PR updates DESIGN-STANDARD.md in the same change — that is the "change deliberately"
      branch, not an exemption.
- [ ] **Layer 3 — periodic conformance sweep** after each feature burst (or weekly; DS IA's call
      given the daily workflow cadence): sweep the full inventory, update the scoreboard, file
      nonconformances as checklist fixes. Same predict→grade discipline the weather layer runs on
      — design conformance gets a graded track record.
- [ ] **First sweep baselines the scoreboard**; residue the manual pass missed becomes fix-list #1.

RELATED, already in flight and complementary (copy, not layout): the blocking **copy-lint**
(`scripts/copy_lint.py` + pytest, branch `feat/copy-lint`) enforces the writing styleguide
mechanically — colons, em-dashes, straight quotes in JSX, label/table capitalization, and
JSX adjacent-tag missing spaces. Same philosophy one layer down; DESIGN-STANDARD should reference
it rather than duplicate its rules. **Promotion status (2026-07-28):** the copy-lint was filed to
`~/Projects/shared-skills/INBOX.md` as a cross-project promotion proposal and OVERALL IA is
surfacing it to David. **DS does not build the shared version from this side** — keep consuming the
local `scripts/copy_lint.py` until a shared copy actually exists, then switch to the reference
pattern (never a fork). Also in flight: `feat/type-scale` (one named heading scale
applied site-wide), which is effectively the first piece of Layer 1 and should be folded into the
standard when it lands.

## To do — site (pre-station, outstanding)

- [ ] **Scoring recalibration — the big one (owner-flagged 2026-07-02).** Clustered 90s = weak
      differentiation, and on trace days (0.071") a "none" forecast incoherently earned 10/10 amount after
      0/10 type. Owner wants balance and explicitly NO double-penalty on trace misses. Model on FULL history
  - [x] **Trace incoherence half — ✅ FIXED 2026-07-18 (uncommitted).** Root cause: type boundary (0.005"
        rain) vs amount tolerance (0.1") disagree 20×, so any 0.005–0.1" day graded the same forecast 0/10
        type + 10/10 amount (147 historical rows, both directions — incl. googleweather's 0"-QPF rain-category
        days). Fix: none-vs-precip type miss inside the amount tolerances earns 6/10 (`TYPE_TRACE_CREDIT`,
        `scoring.py:_type_points` + `_is_trace`); precip-without-a-total still gets 0 (no gain by omission —
        Ray's wet days unchanged). Modeled on full history BEFORE implementing: source-blind, all 10 sources
        lifted +0.56..+1.26 (Ray +0.56/12 days, Open-Meteo +1.08/89 — NOT tuned against Ray; gap widens 0.5
        only because Ray makes fewer trace-day "none" calls). No double-penalty: a trace miss now costs 4 pts
        total. 5 new pytest cases; 200 py tests green; history rescored (`rescore_history.py`, 100 files;
        consistency test green); `/methodology` + `CLAUDE.md` updated. New avgs: Open-Meteo 92.80, Ray 72.28.
  - [x] **Remaining (the actual recalibration) — ✅ SHIPPED + LIVE 2026-07-26 (PR #146).** Owner chose the
        GENTLER register: `TEMP_TOL=1.0`, slope held at 3.0, + merged 20-pt `precip` field
        (`scoring.py:_precip_20`; dry day = amount-vs-zero over 20, wet day = 10 identification + 10
        amount, wrong-form cap 5, omission-forfeit + trace-band preserved). Full history + all 17 towns +
        leadtime rescored; breakdown/coverage key collapsed to `precip`; /methodology + CLAUDE.md updated.
        Implementation matched the memo's runner-up column exactly (all 11 sources, temp lever); fairness
        re-verified on the shipped build (0 wins-by-omission; Ray ON the pack's error-drop line, r=0.895).
        New standings live on prod (from rescored scores.json): Ray 68.8 (was 73.2; Wrong days 31/140 =
        22.1%, matching the runner-up's predicted ~22%), Open-Meteo 89.8, DSI 95.2 (31-0-0); rank order
        preserved.
        392 py + 256 vitest green. Modeling background: full-history
        analysis memo: `planning/analysis/2026-07-26-recalibration-modeling.md` (local-only). Findings: the
        clustering is a TEMP-saturation artifact (60/100 pts, ~60% of good-source days maxed at the 2°F
        window); merged 20-pt precip is nearly inert here (+0.0..+0.6 — a coherence change, not a
        differentiator). RECOMMENDED: `TEMP_TOL=1.0, TEMP_SLOPE=4.0` + the merged precip field (runner-up
        slope 3.0). Both fairness gates PASS (0 wins-by-omission; Ray's −9.4 sits ON the pack's
        error-vs-drop regression line, r=0.905 — earned, not aimed). Deltas: Open-Meteo 92.8→86.9,
        Ray 73.2→63.7, DSI 97.3→94.1; rank order preserved. ⚠️ OWNER CALL (voice, not math): the
        recommendation puts Ray at ~40% "Wrong" days vs 22% under the runner-up — pick the register
        before anything ships. Then: implement per the memo's sketch, rescore, update /methodology +
        CLAUDE.md. Original discipline note (unchanged below):
      before touching the scorer: trace-day partial type credit / type-gated amount cap / merged 20-pt
      precipitation score / tighter-steeper temp bands; show per-source deltas + the wins-by-omission
      fairness check (as the R2 revert did); update `/methodology` + `CLAUDE.md`; rescore via
      `scripts/rescore_history.py`. Never ship a scoring change without proving it wasn't tuned against Ray.
- [x] **DSI now scored + tracked on the board — ✅ DONE 2026-07-15.** The composite is graded daily as its
      own source (`compare.add_composite_source` / `build_composite`), scored on the FULL 100-pt contract
      (wind + precip amount aggregated too, not just the display high/low/precip), backfilled across history
      (`scripts/backfill_composite.py`), and shown on `/right-wrong-ray` as **"Dave's Sweater Index"** ranked by
      merit alongside everyone else. Mirrors `src/lib/composite.ts` (same members / ≥2 guard / majority vote);
      keep the two in sync. Tests: `tests/test_composite.py`. **Current standing: 94.8 avg over 21 days,
      21-0-0 (never graded Wrong) — 3rd overall, ~tied with MET, and ~2.4 pts above Open-Meteo (our old
      "pick").** Note the earlier 8-day pilot read 84.2 because it forfeited wind/amount and used a smaller
      sample; scoring on the full contract + error-cancellation on temp is what lifts it. The DSI only forms
      once ≥2 independent members exist, so history starts ~2026-06-23.
- [x] **Score the DSI per lead time — ✅ DONE 2026-07-15.** `leadtime.score_composite_lead` builds the DSI at
      every lead 0-5 from the members' day-ahead files (via `compare.build_composite`, so lead 0 == the daily
      DSI), backfilled into `leadtime_scores.json`. Featured as the bold white hero line on the accuracy-decay
      chart. `compositeMemberMae`/`Pair` exclude the `composite` row (not a member of itself). The DSI is the
      flattest line on the board — 94-97 across all five days.
- [x] **DSI precip-aggregation fix (adaptive step 1) — ✅ DONE 2026-07-15.** Replaced the lossy majority-vote
      precip rule with the **credible-minority rule**: if ≥ a quarter of members (floor 2) forecast precip, the
      DSI forecasts precip; rain/snow by majority among callers; any split reads mixed. Stateless (no weighting,
      no history), disclosed on `/methodology`. Measured +1.9 pts on the record → **DSI is now #1 at 96.7, 21-0-0.**
      Kept in sync across `compare.py:_composite_precip_type` and `composite.ts:compositePrecipType` (change both).
- [x] **REEVALUATE DSI ~2026-08-15 — ✅ RAN 2026-08-16** (issue #128; full memo:
      `planning/analysis/2026-08-16-dsi-reevaluation.md`, local-only). Standing: **DSI #1 at 95.61,
      53-0-0** over 53 days on the rescored record — and *better* on fresh data (95.11 first 22 days,
      95.96 the 31 since). Caveat for site copy: the lead over MET.no (94.36) is NOT statistically
      separated (t≈1.3–1.4; 25 wins / 25 losses) — the defensible public claim is **most consistent**
      (worst day 86.3; 48/53 days ≥90), not "most accurate." **Credible-minority precip rule HELD
      out-of-sample**: +0.97 pts on the 31 post-adoption days (t=+2.40), 6 better / 0 worse / 1 tie —
      keep as shipped. Untested face: zero snow days in the record, so the wrong-form-on-snow cost has
      never been exercised. **Next scheduled re-eval: after the first month with measurable snow**,
      specifically re-testing that face.
- [x] **DSI temperature bias correction — ❌ CLOSED 2026-08-16, measured and rejected** (not deferred).
      The premise is falsified on the fuller sample: the pooled warm-high bias decayed +1.12°F →
      +0.50°F, and what remains is ONE member (WeatherAPI, +3.5 to +4.7°F warm in every window), not a
      shared bias averaging can't remove. The specified causal walk-forward lever measures **−0.05 pts
      out-of-sample** (t=−0.17); across 12 configs the spread (−0.19..+0.27) exceeds any gain — noise.
      Also kept dead on auditability grounds: it's the one genuinely *learned* component, and a learned
      self-improvement is the version of DSI tuning a critic can legitimately call rigged. Reopen only
      on evidence of a *shared* seasonal bias ≥1.5°F persisting a month (winter cold regime is the
      plausible candidate), not on the calendar.
- [ ] **DSI membership optimization — retargeted to ~2026-09-15** (ideally into the first cold regime).
      2026-08-16 findings: **per-horizon weighting is DEAD** — fitted per-lead member sets beat one
      global set at ZERO of six leads (tie d0-d1, worse d2-d5; far-horizon rank stability ρ=0.66, and
      Visual Crossing fell from far-lead leader to 3rd everywhere). The live candidate is a
      **horizon-independent trim** (drop OWM/NWS/WeatherAPI): +0.07..+1.25 out-of-sample at every lead
      (mean ≈+0.55), consistent in sign but significant at only one lead — too thin on a summer-only
      sample. ⚠️ **OWNER VOICE CALL, not math:** the trim drops the taxpayer-funded NWS from a
      data-democracy site; the middle path is dropping WeatherAPI alone (the one broken member,
      +0.16..+0.28 by itself, easy to disclose on /methodology). Decide the register before anything
      ships.
- [ ] **Ray's real price for the "Paid" chip** on `/right-wrong-ray` — owner to supply the figure.
- [ ] **M5 multi-location "multiplication" — spec written 2026-07-18, pending owner review:**
      `planning/specs/2026-07-18-multi-location-multiplication-design.md`. Decisions taken in spec:
      real per-town URLs (`/weather/{slug}`) with a switcher-as-router (NO client-state toggle — SEO is
      half the point); Boone keeps `/` (no `/weather/boone` twin — dup-canonical lesson); per-town
      Right/Wrong boards at `/right-wrong-ray/{slug}` on the identical rubric, gated by the existing
      `MIN_SCORED_DAYS` pattern, **never blended into one average**; Boone data layout untouched, new
      towns under `data/locations/{slug}/`. **Town list DECIDED (owner, 2026-07-18): Watauga first by
      traffic/population, then expand beyond.** Ahrefs volumes pulled same day (in spec §3; 460 units,
      KD 0–1 everywhere): Boone ~9.3k/mo, Blowing Rock ~3k, Banner Elk ~2.3k, Beech ~2k, everything
      else ≤206, **Valle Crucis ~4 (demoted from P0 — data falsified the foot-traffic assumption)**.
      Plan: P0 = Blowing Rock + Deep Gap (silent capture; Deep Gap = subtitle/brand slot), P1 = pages
      at ≥9 scored days + Banner Elk + Beech Mtn (the real demand), P2 = publish the two embargoed
      posts + long-tail batch. **Ray's per-town capture DECIDED (owner, 2026-07-18): once daily** via
      his public blurbs endpoint. All §7 decisions closed same day (owner: yes ×3 — P0 towns, /weather
      naming, quota fallback OK).
  - [x] **P0 BUILT + LIVE 2026-07-18 (same session).** Registry `data/locations/locations.json`
        (geocode-verified pins w/ provenance; Boone deliberately absent — legacy paths canonical);
        `scripts/locations.py` + `capture_locations.py` (Open-Meteo + all 7 adapters at each town's
        coords — adapters already took lat/lon) + `compare_locations.py` (identical rubric via
        compare._to_contract + scoring.score_prediction, location-scoped bucket-low recovery, DSI
        composite, no-ghosts rule, per-town scores.json, self-healing 14-day sweep). Both workflows
        gained non-gating steps (capture commit now adds `data/locations/`). 6 new pytest (218 green).
        Live-verified: real captures for both towns; first-day data already differs (Blowing Rock
        trace-rain + 14.8 mph vs Boone dry 12.5). **First scored days land when the archive posts
        (~1-5 day lag); the 9-day P1 gate starts counting from the first scored day.**
  - [x] **P0.5 — Ray's per-town numbers — ✅ BUILT + LIVE-VERIFIED 2026-07-18.** Station IDs
        discovered from public `weather.station.list`: Blowing Rock = **2** (downtown, ~350 m from
        our pin), Deep Gap = **57** (~750 m); Boone = 1; future: Banner Elk 13, Beech 12, Valle
        Crucis 5, Foscoe 74, Vilas 99. `capture_rays_locations.py`: ONE unauth blurbs call/day
        (owner-approved) → per-town 7-day high/low + Ray's own `golfballs` confidence (stored,
        unscored) → raysweather_forecast.json per town, `fields_provided: ["high","low"]` (numbers
        only — wind/precip live in his regional narrative, so they're honest forfeits; possible
        later upgrade: icon-filename → precip type, needs a vetted icon vocabulary). Workflow step
        added (non-gating). Live run captured 7 days for both towns; 2 new pytest.
  - [x] **Capture phases collapsed — ALL 11 towns live 2026-07-19 (owner: "Add the towns").**
        Registry now: Blowing Rock, Deep Gap, Banner Elk, Beech Mtn (Avery mountaintop pin, 5,436 ft
        — the Watauga CDP fragment rejected), Seven Devils, Valle Crucis, Vilas, Foscoe,
        West Jefferson, Sugar Grove, Todd. All geocode-verified w/ provenance; Ray station IDs
        mapped for 9 (Seven Devils + Sugar Grove have NO station in their community — Ray renders
        honestly absent; never borrow a neighbor's). Live-verified: 33 keyless captures + 9 Ray
        town captures OK; day-one spread Beech 68.4° vs West Jefferson 81.3° high. Quota ceiling
        documented: Tomorrow.io 25 req/hr binds at ~24 towns. **Full-66 Ray mirror REJECTED with
        reasons — spec §9** (station sites ≠ towns; High Country identity; teardown-post
        credibility; thin-content risk on a cold-start domain; git-pipeline strain at 600
        files/day).
  - [x] **P1 pages — ✅ MERGED + LIVE 2026-07-26 (PR #145; /weather + town page + June-redirect all
        verified 200/308 on prod).** `/weather`
        hub + `/weather/{slug}` + `/right-wrong-ray/{slug}` + server-rendered TownSwitcher (real links,
        no client toggle; Boone routes to legacy `/` URLs, no boone twin). Below MIN_SCORED_DAYS(9) a
        town renders provisional ("Tracking since {date} | N of 9 days"), crosses automatically — no
        per-town code. Shared board internals extracted to `lib/board.ts` + `ScoredDayCard` (Boone board
        untouched). Full metadata/canonical/OG/JSON-LD/sitemap; /methodology "Locations" section;
        homepage "Also tracking" strip. 256 vitest/lint/build green; 390px verified. First gate
        crossings ~07-28 (Blowing Rock + Deep Gap at 7 days). ON MERGE: publish the two staged
        launch posts per the content map (announcement day-of, teardown +1-2 days; owner reviews first).
  - [x] **Five-county major-towns expansion — ✅ 2026-07-19 (owner: "cover the major towns in
        Watauga, Ashe, Mitchell, Wilkes, and Yancey").** Registry now **17 towns** (+Boone = 18
        places): adds Jefferson, Spruce Pine, Bakersville, North Wilkesboro, Wilkesboro (NO Ray
        station — N. Wilkesboro is a different municipality, no borrowing), Burnsville (Ray's own
        named Hawk Branch station, 8.3 km, noted). All geocode-verified; volumes pulled (Burnsville
        ~1.3k/mo, Wilkesboro ~1.3k, Spruce Pine ~960 — county seats beat the Watauga long tail);
        elevation span now 1,001→5,436 ft. Live captures verified for all six + Ray rows for five.
        Test sanity box widened to the five-county footprint. **Tomorrow.io quota now 18/25 per
        hour — the NEXT town batch must space or subset that source.**
  - [x] **Watch 2026-07-19/20 crons — CLOSED 2026-07-27 by incident.** The watch was warranted:
        **five-day silent partial-sweep found + fixed 2026-07-27** (owner spotted Ray-only Banner Elk
        card). Root cause: `fetch_json` sys.exit(1)'d on failure → SystemExit escaped
        capture_locations' per-source `except Exception` → one SSL handshake timeout killed all 33
        town captures; continue-on-error kept the workflow green. 07-21..26: most towns scored
        Ray-only (his 7-day capture coasts gaps); only 07-19/20/22 got all 10 sources. FIXED
        (commit 636de3a0): fetch_json retries ×3 then RAISES; capture_locations `--fill-missing`
        recovery mode + loud exit-1 summary; daily_capture uses --fill-missing (idempotent);
        **freshness sentinel now checks every town's daily capture** (strict, names missing towns).
        Recovered 07-27 keyless captures for all 17 towns (keyed sources for 07-27 + the 07-21..26
        days are honest gaps — point-in-time forecasts can't be recaptured; deliberately did NOT
        re-run the capture workflow to avoid overwriting Boone's morning captures). DSI town accrual
        resumes 07-28. +8 tests (399 py green).
  - [x] **Board nicety — ✅ MERGED 2026-07-27 (PR #148).** Day's-best/worst chips suppressed on
        <2-source days (both Boone + town boards); ALSO caught + fixed both boards' scoring
        footnotes still describing the retired five-field precip split (missed by #146's consumer
        sweep — the town board shipped in a parallel branch). Verified in dev on the Ray-only
        Banner Elk day.
  - [x] **Town discoverability — ✅ MERGED 2026-07-27 (PR #147, owner-directed).** "Towns" nav
        dropdown (registry-fed two-column panel, Resources disclosure pattern, Boone-first) +
        `TownWayfinder` one-liner directly under the homepage hero ("Not in Boone?" → /weather
        hub); lower AlsoTracking list retained as the single full-weight list. 257 vitest/lint/
        build green; 390px verified.
  - [x] **Ray's town precip credit — ✅ MERGED 2026-07-27 (PR #149). We were UNDER-crediting him.**
        Owner challenged the draft's "town feeds" claim ("I don't want to seem brutally biased") →
        verification at source found our own capture was DROPPING the per-day sky icon his town
        pages publish, so Ray forfeited the whole 20-pt precip field in every town every day.
        VERIFIED AT SOURCE (raysweather.com public tRPC `weather.station.blurbs`): icons are
        genuinely per-town (North Wilkesboro `Ovc_Thunderstorms` vs mountain towns
        `Sct_ThunderShowers`, same day); the endpoint also serves PAST dates as-issued (his own
        Archives), so a fair historical backfill was possible. Fix: vetted icon→type vocabulary
        (`01_Dry`→none, `02_Rain`/`03_Lightning`→rain, `04_Snow`→snow, unknown→honest forfeit,
        logged), capture stores raw icons + derived type, one-shot backfill patched the whole
        capture era, all towns rescored. **Ray 53.1 → 63.1 mean (every town rose, none fell);
        every other source moved 0.0 and Boone untouched** (verified independently by DS IA, not
        just reported). Wind stays an honest forfeit — VERIFIED his wind line is one identical
        regional string ("NW wind 5-15 mph" on Boone AND Banner Elk today, 1,001-5,436 ft).
        424 py + 257 vitest green. **Lesson: when a rival's number looks bad, audit our capture
        before publishing the number.** The announcement draft now tells on us for this in
        its own section — the strongest available answer to the bias worry.

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
- [x] Update `README.md` — ✅ REWRITTEN + MERGED 2026-07-26 (PR #144).
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

## Content editor (Keystatic CMS) — ✅ BUILT 2026-07-19, owner setup pending for live editing
Owner asked to replicate Pigasus's "Keytastic" (= Keystatic, the Git-based CMS in
`pigasus-group/keystatic.config.ts`). Ported the four-piece pattern: `keystatic.config.ts` (Posts
collection, local storage in dev / GitHub storage `davidhluther/davessweater` in prod),
`src/app/keystatic/` + `src/app/api/keystatic/` (editor UI + API route with the same try/catch 503
degrade so a pre-setup build never breaks), `src/components/ChromeGate.tsx` (hides site header/footer
on /keystatic). Deps added: `@keystatic/core`, `@keystatic/next`, `@markdoc/markdoc`.
- [x] **Reader coexistence (the safe part):** CMS writes `.mdoc`; `getNativePosts` (data.ts) now reads
      `.md` + `.mdoc` with slug-from-filename fallback; `nativePostRedirects` (next.config) globs both.
      Round-trip verified programmatically (a Keystatic-shaped `.mdoc` renders through `marked` with
      bold/link/list/FAQ/TOC all correct) AND the 4 existing `.md` posts still load untouched. Editor
      live-verified in dev (browser): collection loads, create form renders every field with the house
      help text, Articles/News categories, title→slug autofill. Build 41/41, 214 vitest, lint green.
      robots.txt disallows /keystatic + /api/keystatic; `.keystatic/` gitignored;
      `outputFileTracingIncludes` ships content to Lambdas (the Pigasus prod-empty-reader bug, pre-empted).
- [ ] **OWNER — one-time GitHub App for live editing** (`docs/cms.md` has the steps): visit
      davessweater.com/keystatic → wizard → create `davessweater-keystatic` app → add 4 env vars in
      Vercel (Production+Preview) → redeploy. Until then, local `/keystatic` works fully; the deployed
      editor shows the setup screen and the public site is unaffected.
- [ ] **Optional follow-up:** migrate the 4 original `.md` posts into the CMS (convert to `.mdoc`,
      drop the explicit `slug:` key). Deferred deliberately — it touches redirect/sitemap coupling, so
      it's a reviewed change, not a side effect. They render + hand-edit fine as-is meanwhile.

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
- [x] ~~**Post #5 — fireworks postmortem**~~ — **DROPPED 2026-07-18 (owner):** the observed July 4
      first-shell times were never captured ("I don't have them. Ignore."). Draft stays staged in
      `planning/seo/` in case 2027 revives the concept (the observe-live checklist item below repeats
      annually).
- [~] **Guideline stack (spec §7) — ✅ MERGED 2026-07-26 (PR #144); owner review of all three docs pending.**
      `DS_CONTENT_STRUCTURE.md` (answer-first/franchise patterns from the real fireworks/GMHG pages) +
      `DS_WRITING_QUALITY.md` (layered on the universal styleguide, never loosens it) written;
      `DS_VOICE.md` stub note reconciled. Owner review of all three still pending.
- [x] **Multi-location launch content — ✅ PUBLISHED 2026-08-16 (owner: "launch"; commit 12170d2d).**
      Both pieces live as native posts, re-dated 2026-08-16 with the stale late-July time anchors
      minimally updated ("As of this week" → "Since late July"; "in about a month" → "a few more
      weeks of grading"; no facts changed): **17-high-country-towns** (news) and
      **rays-66-locations-3-forecasts** (articles — its July 7 pull date is stated in-text and
      stands). Pre-publish checks: copy_lint 0 errors; validator's only errors were Corpay-brand
      structure rules (upsell/Contentful/takeaways — inapplicable to DS); 333 vitest green; town
      facts re-verified (18 tracked = Boone + 17; gate 9 days; Ray absent in Seven Devils /
      Sugar Grove / Wilkesboro). Owner: request GSC indexing for both URLs.
      Data-gated follow-ups still mapped: flagship per-town accuracy piece (~Sept 1, needs ~30
      scored days/town; the elevation question is its spine — the towns now have the sample),
      report card gains a wider-field paragraph. ⚠️ "Keytastic" mention likely = Keystatic (the
      CMS already in this repo) — the one-time GitHub App owner step above is still open.
- [x] **Report Card franchise route — ✅ MERGED + LIVE 2026-07-26 (PR #143; June URL 308s to
      /report-card/2026-06 on prod, verified).** `/report-card`
      hub + `/report-card/{yyyy-mm}` (SSG); cards are native posts flagged `category: report-card` +
      `reportMonth: YYYY-MM` — a new .md lands automatically, no per-month code (July card auto-lands
      Aug 1). Direct single-hop 308s from BOTH `/blog/{slug}` and `/resources/articles/{slug}`; June card
      re-homed (sitemap/canonicals/5 internal links repointed). Shared `PostBody` extracted — one prose
      render path. 237 vitest/lint/build green; redirects verified on `next start`; 390px verified.
- [ ] **STANDING MONTHLY: publish the report card for each completed month** (owner directive 2026-07-08).
      July 2026 card due ~Aug 1; same corpay-method pipeline as the June card (brief → draft → adversarial
      fact-check vs scores.json → style validate). **Owner 2026-07-25: July card is pre-authorized —
      draft AND publish as soon as Aug 1** (no separate review gate for this one). **Report-card titles are Title Case** ("Ray's Weather
      Report Card: July 2026") — as are ALL blog-post titles now (the four live posts were retitled
      2026-07-08; H2/H3 stay sentence case).
- [ ] **ARTICLE CADENCE — owner directive 2026-07-28: "do it honestly in the cadence."** Owner asked
      why there are only ~4 articles and wanted more "backdated/published over time"; DS IA flagged that
      backdating would put false dates into BlogPosting schema, the sitemap, and RSS on a site whose whole
      premise is verifiable receipts. **Owner chose the honest path: publish a real cadence going forward,
      dated truthfully.** Also asked, fairly: "not sure why these weren't publishing like that anyway" —
      the answer is that no recurring publishing rhythm was ever set up; wave 1 (4 posts, 2026-07-06) was
      a one-off and the only standing commitment since has been the monthly report card. TO BUILD: a
      standing publish rhythm (owner to set the interval — weekly reads right for a cold-start domain),
      a queued topic slate drawn from the existing keyword map (`planning/seo/multi-location-content-map.md`
      + the accuracy cluster in the SEO program spec), and each post through the corpay-method pipeline
      (brief → draft → adversarial fact-check vs scores.json → copy-lint + style validate → owner review).
      Two drafts are ALREADY staged and unpublished: `17-high-country-towns` (announcement) and
      `rays-66-locations-3-forecasts` (teardown) — those are the front of the queue.
- [x] **Post detail date format — ✅ MERGED 2026-07-26 (PR #144).** THREE raw-ISO renders
      found (detail page + category listing + videos listing), all now `fmtLongDate()`; verified in built HTML.

## Disavow submission + GA4 verification (2026-07-20, routed from PG IA 2 per David)
Brief: `DISAVOW-GA4-HANDOFF.md`. Both tasks are DS-owned follow-ups.
- [x] **GA4 live measurement ID CONFIRMED — no change needed.** Live davessweater.com sends to exactly
      **`G-7XL0TZ4GSS`** (the March ID) — verified three ways: hardcoded in `AnalyticsScripts.tsx:36,41`,
      and live in production (gtag loader src + `gtag('config', …)` + `window.dataLayer`, `gtag` present so
      it IS receiving data). **`G-F3TW73EZK1` (June) is RETIRED** — appears nowhere in code or live source.
      The mistaken Corpay-account property (543003059, "receives no data") therefore is NOT the live tag
      (the live tag fires + collects). ✅ **CLOSED 2026-07-25 — owner corrected the GA4 admin situation**
      (stream ownership confirmed / mis-added Corpay property handled). Context: marketing-baseline-log.md
      Q6 (pigasus-group).
- [ ] **Disavow — 🔄 REFRESHED 2026-08-20, awaiting David's upload (443 domains).**
      Monthly re-audit ran against Ahrefs (all_time, subdomains, both protocols): profile grew
      **308 → 444** referring domains. **135 new spam RDs appended** to
      `planning/seo/davessweater-disavow.txt` (now **443** unique `domain:` lines) under a dated
      2026-08-20 cluster; header counts + `planning/seo/davessweater-disavow-notes.md` updated.
      **Two changes worth knowing:**
      (a) **First genuine link in the profile — `pigasus.group`** (`/services/intelligence`,
      in-content, anchor "a High Country index I built"). **KEPT, not disavowed**; the "100% spam"
      framing no longer holds and every future refresh must check for real links before appending.
      (b) **The net now passes dofollow** from 8 ordinary-looking `.com`/`.shop` shells
      (archive-hu, bisprofit, blogerreviewers, brinto, dupurgeniefr, quotesblom, sahammurah,
      wecelebrities) — all carrying one identical "High Quality Dofollow Backlinks DA 50 PA 40
      Premium PBN…" anchor. So "0 dofollow" is no longer the spam test; the shared anchor is.
      ~~DAVID: upload the refreshed file~~ **UPLOADED 2026-08-30 23:45 EDT (443 domains, full replacement — see the submission log)** at search.google.com/search-console/disavow-links via
      the **URL-prefix property `https://davessweater.com/`** (the tool rejects Domain properties);
      it's a **full replacement**. Copy delivered to Google Drive → **"Dave's Sweater" →
      `davessweater-disavow.txt`**; local original at `planning/seo/davessweater-disavow.txt`
      (gitignored — never committed). Then I stamp the submission date in the notes' Submission log.
- [x] **Disavow v1 — ✅ SUBMITTED 2026-07-25 by David** (308 domains, via the **URL-prefix property**
      `https://davessweater.com/`). Prior state: re-audited 2026-07-20, profile 250 → 308 RDs, all
      0-dofollow / 0-traffic spam (300/308 Ahrefs-flagged); 58 new domains appended. Submission log
      stamped in `planning/seo/davessweater-disavow-notes.md`. **STANDING ~MONTHLY:** re-run the
      Ahrefs refresh, append new spam RDs, David re-uploads (full replacement).

## Traffic forecast (owner, 2026-07-08; RESTARTED 2026-07-25 — restored from the 07-09 backup)
> Restored 2026-07-25: this block existed only in `planning/CHECKLIST-working-backup-2026-07-09.md`
> (~L171–255) and had dropped out of the live checklist. Current state + 07-25 updates at the bottom.

Owner wants to pursue a **Boone traffic forecast** — the accuracy bit extended to a universal local pain
(the 321/421 bypass, King St, App State game days / move-in, leaf + ski season, downtown events). Traffic
here is heavily **calendar/event/weather-driven → genuinely forecastable**, which is exactly what makes a
*forecast* (not just a live cam) winnable, and nobody local does it. **Cameras CAN double as the sensor**
(the multi-angle intersection pattern). Two data-source paths weighed in the brainstorm:
  - **(a) Our own cams + computer vision** — vehicle-count/speed via a detection model on the snapshot feed →
    build a congestion "actuals" dataset → forecast AND score it (on-brand; owns the data; heavier lift;
    privacy = aggregate counts only, no plates/faces; night/weather robustness is the hard part).
  - **(b) Existing traffic data** — Google/TomTom/HERE traffic APIs or NCDOT DriveNC/511 cams+incidents —
    faster to a forecast, less "ours," proven data.
  - **Winning hybrid:** forecast from calendar + events + **weather (we already have it!)**, validate
    against a traffic API now and camera-CV later (mirrors the Ecowitt "own ground truth" arc).
- [ ] **Scope locked by owner (2026-07-08):** (1) PRODUCT = **hybrid** — scored predictive forecast (the
      differentiator) + live-conditions hook + winter road conditions as a first-class pillar;
      (2) GEOGRAPHY = **Boone chokepoints first** (~2-6 cams: US-321/421 bypass, King St, US-321↔Blowing
      Rock, NC-105/321 split), prove then expand; (3) DATA = **hybrid buy-now-build-later** — ship a
      forecast on NCDOT + a traffic API, add our own cameras + vehicle-recognition as independent ground
      truth later (the Ecowitt arc).
  - **On-brand angle (design):** we grade OTHERS' traffic predictions too — Google's "typical traffic"/
    predicted ETAs are a forecast we can score. Google's generic curve doesn't know about the App State
    game or tomorrow's snow; ours does. A traffic "Right/Wrong Ray" scored publicly is the differentiator.
  - **CV cost — RESEARCHED 2026-07-08:** vehicle-recognition "actuals" run on the EDGE for ~$0/mo. Sweet
    spot = **Raspberry Pi 5 + Hailo AI HAT+ 13 TOPS (~$70 hat, ~$150/site)**; NOT cloud vision APIs
    (~$43–194/cam/mo) and NOT rented GPU. **Target CONGESTION LEVEL (free-flow/heavy/stopped, ~94%+), not
    precise counts** — also the honest, defensible metric. Turnkey stack: **Frigate** (Pi5+Hailo) →
    **supervision/ByteTrack** → density rule → bucket. Cheapest viable **~$130–150 one-time/site, ~$0/mo**;
    does-it-well **~$500–900 for 2–4 sites**. Slots into `scripts/capture_*.py` → `data/actuals/` pattern.
    Honesty caveat: one cam = one segment sample — scope the claim per instrumented segment.
  - **Competitive whitespace — RESEARCHED 2026-07-08 (verdict: OPEN + on-brand):** nobody — local or
    national — publishes a *scored, event+weather-driven local* traffic forecast. Google/TomTom/INRIX do
    generic typical-day prediction; DriveNC/511 + Ray do current-state cameras/conditions only (Ray does
    NO road forecast). The scoring layer is the differentiator. ⚠️ **WataugaOnline.com is a respected
    local incumbent** (ad-hoc "allow extra time" alerts + beloved FB community) — position as systematic/
    complementary.
  - **Grading (research-confirmed, maps onto `scripts/scoring.py`):** travel-time **MAE per corridor** +
    **Brier score** for binary "will it be jammed?" + **Brier Skill Score vs. a naive typical-day
    baseline** (the "free beats the baseline" story). Score per condition (game day / leaf Sat / ordinary
    Tue), not one blended number. Actuals = a traffic API now → camera-CV later. We grade Google's
    predicted ETAs alongside ours.
  - **Phasing:** **v1 road-condition forecast (existing snow/ice/temp data, no cameras or traffic API
    needed) → v2 traffic forecast (traffic API actuals) → v3 camera-CV ground truth (Pi5+Hailo) → v4
    parking.** "Will roads be bad tomorrow AM?" fills a gap every local channel leaves open.
  - **Demand + corridors:** App State game days (Thu-night worst), move-in, leaf season (mid–late Oct),
    winter closures — along US-321 (Boone↔Blowing Rock), NC-105 bypass, US-421/Boone Mtn, King St.
  - **Data sources — RESEARCHED 2026-07-08 (govt stack is FREE + covers our roads):** DriveNC v2 API (free
    key: event, snowandice, cameras, messagesign; 10/60s), WZDx work zones (no key), AADT counts fully
    open (186 Watauga segments), NPS Blue Ridge Parkway alerts (free key), NWS (api.weather.gov). Live
    congestion: **TomTom 2,500/day free (commercial OK)** best free pick; Waze unavailable; no DOT cams in
    Boone; no public RWIS/plow feeds. Demand signal = **App State football ICS (free, auto-updating)** +
    fixed festival/leaf/ski calendar. Two free keys to get first: DriveNC + NPS. v1 & v2 ~$0/mo.
  - ▶ **FULL DESIGN: `planning/specs/2026-07-08-traffic-road-forecast-design.md`** (product, phasing,
    data table, grading model, cameras, CV, costs, privacy/honesty, repo integration). **v1 IMPLEMENTATION
    PLAN: `planning/plans/2026-07-08-roads-forecast-v1.md`** — 8 TDD tasks, execution-ready. ⚠️ executor
    must request free DriveNC + NPS keys and verify DriveNC field names against the live keyed API.
  - ✅ **OWNER DECISIONS (2026-07-08):** v1-first · own `/roads` product · build the v3 cameras.
  - **v4 parking** folded into the design (§2a); no live occupancy feed exists for Boone/App State →
    cameras are the buildable path; best real dataset = parking citations via NC public-records request
    (owner actions listed in the design doc).
- [ ] **RESTART 2026-07-25 (owner):** (a) **v2-first near-term phasing** — traffic forecast live by late
      Aug (App State football) / firmly by early Oct (leaf season); v1 winter-roads still ships before
      first snow (~Nov). (b) **Lodging demand adopted as a v2 signal** — and per owner 07-25: use **FREE
      sources to track lodging PRICES in Watauga/mostly Boone** (nightly rates for future dates as a live
      demand read; dynamic pricing makes price itself the signal). Research prep:
      `planning/research/2026-07-25-traffic-forecast-review-prep.md` (+ free-source vetting appended).
      Spec stays DRAFT until owner ratifies the deltas in review.
- [ ] **[NEXT]** Owner review: ratify v2-first spec deltas; then execute (v2 traffic forecast build;
      v1 roads plan on its before-first-snow clock). The lodging-demand signal SPLIT OUT 2026-07-25
      into its own mini-project (next section) per owner — the tourism forecast shares demand
      elements (events, weather, lodging index) with traffic v2.

## Tourism forecast (mini-project, owner-blessed 2026-07-25; v0 capture BUILT same day)
Owner: free lodging-price tracking as a tourist-demand signal, its own mini-project "we can provide
to people," possibly part of a larger tourism forecast sharing elements with the traffic forecast.
Design: `planning/specs/2026-07-25-tourism-forecast-design.md`. Source vetting + live verification:
`planning/research/2026-07-25-traffic-forecast-review-prep.md` §1c.
- [x] **Free-source vetting (2026-07-25, two research agents + live tests).** Winner: **Xotelo**
      (keyless TripAdvisor OTA-rates API, $0) — `/rates` + `/heatmap` verified live for High Country
      hotels; `/list`+`/search` broken/gated so hotel keys harvest from public URL slugs. STR side:
      **AirROI** is the only real fit (market future-pacing endpoint, Boone/Blowing Rock verified,
      ~$6–15/mo) but ToS needs an owner email (derived-index republication + retention waiver).
      Travelpayouts/Hotellook = free posture-clean backup (owner signup). SerpApi free tier =
      benchmark only (no legal shield + Google DMCA suit). Amadeus self-service is DEAD (portal
      decommissioned 2026-07-17). MakCorps/Zyla/Bright Data/PriceLabs/AirDNA-free/Key Data/Beyond/
      Wheelhouse: OUT.
- [x] **v0 capture BUILT 2026-07-25 (PR pending).** `scripts/capture_lodging_demand.py` (stdlib,
      fail-closed, always exits 0) + `data/demand/roster.json` — **23 hotels (13 Boone, 10 Blowing
      Rock), every key live-verified before inclusion** (house provenance rule; 3 Blowing Rock inns
      excluded — no OTA rates on the feed, recorded with reasons). Daily: per-hotel 30-day
      cheap/avg/high heatmap + min-OTA rates for next Fri / next Sat / Sat-after. Output
      `data/demand/{date}.json` with derived per-town median min-rate + "high-share" per date (the
      index seeds; published number = OUR computation, never a vendor reprint). Wired into
      `daily_capture.yml` (continue-on-error). 6 new pytest (226 total green).
- [x] **Demand-signal expansion — EVENT REGISTRY BUILT + MERGED 2026-07-25 (PR #133).**
      `data/events/registry.json`: 25 events + 5 seasons + 8 verified machine-readable feeds, every
      record with source/verification-date/confidence flags (fireworks-matrix pattern). Verified:
      **Aug 15 = App State continuing-student move-in** (confirms the day-one lodging spike; Art in
      the Park stacks same day) · **Sep 5 opener = Labor Day Saturday** (traffic v2 has an extra
      week vs the "late Aug" assumption) · Oct 10 Homecoming + Sugar Mtn Oktoberfest · **Oct 17–18
      Woolly Worm + Valle Country Fair in peak leaf = the monster weekend** · athletics via
      verified SIDEARM ICS (football sport_id=3, MBB 5, WBB 12; 29 is an empty decoy) · commencements
      Dec 11 + May 6–8 · negative-demand entries (fall/spring break outflows). Feed reality: only
      Downtown Boone ICS + Town of Boone RSS are plain-HTTP fetchable; Blowing Rock ICS needs a
      browser-grade fetcher (WAF); Explore Boone/High Country Host/Ashe/Avery/Wilkes chambers have
      NO feeds → festival layer is annual-verify by design. Ski 2026-27: App Ski Mtn official-
      projected Nov 20–Mar 14; Beech/Sugar typical placeholders pending announcements. Christmas
      tree season = typical Thanksgiving-Friday→Dec 24 (no county calendar exists). Todd New River
      Festival marked DEFUNCT (last trace 2021). Housing-page hall tables are stale-2023 — only the
      verified top-level move-in windows are in the registry. ANNUAL: re-verify each spring; fill
      WinterFest/Christmas-in-July/GMHG 2027 dates when announced.
  - [x] **Index engine + athletics ICS — BUILT + MERGED 2026-07-25 (PR #134).**
        `capture_events_ics.py` (stdlib RFC 5545 parser; 74 games across football/MBB/WBB; `home`
        flag; football home dates match the registry) + `compute_busyness.py` (daily 14-day forward
        index → `data/demand/index/{date}.json`: hotel high-share ×40 + STR fill ×25 + registry
        events [negative-sign outflows subtract, seasons half-weight, feed-vs-registry football
        dedup] + weekend +5; bands calm/typical/busy/slammed; named drivers; `provisional` until
        ~4-6 wks of baseline; STR lead-time decay documented as v0 bias). Day-one index: **Aug 1 =
        77 "slammed"** (App Summer + Horse Show + 87% hotels high + Sat) vs mid-week 11–13 calm.
        Both wired into daily_capture.yml; 262 tests green. Index history accrues daily from today.
  - [ ] **Tourism v1 page** (route + name = orchestrator default `/tourism` unless owner renames):
        build ~Labor Day when the baseline matures — index data will be ready.
  - [ ] **Business Demand Partner — bring-your-own-data custom predictors (owner vision
        2026-07-25; spec §3c).** Local businesses contribute their own daily series (covers/sales/
        any one number per day) → per-business calibrated forecast built on our regional feature
        stack (events + weather + lodging + traffic + index), graded over time. Reframe: gated
        third-party dining data isn't the source — the businesses are; Key Data's contribute-to-
        benefit model, cross-vertical, town-scale. MVP staircase: (1) 2–3 pilot businesses from
        owner's network, CSV/Sheet intake, transparent regression, weekly one-pager — zero new
        infra; (2) /business page + upload + private dashboard; (3) later: consented aggregate
        dining index, paid tier (owner calls). ⚠️ HARD CONSTRAINT: contributed data is private —
        NEVER in the public repo (pilot = owner-side storage; v1 needs Supabase/private store).
        **⏸ ON HOLD — owner, 2026-07-28.** Discussed and parked; naming pilot businesses is NOT a
        pending owner action and sessions should stop surfacing it as one. Resume is owner-initiated.
  - [x] **Bookings/dining data + Google pricing — RESEARCHED 2026-07-25 (verdicts recorded).**
        DINING: every third-party avenue is OUT — Yelp Fusion (no demand fields, no free tier,
        anti-redistribution terms), TripAdvisor Content API (5k/mo free BUT reviews-only + terms
        forbid derived public indexes), OpenTable/Resy/Tock (partner-only, no public feed),
        Google popular-times (not in the official API; scraper libs violate GMP ToS),
        Placer/SafeGraph/SevenRooms (enterprise). Sole real signal = **BestTime.app** ($29–99/mo,
        Boone coverage unproven — optional owner spot-check with their free test account).
        → **Confirms the Business Demand Partner reframe: contributed business history is the only
        clean dining-demand source, and it's better data anyway.**
        GOOGLE: Routes API computeRoutes w/ future departureTime = Pro SKU, **5,000 free
        calls/mo — our ~1.5–3k/mo volume is $0** (card-on-file billing account required). **BUT GMP
        ToS §3.2.3 (No Caching / No Creating Content From Google Maps Content) likely bars storing
        ETAs + publishing a "grade Google" scoreboard.** DECISION (orchestrator, per autonomous
        directive): **drop the grade-Google lane; no Google billing signup needed.** Our scoreboard
        grades OUR model vs OUR actuals; if a rival-prediction lane is ever wanted, build it on an
        open engine (OpenRouteService free 2k req/day, or self-hosted OSRM/Valhalla) whose terms
        permit storage + derived analysis. ⚠️ Follow-up flag: read TomTom's display/storage terms
        for committed flow snapshots in a public repo (same class of question; TomTom free tier is
        "commercial OK" per 07-08 research, redistribution wording unchecked).
        **→ READ 2026-08-13, and the flag was right. See "TomTom storage exposure" below.**
  - [x] **Keys UNBLOCKED 2026-07-25 — owner supplied DriveNC + NPS + TomTom; all three
        live-verified** + stored as GH secrets. DriveNC v2 shape confirmed:
        `drivenc.gov/api/v2/get/{event,roadconditions,cameras}?key=` (roadconditions =
        per-Division rows; Watauga = Division 11); WZDx keyless. ⚠️ TomTom flowSegmentData
        defaults to km/h — request `unit=mph` (caught live).
  - [x] **TomTom storage exposure — FOUND + REMEDIED 2026-08-13/14.** The parked flag above was
        read against the binding instrument (TomTom Portal Terms & Conditions, accepted at
        registration; the canonical URL redirects to a login-gated page, so the text was read from
        Wayback captures of both the current and the 2023 version — the clauses are long-standing
        and only renumbered). **The finding: Committing flow snapshots to a public repo is not
        covered by the licence.**
        - **11.4** — "The caching or storing of any Results shall be prohibited except that you may
          cache Results delivered by the Licensed Products provided that: 11.4.1 such Results may
          only be cached **in clients** where the control headers are present in the Result;
          11.4.2 ... not ... longer than the maximum age period indicated in such cache control
          headers". `data/traffic/actuals/` was persistent server-side storage on no cache-control
          clock. It met none of 11.4.1–11.4.3.
        - **11.6.1** — forbids using the Licensed Products "to create any derivative work, product
          or service ... including ... the creation of any secondary or derived database populated
          wholly or partially with your data". An accumulating, indexed, daily time series of
          extracted readings that seeds a forecasting model sits near the centre of that wording.
        - **17.1** — all IP in the Content and Results is TomTom's. **17.3** conditions use of the
          TomTom name on prior written approval and offers only the Copyright API as the attribution
          mechanism, so there is no attribution wording that would have made publication clean.
        - **The aggravating fact, and the one that decided the remedy: `data/` here is published
          under CC BY 4.0** (`data/LICENSE`, `data/README.md`, the /api page, and a `license` field
          on every API response) — "Use them anywhere, including commercially." We were offering the
          world a licence over TomTom's Results that we do not hold. That is a stronger problem than
          the storage itself.
        - **11.6.4** also bars Licensed Products being retained in a "Public Reference Data Set"
          from which a process may generate output for third-party queries. A public repo of TomTom
          readings feeding a published forecast model sits close enough to be worth naming.
        - **Scope at the time of the fix:** 55 tracked files, 2026-07-25 → 2026-08-12, ~560 KB
          (actuals 152 KB) — 19 actuals day-files holding 74 samples x 6 corridors = 444 raw
          readings (`current_mph`, `free_flow_mph`, both travel times, `road_closure`,
          `confidence`), plus 17 comparisons, 18 forecasts and `scores.json`. Consumers mapped:
          `capture_traffic_actuals.py`, `forecast_traffic.py` (reads EVERY actuals day to seed
          baselines), `compare_traffic.py`, `check_freshness.py`, and the `traffic_actuals.yml`
          predict→grade loop. **The site does not read it** — no page, no `/api/v1` endpoint, and
          `next.config.ts` deliberately excludes traffic from the Lambda file tracing — and the
          Busy-ness Index composite does not use it either. So nothing user-facing depended on it.
  - [x] **REMEDY (owner ruling 2026-08-13: move it private, keep using it, stop labelling it
        publicly).** Implemented 2026-08-14:
        - The **whole** `traffic/` tree moved to a private store — the derived layers went with the raw
          samples. The
          comparisons carry `observed_ratio` and the forecasts carry baselines averaged from those
          ratios, so every layer is derived from Results; under 11.6.1 the derived-only defence
          ("we publish banded scores rather than mph") is available but weak, and the CC BY offer
          defeats it outright. The honest read: A ratio is a transformation of two Results values,
          and a daily series of them is the derived database the clause names.
          Re-publishing a traffic scoreboard later is a live owner decision, not a settled one.
        - `scripts/traffic_paths.py` is now the single place that says where the dataset lives:
          `$DS_PRIVATE_DATA_DIR`, else `<repo>/private-data` (gitignored). All four scripts resolve
          through it.
        - `traffic_actuals.yml` clones a **private companion repo** to `./private-data`, runs the
          same capture → grade → forecast sequence against it, and commits back **there**. Its
          permission on this repo dropped to `contents: read`; it commits nothing here any more.
          Workflow **artifacts were considered and rejected** — on a public repo anyone can download
          them, which would rebuild the exposure.
        - The freshness sentinel cannot see the dataset any more, so its three traffic checks SKIP
          when the store is absent (a public checkout's normal state) and the backstop moved into
          the traffic workflow itself as `check_freshness.py --traffic-only`, which treats an
          unmounted store as a failure. A green run that captured nothing is the 2026-07-26 silent
          skip all over again, so that path goes red.
        - **Capture continuity held.** The samples the bot committed publicly on 08-13/08-14 while
          this was in flight were copied into the private store before the public copies were
          removed — 21 actuals days, 19 comparisons, 20 forecasts, and `scores.json` graded through
          2026-08-13. Nothing was lost, and the loop was verified end-to-end against a relocated
          store (graded 08-12, forecast written, 19 actuals days seeding baselines).
        - Tests: 555 green, including new coverage for the resolver and for the mounted/unmounted
          sentinel behaviour.
  - [x] **RESOLVED — capture is UP; verified 2026-08-16.** The private repo
        `davidhluther/davessweater-data` exists (private), holds the seed plus bot commits, and the
        write deploy key is live. Every `traffic_actuals.yml` run since 2026-08-14 17:01 UTC is
        green, and the store holds an unbroken `traffic/actuals/` day series 2026-08-09 → 2026-08-16
        — **no samples were lost**. The local `~/Projects/DavesSweater/private-data` mirror now has
        `origin` wired and fast-forwards from the remote (the seed commit is its ancestor).
        Original owner steps, kept for reference: Agents cannot create repos.
        1. Create a **private** repo `davessweater-data` (matches `PRIVATE_DATA_REPO` in
           `traffic_actuals.yml`; change the env value if you name it something else).
        2. Seed it from the local working copy: `cd ~/Projects/DavesSweater/private-data &&
           git init -b main && git add traffic && git commit -m "Seed traffic dataset" &&
           git remote add origin git@github.com:davidhluther/davessweater-data.git && git push -u
           origin main`. **Do not add a licence file to it**, and never make it public.
        3. ~~Add a repo secret~~ DONE 2026-08-14 via **`DS_PRIVATE_DATA_KEY`** (repo-scoped write deploy key — narrower than a PAT
           granting read and write on the contents of `davessweater-data` alone.
        Until 2 and 3 land, every scheduled traffic run fails loudly with those instructions and
        **no samples are taken**, which is deliberate: The alternative was a green run storing
        nothing, or storing it somewhere public again.
  - [ ] **HISTORY — public git history still holds the data, and purging it is an owner call.**
        Removing the files at HEAD stops them being served from the tip; it does not remove them
        from the repo's history, and GitHub keeps unreachable objects reachable by SHA for a while
        after a rewrite. **What remains exposed: 80 commits touch `data/traffic/` (78 of them the
        actuals path), spanning 2026-07-25 → 2026-08-14, across ~568 objects, inside a 1,305-commit
        public repo** created 2026-03-04. Mitigating facts: 0 forks and 0 stars, and the data is a
        19-day corridor-speed series for six pins, not credentials.
        A purge would be:
        ```
        pipx run git-filter-repo --invert-paths --path data/traffic --force
        git remote add origin https://github.com/davidhluther/davessweater.git
        git push --force --all && git push --force --tags
        ```
        **Risks, stated honestly:** it rewrites every SHA after the first traffic commit, so the
        four daily workflows, any open branch, and every local clone must be re-cloned or rebased;
        force-pushing a public repo cannot recall anything already cloned, crawled, mirrored, or
        indexed by a code-search or model-training crawler; and GitHub Support has to be asked
        separately to expire cached views. **The realistic gain is modest** — it closes casual
        discovery while leaving any distribution that already happened untouched. Recommendation: Do it only if the raw
        readings are ever alleged to matter; the standing decision otherwise is to leave history
        alone and rely on HEAD being clean. Either way the force push is the **owner's decision to
        make**; an agent should never take it.
  - [ ] **Loose end from the same sweep:** the free-tier grant is genuinely ambiguous — 2.2 licenses
        free use for **Evaluation Use**, defined as *internal* evaluation and testing, while 2.1
        licenses a Permitted Solution "where you have entered into a Subscription Plan", and a free
        plan is selected through the Portal. The 07-08 note that the free tier is "commercial OK"
        came from the pricing page, which does not obviously agree with the terms. Nothing depends
        on resolving it while the dataset stays private and unpublished; it has to be resolved
        before any TomTom-derived number is published anywhere, including on davessweater.com.
        Related ruling from the same research (pigasus side): Do NOT publish TomTom-derived
        congestion figures in marketing copy — source congestion claims from NCDOT AADT counts or
        our own measurement instead.
  - [x] **Traffic v2 actuals — BUILT + MERGED 2026-07-25 (PR #135).** `capture_traffic_actuals.py`
        + own workflow (4 peak-window crons): 6 corridor pins, every one reverse-geocoded onto its
        intended road (no-eyeballed-pins rule — first-guess pins ALL landed on side streets):
        US-321 bypass, King St/421, NC-105 split, NC-105 Foscoe, US-321 Valley Blvd, US-421 Deep
        Gap. 24 of 2,500 free calls/day. Day-one: King St 11/25 mph, bypass 20/30 (July Friday PM).
        Corridor grading data accrues from today. 266 tests green.
  - [x] **Roads v1 — SHIPPED 2026-07-25 (PR #136 + wiring commit f9a2e3a).** All 8 plan tasks:
        rubric + ordinal scorer (reconciled tests-as-spec: Icy temperature-gated ≤30°F; WMO
        freezing-rain codes 56/57/66/67 escalate to Hazardous), daily forecast from our own
        Open-Meteo capture, DriveNC + NPS capture (LIVE FIELD CORRECTIONS: `snowandice` endpoint
        doesn't exist — real one is `roadconditions`, per-county rows, Watauga/Ashe/Avery all
        Division 11; event fields are RoadwayName/Description/EventType/IsFullClosure), scorer +
        running road_scores.json, TS loaders w/ 48h freshness gate, **/roads page live** (static,
        nav + sitemap + methodology §, dateModified bumped). Wired into daily_capture (forecast +
        capture steps) + daily_compare (scoring step). Day-one: 14 High Country incidents incl. a
        Parkway weather closure; first scored day 100/100. 275 py + 237 vitest; mobile-verified
        390px. First fully forward-looking traffic-family product, ~4 months before first snow.
  - [x] **Traffic model v0 — SHIPPED 2026-07-25 (PR #137).** Daily predict→grade loop, running
        SILENT: per-corridor congestion-ratio forecasts (today+tomorrow × 4 windows) = learned
        baseline cell (corridor × weekday-class × window; cold-start fallback chain recorded as
        `basis` per prediction) × declared event priors (football ×0.55 downtown / academic inflow
        ×0.65 / town events ×0.75 / Busy-ness band nudges on tourist corridors / outflow ×1.05;
        "v0 priors, corrected by grading") × weather multiplier + logistic jammed probability.
        Comparer grades yesterday (ratio MAE + jammed Brier, split event-day vs ordinary +
        weekday-class) into running `data/traffic/scores.json`; idempotent; wired into the first
        daily actuals run (grade → forecast). **Day-one prediction on record: King St 17:00
        jammed p=0.79** — graded tomorrow morning. 42 new tests (main = 321 py total). By the
        Sep 5 opener: ~6-week graded track record before anything publishes. v0 documented
        simplifications: event multipliers uniform across windows; town-based corridor matching
        (registry `corridors` taxonomy differs from actuals slugs — unify later).
    - [x] **Silent-skip incident FOUND + FIXED 2026-07-27:** the model's "UTC hour == 12" gate
          never fired — GitHub ran the 12:07 cron at 13:49 and 15:08 (delays exceed the hour
          window), so 07-26/27 produced no forecast and nothing was graded. Gate replaced with an
          OUTPUT check (run iff today's forecast file is absent — delay-proof, once/day, dispatch-
          friendly). Caught up locally: **day-one 07-25 forecast graded** (12 pairs, ratio MAE
          0.064, Brier 0.068 overall; King St the roughest at MAE 0.20 on the concert Saturday) +
          07-27 forecast generated (3 actuals days now seed baselines). 07-26 forecast is honestly
          absent (never generated — that day is a gap, not backfilled). LESSON (pattern for all
          shared-cron workflows): never gate a step on wall-clock hour; gate on whether its
          output exists.
      - [x] **Output-gate fix VERIFIED IN CI 2026-07-28 — first live firing, clean.** Worth recording
            that until this run the repaired path had never executed: the fix committed 07-27 16:40 UTC
            and every Traffic Actuals run after it (17:49, 22:14, 00:08) found `forecast/2026-07-27.json`
            already present from the local catch-up and correctly skipped. The 07-28 run exercised it for
            real and produced exactly the expected state: `forecast/2026-07-28.json` generated,
            `comparisons/2026-07-27.json` written (yesterday graded), `graded_dates` =
            `['2026-07-25', '2026-07-27']` — 07-26 skipped, which is correct and permanent (no forecast
            was ever generated for it, so it can never be graded). **The run that did it proves the fix
            was necessary: GitHub fired the 12:07 UTC cron at 14:30**, another >2h delay the old
            wall-clock gate could not have survived. Model quality improved with the second graded day:
            n 12 → 24, ratio MAE 0.064 → 0.048, jammed Brier 0.068 → 0.037.
      - [x] **Sentinel now covers this failure class — PR #158 MERGED 2026-07-28 (`5ee7348f`, squash).**
            The standalone freshness sentinel stayed green through the whole silent skip because it only
            watched the weather pipeline. Extended with three read-only traffic checks (newest
            forecast ≤1 day, newest comparison ≤3 days, newest actuals ≤1 day — slack sized to
            GitHub's routine multi-hour cron delays and to the one legitimate 07-26 gap day).
            Thresholds pinned by test against both the real passing repo state and the reconstructed
            failing incident state. 546 pytest green.
        - [ ] **Confirm the extended sentinel's first CI run.** It merged after the 07-28 17:49 UTC
              sentinel run, so that run still executed the old weather-only code — **the 07-29 run is
              the first to exercise the traffic checks.** Expect success; a red run means a threshold
              is mis-sized against real cron timing rather than a genuine pipeline stall, so read the
              step output before touching the pipeline.
  - [~] **NCDOT continuous-count historical data — EMAIL SENT by owner 2026-07-25; awaiting
        Traffic Survey Group reply.** Hourly volumes 24/365, public/clean; unknown whether a
        continuous station sits on our corridors. If it lands: years of labeled hours joinable to
        reconstructed features — the free historical backfill. Commercial alternatives are dead
        ends (TomTom Stats = enterprise; Google = ToS §3.2.3).
        **Still no reply as of 2026-07-28 (owner confirmed).** Nothing to do but wait; this is not a
        blocker on anything, since traffic v2 grades against TomTom actuals and NCDOT would only add
        historical depth. If it stays silent into late Aug, a follow-up is the owner's call.
  - [ ] **Restaurant-API historical data — ANSWERED 2026-07-25: the APIs hold no demand history**
        (Yelp/TripAdvisor "history" = review timestamps — lagging, thin at Boone scale, ToS-
        encumbered; Google popular-times curves = the real thing but API-inaccessible and
        scrape-barred). Bounded option ON THE TABLE: **BestTime.app one-shot** — one month $29,
        pull historical busyness curves for ~20 Boone venues as permanent internal training
        features, cancel. **DECLINED by owner 2026-07-25 — CLOSED.**
  - [x] **Busy-signal sweep round 2 — DONE 2026-07-25; winners BUILT same day (PR #138).**
        SHIPPED: **campus events capture** (calendar.appstate.edu Localist JSON, keyless — covers
        Holmes Center/theatre/commencement; day-one pull caught tonight's Jon Pardi Kidd Brewer
        stadium concert that athletics ICS + registry both missed — the missing driver behind
        today's real King St congestion; NOTE: feed includes some off-site rows, consumers filter
        by venue/address) + **Wikipedia attention capture** (official pageviews API, 5 regional
        articles, rolling lag-safe series). VERDICTS on the rest: NCDOT continuous stations —
        probably NONE in Watauga; MS2 TCDS portal exists but bot-blocked/JS (owner's emailed
        request = the authoritative answer; AADT stays annual-baseline-only) · NCDOT cams = video
        (HLS) not stills, reuse terms undocumented → CV-on-DOT-cams is an experiment-grade spike,
        owner should ask NCDOT re image reuse when convenient · Windy webcams = display-only
        (tokened URLs + attribution; not a sensor); **ResortCams = local Boone company
        (828-963-7286), hosts App Ski/Beech cams, reportedly waives fees by location — worth an
        owner call if we ever want a town cam** · Ticketmaster = free key but Boone coverage
        doubtful (Holmes on AXS/SeatGeek instead) — skip unless Localist gaps appear · Eventbrite
        search API dead (2020), Bandsintown artist-scoped — OUT · schools calendar = cheap annual
        registry entries, add at next registry pass · **parking: confirmed NO live feed exists**
        (Town meters = IPS Group + ParkMobile, occupancy private; App State runs Modii
        permit-finder, no live counts) — parking stays cameras-later + the design doc's owner
        asks; near-term move = INFER pressure from event stacking (game + Holmes concert =
        downtown full), which the index can do already.
  - [x] **Data-source brainstorm (owner-prompted 2026-07-25) + first build.** SHIPPED: **USGS
        river gauges** (PR #139 — Watauga @ Sugar Grove, S Fork New @ Jefferson, Wilson Creek
        gorge; public domain, keyless; recreation-demand + flood-risk axis; 3/3 sites live).
        RANKED BACKLOG (all free unless noted): (1) **own GA4/GSC as trip-planning signal**
        (out-of-region forecast views = intent; ours, zero ToS); (2) **calibration money-trail
        series** — NC monthly county sales-tax distributions + NC ABC board sales + NPS Parkway
        visitation stats (official, trailing; the "how busy was it really" ground truth);
        (3) **RunSignup open API** (race calendars WITH participant counts — quantifies event
        magnitude; Blood Sweat & Gears etc.); (4) **Town agenda parsing** (special-event permits
        appear weeks early; we already pull the CivicPlus RSS); (5) fall-color report pages as
        LEAF-MODEL GRADING source; (6) NC Wildlife hunting/fishing season dates (rural corridor
        modifier); (7) NCHSAA high-school schedules (Friday-night locals); (8) quirky tier:
        OpenSky ADS-B arrivals at GEV/UKF/Elk River strips (second-home pulse), Reddit chatter
        monitor (incident detection; Reddit tool already connected), AppalCart ridership (records
        request), town STR-permit registrations (supply side). Build order: (1)+(2) with the
        tourism v1 page; (3)+(4) at next registry pass; rest opportunistic. **Weather events verified 2026-07-25:**
      NWS alerts API keyless (`api.weather.gov/alerts`, Watauga = NCZ018/NCC189) → new capture for
      watches/warnings; our own forecasts double as demand modifiers (leaf-Saturday sun ↑, festival
      rain ↓, powder → ski surge); the whole weather→demand→traffic chain is gradable because we
      already score the weather layer. Spec §1 table updated.
  - [x] **Calibration + event-magnitude layer built 2026-07-25 (branch `feat/calibration-signals`).**
        Backlog items (2)(3)(4)(5)(6) shipped: **NPS BLRI monthly visitation** (`capture_nps_visits.py`
        → `data/calibration/nps_blri_visits.json`; irmaservices.nps.gov Stats API, keyless, 564 months
        back to 1979, monthly gate on the 3rd; textbook curve — Jan trough ~399k, Oct leaf-peak ~2.35M);
        **RunSignup races** (`capture_races.py` → `data/events/races.json`; keyless, 40mi/12mo, weekly
        Monday gate; 52 upcoming day-one — NOTE participant COUNTS are not in the search payload, only
        `is_registration_open` is, so counts would need per-race calls we don't make); **Town of Boone
        agenda scan** (`capture_town_signals.py` → `data/events/town_signals.json`; 3 CivicPlus RSS feeds
        — events + all-calendars + agenda-center ModID=65 — keyword-filtered daily, 0 hits at build =
        summer lull, all 3 reachable); **registry enrichment** — deer gun seasons (Northwestern Nov 21 /
        Western Nov 28, TENTATIVE until ~Aug 1 regs digest) + `grading_sources` fall-color note
        (Grandfather gallery, High Country Host, WataugaOnline). Backlog item (2) **NCDOR sales-tax +
        NC ABC** = DOCUMENTED-ONLY (`data/calibration/README.md`): both are xlsx/PDF behind dated landing
        pages, no stable CSV → out of stdlib scope; ingest notes recorded for a future capture. +21 tests
        (328→349 green). Backlog items (1)(7)(8) still open.
- [ ] **v1 page** (`/tourism` or report-franchise slug — owner call): Busy-ness Index headline +
      30-day heat calendar + weekend rate trend + event/weather overlays. GATE: ~4–6 weeks of
      baseline (~Labor Day if v0 ships now — in time for leaf season). Grade the index itself later
      (vs occupancy tax / traffic actuals) — on-brand.
- [ ] **Owner (optional, upgrades the signal):** (a) email AirROI re: Redistribution Addendum +
      retention waiver (adds the dominant STR segment's booking pace) — draft email + steps provided
      2026-07-25; (b) free Travelpayouts signup → token as GH secret `TRAVELPAYOUTS_TOKEN`
      (posture-clean backup feed); (c) later: Banner Elk / Beech Mtn hotels for the ski-season read.
- [~] **Leaf-season forecaster — ✅ DRAFT MODEL MERGED 2026-07-26, ~7 weeks ahead of target (PR #142;
      mid-Sept + October follow-ups below still open).** `scripts/leaf_model.py` (pure stdlib) + `predict_leaf.py` → `data/leaf/
      predictions.json` w/ per-prediction `basis` provenance; Open-Meteo archive inputs cached under
      `data/leaf/inputs/` (~2.7 MB, committed for offline reproducibility). Model: Oct-6 photoperiod
      anchor + 6.5 days/1,000 ft elevation lapse + bounded Sept-temp anomaly (±7 days, degrades to
      climatology pre-Sept); window ±5 days; every constant hand-traceable. 2024/2025 hindcast: all
      elevation bands hit their windows (high bands within 1-2 days) — validates the gradient, not yet
      day-level interannual skill. Grading scheme implemented NOW (day error + window-hit + 0-100 score);
      23 new tests (374 py green). 2026 sanity: Beech Oct 3 / Boone Oct 17 / Wilkesboro Nov 1. Ships
      silent — no Actions wiring, no page. **UPDATE 2026-08-30: no longer silent.** The per-town
      windows now render on all 17 `/weather/[slug]` pages via `src/lib/leaf.ts` +
      `FallColorWindow.tsx` (fall-readiness sweep, top of this file); a `/leaf` hub builds
      2026-08-31. FOLLOW-UPS: (a) **mid-Sept: re-run `predict_leaf.py --refresh`** once Sept temps
      accrue — this is now MORE urgent, not less: the windows are already public and every town page
      currently tells the reader in as many words that the thermal term is switched off. The refresh
      turns that paragraph into a real anomaly reading, and `hasThermalSignal()` flips the copy
      automatically. Consider wiring it into `daily_capture.yml` behind a September date gate so it
      is not a human's memory; (b) **October: capture observed peaks by eye** from the registry
      grading sources into a scorer-ingestible file — decide format then; (c) Boone's elevation is
      hardcoded (not in locations.json) — fine for now.
      Original intent (unchanged): feed predicted peak weekends into the Busy-ness Index up-weight +
      traffic v2 corridors; cross-confirm against lodging high-share.

- [x] **left917.net partner event feed — SHIPPED 2026-07-25 (PR #141, owner-directed).**
      left917.net = independent High Country news/events site (Watauga/Ashe/Avery) that plans to
      use DS as its weather service. Their published /calendar.ics (hourly TTL, 510 events day-one)
      is now an eleventh daily feed — the hyperlocal community layer (Instagram-sourced happenings,
      Ashe/Avery venues) nothing else carries. Consumes the PUBLISHED feed only; their richer
      internal /api/items (cancellation flags, counties, editorial picks) + FastAPI surface exist —
      ask in the owner's courtesy ping. UIDs embed source URLs → dedup vs campus.json is trivial
      (they aggregate Localist too). RECIPROCITY: their weather integration = our /api/v1/forecast
      + widget.js (built 07-25) — the first external consumer of the public surface.
  - [x] **left917 /api/items enrichment — SHIPPED (PR #153, owner call: "pull all of it /
        whatever's best for DS").** ICS stays the spine (only it has reliable start times);
        /api/items joins on source URL adding cancelled/counties/kind/source_name/festival_name —
        506/506 enriched day one. Factual fields only; their editorial prose deliberately stays
        out of this public repo.
  - [ ] **Owner ping to the left917 operator — DRAFTED 2026-07-28, owner sends** (optional
        relationship gesture; permission no longer being asked, per owner). Draft:
        `planning/2026-07-28-left917-courtesy-ping-draft.md`. No prior draft existed anywhere —
        this line described one but never contained it.
        ⚠️ **The old wording of this item was factually wrong and the draft corrects it.** It said
        the ping tells them "DS consumes their calendar with attribution." Verified in code
        2026-07-28: **neither half is true yet.** (1) No public attribution — `left917.json` carries
        an `attribution` string but nothing renders it; `grep left917 src/` returns zero hits, because
        there is no public events surface at all. (2) **Nothing consumes the feed** —
        `capture_left917_events.py` writes 507 enriched events daily and no reader picks them up;
        `compute_busyness.py` reads only `registry.json` + `athletics.json`. The feed is captured
        and parked. Accurate claim today: "we pull it daily and it will feed the demand signal."
    - [ ] **Wire the left917 feed into `compute_busyness.py` + surface the credit** — recommended
          BEFORE sending, and worth doing regardless. 507 hyperlocal Watauga/Ashe/Avery events
          across three counties are being captured for nothing, and they are exactly the layer the
          index is missing. Doing it first also turns the ping from a heads-up into a thank-you
          with a link.

## Public feed + API (owner-directed 2026-07-25 — spec DRAFT, awaiting owner sign-off)
Owner: "an API or RSS to share," with display options — **1/3/5-day horizons · by town when live ·
level of detail.** Spec: `planning/specs/2026-07-25-public-feed-api-design.md` (`/api/v1/*` route
handlers: forecast/today/scores/verdict/towns + tourism later; prerendered RSS variants
`/feed/{town}/forecast-{N}day.xml` + daily verdict feed; CORS open; `/api` docs page).
- [x] **Owner sign-offs GIVEN 2026-07-25:** CC BY 4.0 data license APPROVED ("do the 4.0" — ties off
      the parked Dataset-license decision) · embeddable widget APPROVED ("do the widget") · town
      gating = same ≥9-scored-days gate everywhere (rec adopted, not overridden).
- [x] **BUILT + MERGED 2026-07-25 (PR #131).** data/LICENSE (CC BY 4.0) + data/README + Dataset
      JSON-LD license property · `/api/v1/{forecast,today,scores,verdict,towns}` (days=1|3|5, town,
      detail=summary|full; CORS open; license+attribution in every response; town param honors the
      shared ≥9-scored-days gate — Boone only today, towns auto-appear as they cross) · prerendered
      RSS `/feed/{town}/forecast-{N}day.xml` + `/feed/{town}/verdict.xml` + homepage autodiscovery ·
      `/widget` (no analytics in the embed; CC BY attribution backlink; X-Frame exemption scoped to
      /widget only) + `public/widget.js` (iframe loader, postMessage sizing) · `/api` docs page +
      sitewide footer link. Vercel data tracing: `outputFileTracingIncludes` → data/**/*.json (no
      PNGs), verified in .nft.json. 232 vitest + lint + build green; endpoints curled; RSS validates;
      mobile checked 390px (/api) + 390/300px (/widget). Deviations logged in the PR: /feed/index
      folded into /api docs; /api/v1/tourism waits for tourism v1.
  - [x] **Post-deploy check — ✅ COMPLETE 2026-07-28 (both halves).** API half verified 2026-07-26: prod
        curl `davessweater.com/api/v1/forecast` returns 200 with real forecast JSON (license + attribution
        present; Lambda data tracing works) and `feed/boone/verdict.xml` returns 200; re-confirmed 07-28
        (3-day Boone payload, 8 DSI sources). **Widget half verified 2026-07-28 (DS IA):** the documented
        `<script src="…/widget.js" data-town="boone" data-days="3" data-detail="summary" async>` snippet
        embedded on a genuinely cross-origin page (localhost static server → davessweater.com) renders the
        full card — today's block, two days ahead, almanac line, both links, CC BY attribution — with
        postMessage sizing landing correctly (following content is not overlapped) and zero console errors,
        at desktop and 390px. First external consumer path proven end-to-end.
        ⚠️ **Found during the check:** the widget's almanac line joins with middots
        (`almanac.join(" · ")`, `src/app/widget/page.tsx:244`) while its own date line uses a pipe, so the
        card contradicts itself and the 2026-07-02 "separators are pipes, swept site-wide" standard.
        12 middots survive across 7 files (some are legitimate bullet glyphs, e.g. the fireworks `<li>`).
        Left UNFIXED deliberately — it belongs to the owner's in-flight consistency pass and the
        design-consistency gate brief, not a drive-by edit. `scripts/copy_lint.py` has no separator rule;
        adding one is the durable fix.
- [x] **API cost control + shared-data architecture (owner directive 2026-07-25; tightened to
      weekly same day).** Paid AirROI pulls gated to **Mondays only** (`is_sample_day` in
      capture_str_pacing.py, --force override) → 2 calls/wk ≈ **$0.45–0.90/mo** at quoted rates.
      Monday = max lead time on the coming weekend + clean week-over-week fill comparison. What we
      pull: ONE endpoint (`/markets/metrics/future/pacing`) × 2 markets; the needed field is the
      forward **fill_rate** curve (~90 days out; rate averages ride along free). Standing rule (in the script header): **each vendor gets
      exactly ONE capture point; every consumer — tourism page, feeds, traffic forecast, future
      projects — reads the committed `data/demand/` JSON. The repo is the API; pulls never multiply
      with consumers.** Xotelo (free) stays daily; revisit AirROI cadence against the first
      month's actual bill.

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
- [x] **Meta Pixel added 2026-07-07 (pre-GMHG, for the Meta social/ads push).** Pixel ID 4659969744289221,
      hardcoded in `AnalyticsScripts.tsx` beside GA4 (pixel IDs are public in page source; env-var
      indirection buys nothing here). Sits inside the same `ds_track=off` gate, so the owner opt-out covers
      it; no `<noscript>` fallback (the component only mounts when JS runs, so it would be dead code).
      fbevents.js auto-refires PageView on history pushes, so client-side navs are covered. Verify in Meta
      Events Manager against real traffic, NOT an automated browser (tracker endpoints commonly blocked
      there — same artifact as the GA 503s/Clarity notes above). **Live-verified on prod 2026-07-07:**
      config fetched for the right ID on davessweater.com + the PageView beacon fired to facebook.com/tr.
- [x] **GA4 admin config round — DONE 2026-07-07 (via the owner's browser; lives in GA, not the repo).**
      (1) Derived event `gmhg_started_plan` created (Custom configurations → Custom events; the simplified
      "Create event" wizard only offers page_view/form_submit as triggers — the full condition builder is
      behind "View more options" / Custom events): `event_name equals gmhg_engagement` AND `action equals
      started_plan`, copy-params ON, marked as key event at creation (no default value, once per event).
      ⚠️ Verify the key-event flag once data flows — the Key events tab only lists names with 28-day data,
      so it can't confirm the flag yet; if `gmhg_started_plan` shows unstarred tomorrow, star it.
      (2) Five event-scoped custom dimensions registered (were ZERO — params were invisible in standard
      reports): GMHG action (`action`), GMHG filter name (`filter_name`), Click element type
      (`element_type`), Click link text (`link_text`), Click link URL (`link_url`). Dimensions + derived
      event only populate going forward (created ~10 PM EDT, before games traffic).
      **Why "only page_view and form_submit" showed in GA:** element_click/gmhg_engagement shipped only
      hours earlier (new event names take 24-48h to reach standard reports + the Admin events list), and
      the owner's own devices are ds_track=off since #120 — verified the code fires on prod via dataLayer
      (element_click with correct payload). Realtime → "Event count by Event name" is the no-lag view.

## Technical SEO audit (2026-07-28) — discovery failure after the town/roads launch
Trigger: Google Search Console reported `/weather`, `/weather/*`, and `/roads` as "URL is unknown to
Google" days after they launched, with the sitemap last downloaded 2026-07-23 — before those pages
existed. A read-only audit (codebase at `main`, a local build with all prerendered HTML parsed, plus
live `curl` against prod) found the cause and produced a full prioritized register.

**Full register: `planning/audits/2026-07-28-seo-technical-audit.md` — LOCAL ONLY** (`planning/` is
gitignored, so it is not in this repo's history; it lives on the owner's machine). Everything below
is the sanitized summary, so nothing is lost if that file is.

Headline: the crawl surface is otherwise in genuinely good shape. Canonicals correct on all 56 pages,
exactly one `<h1>` each, every `<img>` has an `alt`, zero duplicate titles or descriptions, all
redirects single-hop, `/widget` correctly noindexed and absent from the sitemap, robots clean, no
internal link 404s, and the header town picker does ship all 17 town links in prerendered HTML.

- [x] **C1 (Critical) — sitemap emitted no `lastmod` for any data-driven URL. FIXED 2026-07-28**
      (branch `seo-sitemap-lastmod-and-orphans`). Prod served 55 `<loc>` and only 5 `<lastmod>`, all
      static editorial post dates, newest 2026-07-02 — so nothing in the file had moved in a way
      Google could see since before the town pages existed. Google ignores `changefreq` and
      `priority`; `lastmod` is the one field it reads. The old code's reasoning (never stamp every
      URL with the daily build date) was kept and extended, not overturned: build dates are noise,
      data dates are honest. Town weather + board pages now carry their own
      `latestComparisonDate(slug)`, `/` and `/right-wrong-ray` carry Boone's, `/weather` carries the
      newest across its towns, `/roads` carries the roads artifact's `generated_at`. `/about`,
      `/methodology`, `/shop`, `/api`, and `/resources*` still omit it, correctly. Built output went
      from 5 `<lastmod>` to 44.
- [x] **H1 (High) — `/roads` was orphaned by a same-day nav regression. FIXED 2026-07-28.** It had
      exactly one inbound link site-wide (from `/methodology`). Commit `4b96577a` (2026-07-28, "Nav
      and footer trim") removed its header entry, intending to rehome it under "Reports and Tools",
      but `/resources/reports` renders a hand-curated list it was never added to.
- [x] **H2 (High) — `/report-card` hub near-orphaned. FIXED 2026-07-28.** One inbound link, from its
      own child. The individual monthly cards are well linked; the franchise hub they roll up to was
      not, which matters because it gains a URL every graded month.
      Both fixed the same way: a new `TOOLS` list in `src/content/resources.ts` for standing pages
      (as opposed to `REPORTS`, which is dated one-offs), rendered as a "Tools and trackers" section
      on `/resources/reports` — the destination the nav trim intended. That page's title and `h1`
      became "Reports and Tools" to match what the nav already called it. Nav stays lean, per the
      owner's trim. Crawl path is now every page → `/resources` → `/resources/reports` → both pages,
      all in prerendered HTML. A unit test fails if either is dropped from `TOOLS`.

Still open from the same audit (nothing here is breakage):
- [ ] **M1 — OWNER DECISION: the public gate is applied inconsistently across surfaces.** Three towns
      sit below `MIN_SCORED_DAYS = 9` (seven-devils 4, sugar-grove 2, wilkesboro 2). `/api/v1/towns`
      and the feed enumeration filter them out through `listPublicTowns()`; the sitemap submits them.
      Same gate, opposite answers. The pages are **not** thin — measured, `/weather/sugar-grove` is
      the *largest* town forecast page on the site (526 words) and every below-gate board carries
      real data plus a prominent "N of 9 scored days" disclosure — so this is a coherence question,
      not a content question. Two defensible resolutions, pick one: **(a)** filter the sitemap
      through `isTownPublic()` (pages stay live and crawlable, they just aren't *submitted*, and they
      enter automatically on crossing the gate with a real `lastmod` marking it — the auditor's
      lean, and it matches the API); or **(b)** leave the sitemap open and reframe the gate as
      "provisional records aren't ranked", exposing the towns via `/api/v1/towns` with a
      `provisional: true` flag. Settle before more towns are added, since the rule binds all of them.
- [ ] **M2 — `/weather/{slug}` is high-boilerplate.** Measured word-similarity against `deep-gap`:
      0.60–0.85 (median ~0.78) on ~510-word pages. The boards are fine (0.47–0.62 on 817–1,414
      words), and cross-surface similarity is only 0.32–0.45, so the two surfaces are **not**
      cannibalising each other. Fix: 100–200 words per town derived from data rather than hand-written
      (elevation delta vs Boone, which sources cover the town, its river gauge, its own best and
      worst forecaster) — machine-generated, factual, unique by construction. Largest item on the list.
- [ ] **M3 — `/resources/videos` is a 102-word empty page that the sitemap still submits** while it
      is deliberately hidden from the nav. Best fix: filter empty categories out of `resourceRoutes`
      (automatic and self-healing) rather than a one-off noindex.
- [ ] **M4 — three routes have no OG image:** `/weather`, `/roads`, `/api`. The town pages are fine;
      it is the hubs that are missing one. Follow the existing `src/lib/ogCard.tsx` pattern.
- [ ] **M5 — town `Dataset` JSON-LD is thinner than Boone's.** Boone's carries `keywords` and a
      `distribution` array; all 34 town blocks carry neither, though every town has a real
      distribution (`/api/v1/scores?town={slug}` plus its feeds). Extract a shared `townDataset()`
      into `src/lib/schema.ts` with `distribution`, `temporalCoverage`, `variableMeasured`; gate
      `distribution` on `isTownPublic` so it never advertises an endpoint that 404s.
- [ ] **M6 — `/weather` has no heading structure below `<h1>`.** The 18 town cards use
      `<span className="ds-h3">`. Change to `<h2 className="ds-h3">` — `ds-*` are size tokens, not
      element tokens, so this is a pure markup change with zero visual diff.
- [ ] **L1 — 41 of 56 titles exceed 60 characters** (the `| Dave's Sweater` suffix costs 16 on every
      page). Mostly cosmetic: the town name sits early enough to survive truncation and there are
      zero duplicates. Only worth doing if the owner wants control of the full snippet.
- [ ] **L2 — `/right-wrong-ray` (Boone) is the only town-surface page without a `BreadcrumbList`.**
      Also normalise breadcrumb `Home` items, which are sometimes `https://davessweater.com/` and
      sometimes `https://davessweater.com`.
- [ ] **L3 — RSS autodiscovery exists only on the homepage.** The site publishes 4 feeds x 15 gated
      towns; none is advertised on the town page it describes. Mirror the homepage's
      `alternates.types` block in `/weather/{slug}`, gated on `isTownPublic`.
- [ ] **L4 — one heading-level skip**, `h1` → `h4` in the `welcome-to-daves-sweater` post markdown.
      Every other page is clean.
- [ ] **L5 — OWNER CALL: the homepage `<h1>` contains neither "Boone" nor "weather"** ("The free
      forecasts keep beating the one you pay for."). Not a defect — the title and description both
      carry Boone + weather. Flagged only because it is the site's most weighted on-page element. A
      kicker carrying "Boone, NC weather" would get both without blunting the line.
- [ ] **L6 — `/shop` has no product structured data.** Low value: checkout happens on Fourthwall and
      the merch is explicitly not a revenue play. Listed for completeness; the auditor would not
      prioritise it.

## SEO scan follow-ups (audited 2026-07-18 — owner said "remind me later")
Full-site scan 2026-07-18: fundamentals clean (sitemap exact, robots OK, canonicals self-referencing,
all JSON-LD valid, redirects single-hop, no noindex). Two fix-sized items were spun into task chips;
if the chips are gone, re-create from this list:
- [x] **og:image — ✅ FIXED 2026-07-18 (owner-directed, same session as the audit).** Shared
      `src/lib/ogCard.tsx` (brand dot-grid next/og card) + colocated opengraph-image/twitter-image
      pairs for /shop, /about, /methodology, /resources/[category], /resources/[category]/[slug],
      AND the two static segments that shadow the dynamic route (/resources/videos,
      /resources/reports — they do NOT inherit [category]'s files; caught in build verification).
      BlogPosting JSON-LD gained `image`. Post cards: title + summary + "Published Month D, YYYY"
      (brand date format); long paths render domain-only in the footer. Verified in built HTML:
      og:image + twitter:image present on all 12 previously-missing pages; sample card rendered
      1200×630.
- [x] **/blog/:slug redirect trap — ✅ FIXED 2026-07-18.** `nativePostRedirects()` in next.config.ts
      scans src/content/posts frontmatter at build and emits `/blog/<slug>` →
      `/resources/<category>/<slug>` for every non-news post, BEFORE the blanket news rule
      (first match wins) — automatic for all future articles. Verified on `next start`: article
      slugs 308 → their articles URL (200), the news slug + /blog hub unchanged.
- [x] **Dead 410 citation — ✅ FIXED 2026-07-19.** The TDA purges past-event pages, so the per-event
      URL is gone for good; Jones House (the town's own page, live) promoted to primary source —
      it now feeds the Event schema organizer — and the TDA citation repointed at their stable
      annual-events page. Verified: zero references to the dead URL in built HTML.
- [x] **LOW batch — ✅ FIXED 2026-07-19.** Sitemap: posts carry their real dates as `lastmod`, all
      other routes honestly omit it (the daily build-date stamp taught Google to distrust it).
      /methodology TechArticle: datePublished 2026-06-26 (R4 ship) + dateModified 2026-07-18
      (trace-band change; bump on scoring changes — comment in the file). og:url added to
      /resources hub + category + post metadata. Event schema: fireworks events carry the CC0
      fireworks photo, GMHG carries the credited torch photo.
- [ ] **Dataset `license` — OWNER DECISION, deliberately not set.** The repo has no LICENSE file, so
      declaring one in schema would grant rights nobody has granted. If desired: CC BY 4.0 fits the
      data-democracy thesis (free reuse, credit required) — add a LICENSE + the schema property
      together. Event `offers` also skipped deliberately: GMHG admission is paid (a $0 offer would
      be false) and per-show fireworks pricing was never verified — add only with verified prices.

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
      (apex). No code change. **Validate Fix started by owner 2026-07-07** on the "Duplicate without user-selected
      canonical" issue — watch GSC for the validation verdict (typically days–2 weeks). (The two `http://` "Page
      with redirect" entries are the benign http→https redirect — not a bug.)
  - [x] **Explicit homepage self-canonical — ✅ DONE (PR #116, merged 2026-07-07).** `alternates: { canonical: "/" }`
        in `src/app/page.tsx`.
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
