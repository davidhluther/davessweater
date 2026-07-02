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
- [ ] **Methodology transparency (before promotion)** — document the interval scoring + NWS qualitative-wind
      mapping + width penalty on `/right-wrong-ray` (+ refresh the stale `CLAUDE.md` scoring table).
      → **now tracked as R4 + R8** in the audit register (+ R5 adds actuals-provenance disclosure).
- [ ] **Capture-quality monitoring** — alert when a source's coverage drops (this regression went unnoticed
      for weeks). → **now tracked as R3** in the audit register.

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
- [ ] **DSI vs Sweater Index number reconciliation (decision pending).** The two "today" numbers come from
      different sources (see the 2026-07-01 source report in the visual-pass PR): either reconcile to one
      source or label the difference explicitly on-page. Data coherence is the brand.
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

## To do — content / distribution
- [ ] Instagram automation (Graph API posting).
- [ ] Weekly summary workflow + graphic.
- [ ] "Woolcam": JideTech 4K 8MP PoE bullet camera (built-in RTMP → YouTube). Not set up.

## SEO / performance / accessibility (audited 2026-07-01)
Multi-agent audit + Lighthouse (production, mobile). **SEO = 100** (the promotion-readiness metadata/JSON-LD/
sitemap work nailed it — nothing to do). **Best Practices 96.**
- [x] **Perf — hero LCP fixed (PR #87, merged + live).** Lighthouse was Performance **70** with **LCP 19.7s**
      (CLS 0, TBT 30ms otherwise great). Cause: the hero iPhone screenshot was a **2.8MB** PNG shown at 150px;
      `prepare_public.mjs` now resizes it with sharp to an **18KB WebP** and `IphoneShot` loads it eager/high-
      priority. Result on prod: **LCP 19.7s → 5.0s, Performance 70 → 78.**
  - [ ] Residual perf (diminishing returns, real users already ~1-2s): LCP still 5.0s / FCP 2.7s under Lighthouse's
        aggressive mobile throttle → font loading (display swap/preload) + render-blocking. Optional.
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
