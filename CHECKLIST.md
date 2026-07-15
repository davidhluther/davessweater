# Dave's Sweater — Checklist

This file is the durable single source of truth for outstanding work. Read it at the
start of each session and keep it current — check items off, add new ones, and update it
in the same change that completes a task. Do not rely on chat memory; this file wins.

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

## To do — site (pre-station, outstanding)

- [ ] **Scoring recalibration — the big one (owner-flagged 2026-07-02).** Clustered 90s = weak
      differentiation, and on trace days (0.071") a "none" forecast incoherently earned 10/10 amount after
      0/10 type. Owner wants balance and explicitly NO double-penalty on trace misses. Model on FULL history
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
- [ ] **DSI membership optimization — decide at ~30 days (open).** Now that we can measure it, choose whether
      to beat the flat mean. Three levers, in rough order of evidence: (1) **skill-weighted mean** (inverse-MAE,
      drop-the-worst) rather than winners-only — keeps error-cancellation while fading the laggards
      (NWS/OWM/WeatherAPI ~85); (2) **per-lead-time member selection** — the leader changes by horizon
      (Google/MET win day 0-1, Visual Crossing/Tomorrow.io hold up best at day 2-5), so a 5-day DSI should
      weight per horizon (BLOCKED on the leadtime item below); (3) **per-variable specialization** (precip from
      one, wind from another) — supported in principle but BLOCKED on rolling up per-element/per-source skill
      (only high/low MAE is aggregated today; wind/precip live in per-day `comparisons/*.json`). Caveat: ~21
      days is one summer regime — don't hard-code weights before a fuller sample or it overfits.
- [ ] **Score the DSI per lead time (foundation for the per-horizon strategy).** `leadtime.py` builds
      `leadtime_scores.json` per source from each day's day-ahead forecasts but has no `composite` row; add one
      (build the consensus at each lead from the members' day-ahead files) so the accuracy-decay chart and the
      per-horizon membership decision have real data.
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
- [ ] **STANDING MONTHLY: publish the report card for each completed month** (owner directive 2026-07-08).
      July 2026 card due ~Aug 1; same corpay-method pipeline as the June card (brief → draft → adversarial
      fact-check vs scores.json → style validate). **Report-card titles are Title Case** ("Ray's Weather
      Report Card: July 2026") — as are ALL blog-post titles now (the four live posts were retitled
      2026-07-08; H2/H3 stay sentence case).
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
