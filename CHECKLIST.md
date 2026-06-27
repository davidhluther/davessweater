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
      `ChartReveal`/`WhyTimeline` built; `whyStats` helper; `npm test`/lint/`build` green. Aurora deferred.
- [ ] **M3 #3 — N-source viz** — surface the 7 new forecasters; still gated on them accruing enough scored days.

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
- [ ] **R6 — The 7 "gated" new sources render publicly** via `UpcomingForecasts` (no allowlist;
      `page.tsx:141`, `UpcomingForecasts.tsx:18-21`). Apply the scoreboard allowlist / one shared min-days
      gate. *(Quick win — effort S.)*
- [x] **R4 — methodology now visible — DONE 2026-06-26 (uncommitted).** New `/methodology` page
      (`src/app/methodology/page.tsx`): the 5-field 100-pt model with exact tolerances, coverage normalization,
      the NWS qualitative-wind mapping, grade bands, actuals provenance, and links to `scoring.py` + `data/` to
      recompute. Fixed the stale `/right-wrong-ray` caption (now 5 fields + a "Full methodology →" link); footer
      "How we score it" repointed to `/methodology`. Build green, verified in preview.
- [~] **R5 — Open-Meteo graded against its own archive** — **disclosure DONE 2026-06-26** (the `/methodology`
      "What counts as actual" section states the Open-Meteo-archive provenance + the self-judging circularity
      plainly). Remaining (future/larger): cross-validate actuals vs NWS/station + stand up the Ecowitt
      ground-truth station so the "actual" is independent (M6 hardware).
- [ ] **R3 — No capture-quality / coverage-drop monitoring** (the Ray-regression class). All capture steps
      `continue-on-error`; compare never exits nonzero. Add a post-compare guard that fails the job on a
      coverage drop / missing expected source / source count < N, + a predictions↔comparisons parity test.
      *(Replaces the standalone "capture-quality monitoring" item below.)*

**🟡 Medium:**
- [ ] **R7 — Silent missing-actuals dropped 2026-05-22 (green workflow); + 2 ghost empty rows.** Make
      missing-actuals loud + retried + backfill sweep; backfill 05-22; stop writing empty comparisons; delete
      the 2 ghost rows (`2026-03-03`, `2026-06-18`).
- [x] **R8 — `CLAUDE.md` scoring section refreshed — DONE 2026-06-26 (uncommitted).** Repointed at
      `scripts/scoring.py`, corrected the wind row (interval + 0.5 width tax), split precip into type(10, partial
      credit)+amount(10, snow-aware), and added the coverage-normalization note. The on-site `/methodology` page
      (R4) is the public-facing synced description.
- [ ] **R9 — Concurrent compare + `-X ours` merge footgun** (benign today, latent). Add a `concurrency:` group
      / rebase-and-retry; add `reset --hard origin/main` to `daily_capture`.
- [ ] **R11 — OWM/Met.no day-0 low is the partial-bucket min, not the calendar-day low** (gated now → low
      public impact, but **MUST fix before un-gating** those sources). Forfeit day-0 low or score next-day.
- [ ] **R12 — Snow-depth scoring has never graded a real day** (0/478; the 2 Ray snow days used the legacy
      model). Replay a past Boone snow event before surfacing any snow column / winter claim.

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
