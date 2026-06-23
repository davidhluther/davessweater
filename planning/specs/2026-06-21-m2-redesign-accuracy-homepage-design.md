# M2 — Modern Redesign + Accuracy Homepage (Design Spec)

**Date:** 2026-06-21
**Status:** Approved design, pre-plan
**Milestone:** 2 of the "migrate + grow into a Ray's-Weather-class site" program. Follows M1 (Next.js port).

## Goal

Give Dave's Sweater an original, modern visual identity and rebuild the homepage as a
**conversion-focused front door** that lands the core joke *backed by data* the moment a
(mostly mobile) visitor arrives: the free forecasts (Open-Meteo, Apple Weather) **beat the paid
one** (Ray's), proven over 100+ days of tracked scoring. Establish a reusable design system and
apply it across every page. **Presentation only — the Python data pipeline and scoring are
untouched.**

Legal-safety constraint (from CHECKLIST): original brand; share only the **teal/orange palette**
and the **local-weather genre** with Ray's. **Not a Ray's clone.**

## Scope

**In scope (M2):**
- A design system — tokens (teal/orange scale, dark surfaces, neutrals, spacing, radius), a display
  typeface, and restyled shared components.
- Homepage rebuilt as the front door (six sections below).
- Apply the system across **all** routes: `/`, `/right-wrong-ray`, `/blog` (+ `/blog/[slug]`),
  `/videos`, `/shop` — one cohesive, mobile-first look.
- Add a **5-day mini-outlook** to the live-conditions island.
- Mobile-first responsive behavior site-wide, including converting wide data tables to **stacked
  cards** on phones.

**Out of scope (later milestones / separate tasks):**
- Radar/maps, Woolcam, photo-of-the-day (M4); multi-location (M5); Ecowitt station ground-truth (M6).
- Any change to `capture_*.py`, `compare.py` (scoring), or `data/` formats.
- Sweater-scale recalibration (its own CHECKLIST item; copy may *reference* the scale, but the
  scoring fix is not part of M2).
- New routes / IA beyond restyling — the M1 route map stays as-is.

## Design direction

- **Style A on palette C.** Data-journalism layout (credible, numbers-forward — the data does the
  talking) rendered on a **bold dark-teal / orange palette** (moody, high-contrast). Chosen over a
  friendly weather-app look (buries the differentiator) and a full zine treatment (louder, higher
  maintenance). Decided with the owner via inline mockups.
- **Dark hero + dark feature-bands on a light body** — *not* a fully dark site. Punchy where it
  converts; legible long-form pages everywhere else.
- **The homepage is a front door, not a daily dashboard.** Optimize for first impression →
  click-through to the scoreboard. Daily-utility content is present but deliberately secondary.

## Design system

Extend (don't replace) the existing `src/app/globals.css` brand variables.

**Color tokens:**
- Teal scale anchored on brand `#3c5468`: `--teal-900 #26323d` (deepest surface / footer),
  `--teal-800 #2e4150`, `--teal-700 #33485a` (hero), `--teal #3c5468` (canonical brand),
  light tint `--teal-50 #eef3f6`.
- Orange `#f97316` (CTA / accent / the "Ray's-is-bad" flag); `--orange-600 #c2410c` for
  text-on-light.
- Semantic: green `#1d9e75` = "free / winning"; orange/amber = Ray's. Neutrals: body bg `#ffffff`,
  surface `#f5f7f9`, border `#e3e8ec`, text `#26323d`, muted `#5f6b75`.
- Keep the existing `0.75rem` radius base and the Tailwind 4 `@theme inline` token wiring.

**Typography:**
- Display: **Space Grotesk** (500/700) for headlines and big numbers, loaded via `next/font/google`
  (no layout shift).
- Body / UI: **Inter** (existing).

**Components** (restyle/extend; keep each small and single-purpose):
- `SiteHeader` — compact; mobile menu; the "Boone's most mostly reliable weather tracker and
  resource" tagline sits **beside the logo at the top of every page** (its current placement, kept).
  The strikethrough brand mark is a hero/eyebrow element, not the header.
- `SiteFooter` — methodology link + "not affiliated with Ray's" disclaimer + the "most mostly
  reliable" tagline.
- New: `Hero`, `ScoreboardBand` (3-way stat cards), `StatCard` / `BigNumber`, `TrendChart`,
  `HeadToHeadCard`, `IphoneFeature`, `CTAButton`, `SectionBand` (light/dark variants).
- `LiveConditions` island — extend with the 5-day mini-outlook.
- Data tables (`/right-wrong-ray`) — responsive: real table ≥ `md`, stacked cards < `md`.

## Information architecture

Routes are **unchanged from M1**. Only the homepage composition changes substantially; the other
pages are restyled with the new system. Header nav: **Today** (`/`), **Right/Wrong Ray**,
**Videos**, **Blog**, **Swag** — collapsed behind a menu on mobile.

## Homepage, section by section

All stats are **build-time-derived from `data/scores.json`** (and the latest comparison) — never
hardcoded — so they stay correct as the daily bot commits. Copy uses evergreen phrasings bound to
computed values (e.g. "{N} days", "20+ points") that won't drift.

1. **Hero (dark) — co-anchored by the data and the daily screenshot.** This is the screenshot's
   home: it leads, not a thumbnail below the fold.
   - Eyebrow: "Boone's #1 weather ~~service~~ tracker · {N} days on the record."
   - Headline: "The free forecast keeps beating the one you pay for."
   - `ScoreboardBand` — Open-Meteo {avg} / Apple {avg} / Ray's {avg} with W–L–M records, Ray's
     flagged orange.
   - The **latest iPhone screenshot, prominently** (`/screenshots/iphone_screenshot.png`) with a
     **source label** (real Apple Weather vs Open-Meteo-rendered) and **capture date**, plus the
     line "the only weather service you need is already in your pocket." Graceful empty-state if it
     isn't in yet (per current `ForecastCard` behavior).
   - Primary CTA → `/right-wrong-ray`; secondary "How we score it" → methodology.
   - **Reflow:** mobile leads headline → screenshot → scoreboard → CTA (screenshot up top); desktop
     is a split (data left, screenshot right).
2. **Trend proof (dark feature-band).** "It's not a fluke." A responsive line chart of per-day
   scores (free vs Ray's) from `scores.json.entries`, **handling missing days** (gaps, sweater-only
   entries). One-line takeaway reinforcing the consistent gap.
3. **Yesterday's head-to-head (light).** The Deep-Gap-style matchup from the latest comparison:
   Dave's Sweater (Open-Meteo) score vs Ray's, plus a "what actually happened" row. CTA to the full
   scoreboard. (Pulls forward the old-M3 homepage head-to-head.)
4. **Live conditions + 5-day outlook (light).** "Oh — and we do actual weather too." Current temp +
   sweater verdict (existing `LiveConditions` island) + a 5-day mini-outlook (Open-Meteo,
   client-side).
5. **Footer.**

## Mobile-first

Mobile is the likeliest traffic source (shared links, social), so the small screen is the primary
design target.
- Design ~360–390px first; enhance up to desktop.
- Single-column reflow; the scoreboard stays a tight 3-up row of small numbers; hero type scales.
- Tap targets ≥ 44px; full-width CTAs on phones.
- Header collapses nav behind a menu; brand line stays short.
- `/right-wrong-ray` tables become **stacked cards** below `md` (fixes a real weak spot of the
  current site).
- Trend chart responsive and legible; **no horizontal scroll anywhere**.

## Voice & copy (preserve the personality)

The credibility of the bit rests on tone + visible methodology — don't sand these off:
- **"Boone's most mostly reliable weather tracker and resource"** — the tagline **beside the logo at
  the top of every page** (kept in its current header placement), plus page `<title>` / meta.
- **"Boone's #1 weather ~~service~~ tracker"** — the **hero eyebrow** and a standalone brand lockup
  (the strikethrough does the joke). **"service" keeps the same font color as the surrounding text**
  — only the line-through marks it. A muted/gray strike would read as a meek "correction"; full-color
  keeps it deliberate and sharp. "tracker" is the accent word (orange) — the line's landing point.
- **"Boone's #2 weather resource"** — alt voice line, usable in body copy.
- **Throughline:** "He makes big promises and hopes nobody ever checks the numbers. Now somebody is."
- **"The only weather service you need is already in your pocket."** — iPhone feature.

Tone: **dry, wry, and sharp** — pointed and a little merciless with the data; do **not** soften it
into something cute, hedged, or over-friendly. The "never bitter" guardrail (CLAUDE.md) stays —
sharp, not sour — but **the edge is the brand**. Claims framed as **tracked data, not assertion**
(the receipts are exactly what earn the right to be this blunt).

## Data layer (source unchanged)

- All homepage numbers derived at **build time** from existing `data/scores.json` (`totals` +
  `entries`) and the latest `data/comparisons/{date}.json`, via the existing `src/lib` readers
  (extend as needed). No new pipeline, no `data/` schema change.
- **Computed, not hardcoded** — record, averages, day count, point gap, dead-last count — so they
  remain correct as the bot commits daily.
- Live conditions + mini-outlook: client-side Open-Meteo (existing `LiveConditions` pattern),
  `forecast_days=5`.
- iPhone screenshot served from `public/screenshots/` (existing `prepare_public.mjs` prebuild);
  empty-state fallback when absent.

## Daily automation & freshness

The homepage must stay current with **zero manual steps**, riding the pipeline that already exists.

**Already automatic (no new work):** `daily_capture.yml` (14:00 UTC) + `daily_compare.yml` commit
fresh `data/` to `main`; each push triggers a Vercel `next build`. So the scoreboard, season
averages, the trend history, yesterday's head-to-head, and (client-side) live conditions/outlook all
refresh daily by construction. M2 only has to *read the latest* — which it does.

**The screenshot — honest about its two sources.** A `iphone_screenshot.png` lands every day, but
provenance varies:
- Most days it's the **Open-Meteo-rendered fallback** (`capture_iphone_weather.py`, runs in
  `daily_capture.yml`) — auto, but not the real app.
- On days Dave runs the iPhone Shortcut, `upload_screenshot.yml` commits the **real Apple Weather
  screenshot** (the large files, e.g. 06-17, 06-21).

Therefore the hero screenshot must:
- Show **whichever is latest** (real if present, else fallback) so it's never empty.
- **Label the source** (real Apple Weather vs Open-Meteo-rendered) per the existing CLAUDE.md rule —
  no passing off the fallback as Apple.
- **Show the capture date** and degrade gracefully if a daily capture failed (e.g. today's
  `meta.json` shows only `openmeteo` captured) — surface the most recent good image and its date
  rather than claiming false freshness.
- `prepare_public.mjs` already selects the latest screenshot; M2 relies on that selection (a past
  source of bugs — verify it during implementation).

**Out of M2 scope:** truly automating the *real* Apple Weather screenshot daily (Shortcut
automation / automated capture). That's a pipeline task, tracked separately — M2 presents whatever
the pipeline provides, labeled honestly.

## SEO / analytics / accessibility

- Carry over from M1: title/description template, **both** GSC verification tags, GA, favicon /
  apple-touch-icon, `sitemap.xml`, `robots.txt`, OpenGraph. Refresh OG title/description (and image,
  if used) to the new hero.
- Accessibility: AA color contrast on dark bands; visible focus states; semantic headings; alt text
  on the screenshot + logo; the strikethrough brand line must read sensibly to screen readers (e.g.
  `<s>` markup or `aria-label` so it announces "weather tracker", not a garbled "service tracker").
- Performance: display font via `next/font` (no CLS); lightweight chart; lazy images.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hardcoded stats drift as the bot commits new data | Derive every number at build time; evergreen copy bound to computed values |
| Dark bands hurt contrast / legibility | AA contrast checks; keep long-form content on the light body |
| Wide tables unreadable on phones | Stacked-card pattern below `md` |
| Trend chart breaks on missing/sweater-only days | Explicit gap handling in the data reader + chart |
| Brand voice lost in a redesign | Voice & copy is an explicit acceptance item; review against CLAUDE.md tone |
| Scope creep into M4+ features | Explicit out-of-scope list above |

## Acceptance criteria

1. Homepage renders all five sections; hero stats, trend, and head-to-head all derive from
   `data/*.json` and refresh with the **daily commit → Vercel rebuild, no manual step**
   (**no hardcoded numbers**).
2. New visual identity (dark-teal/orange, Space Grotesk display + Inter body) applied across `/`,
   `/right-wrong-ray`, `/blog` (+ `[slug]`), `/videos`, `/shop`.
3. Mobile-first verified at ~375px: single column, ≥44px targets, menu nav, no horizontal scroll,
   `/right-wrong-ray` tables become cards.
4. The iPhone screenshot **leads the hero** (prominent, co-anchoring the data) with the "only
   service you need" copy, a **source label** (real Apple vs Open-Meteo-rendered) + **capture date**,
   a graceful fallback, and it refreshes automatically with the daily pipeline.
5. Trend chart shows free vs Ray's across the season and handles missing days.
6. Voice preserved: the strikethrough brand line, the "most mostly reliable" tagline, and the
   throughline quote are present.
7. SEO/analytics carried over (title, both GSC tags, GA, favicon, sitemap, robots; OG refreshed).
8. `next build` succeeds; a Vercel **preview** deploy is green and visually verified on **mobile and
   desktop**.
9. Python pipeline / scoring and `data/` formats untouched; daily capture still works.

## Spec location note

Per M1: specs live in top-level `planning/specs/` — **not** `docs/`, which is the repo's Vercel
output directory and would leak into the deployed site or get caught by the daily `git add`.
