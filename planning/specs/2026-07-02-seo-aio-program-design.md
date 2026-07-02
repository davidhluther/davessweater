# SEO/AIO Program — Design

**Date:** 2026-07-02 · **Status:** approved pending owner review · **Owner:** Dave
**Companion docs:** the Master Idea Tracker (Google Doc, to be adopted in-repo as `IDEAS.md` — see §11) is the *content strategy*; this spec is the *engine* that researches, produces, and measures it. `CHECKLIST.md` remains the task tracker.

## 1. Objective & success metrics

Rank davessweater.com. Energy split: **50% accuracy niche · 25% daily Boone forecast queries · 25% AI visibility (AIO/AEO)**. Audience/links/distribution is owner-owned and out of scope here (feeds in via the tracker's citation-graph plan).

Success measures, baselined in week 1:

- **Accuracy niche (C1):** top-3 for a defined accuracy-query set (~90 days after indexation). Ground truth: GSC position data.
- **Boone forecast queries (C2):** rising impressions + average position in GSC; realistic v1 target is cracking page 2 by fall (NWS/weather.com/Ray's hold page 1 short-term). Won by daily-refreshed forecast **pages**, not posts.
- **AI visibility:** DS cited/named in AI-assistant answers on the tracker's §5.3 prompt set; measured by a logged monthly prompt battery (personal-side tooling only — IP wall).

## 2. Provenance — what we port and from where

| Asset | Source | Adaptation |
|---|---|---|
| Four-lens audit (keyword gap / content gap / backlink gap / AI visibility) | `~/Projects/corpay-seo-strategy/docs/competitive-intelligence-pipeline/README.md` | Single-brand; lenses run against raysweather.com + generic weather incumbents |
| Baseline freshness gates | `corpay-seo-strategy/lib/baseline-freshness-gate.md` | Same multipliers off a 14-day heartbeat |
| AEO content rubric (14-point) + article template (40-word answer block, question H2s, FAQ, comparison table) | `corpay-seo-strategy/guidelines/aeo-content-checklist.md`, `corpay-seo/.claude/skills/seo-draft/SKILL.md` | Kept nearly verbatim; tone layer replaced with DS voice |
| 25-check validator | `corpay-seo/.claude/skills/seo-validate/scripts/validate_article.py` + `data/style_rules.json` | Rules JSON swapped for DS voice/links; Corpay/Contentful checks dropped |
| Writing quality / anti-AI-tell rules | `~/Projects/shared-skills/writing-styleguide.md`, `corpay-seo/guidelines/CORPAY_WRITING_QUALITY_RULES.md` | Bans kept; B2B tone rules dropped |
| Guideline-stack pattern (voice / structure / quality) | `corpay-seo/guidelines/*`, proven portable by `~/Projects/fuelman-seo` | Three DS guideline files (§7) |
| Reddit research skill | `shared-skills/reddit-brand-visibility-skill.md` | Pointed at r/boone, r/appstate |
| Visibility dashboard pattern (5-KPI weekly) | `corpay-seo-strategy/dashboard/` | Rebuilt DS-native as a **public** page (§9); no Sheets/Apps Script |

**Explicitly not ported:** Contentful/docx/OneDrive publishing, Monday sync, FTC compliance layer, multi-brand profiles/governance, Ahrefs Brand Radar (v1), the corpay dashboard infrastructure.

## 3. Decisions log (owner, 2026-07-01→02)

1. Goal split 50/25/25 as above; audience-building owner-owned.
2. Content engine: **hybrid** — programmatic data pages + ~1 editorial piece/week.
3. Content home: **native-first** on davessweater.com; Substack becomes distribution (excerpt + link back).
4. Ray's-brand queries: **full send** — comparative pages *and* navigational intercepts, while R10 (trademark counsel) remains open on `CHECKLIST.md`; mitigation = every claim data-traceable, honest satire framing. (Tracker §6 separately gates *paid ads* on the C1 definitive post + attorney consult — unchanged.)
5. Approach: **two-phase hybrid** — audit + first content wave now; institutionalize trimmed skills after.
6. Fireworks slug: **`/fireworks`**, built as a landing page (§6.3).

## 4. Data sources & fingerprint policy

**Sources in play:** GSC (`sc-domain:davessweater.com`, personal account) · GA4 (DS tag) · Ahrefs API · Semrush API · Screaming Frog (local crawls of DS + raysweather.com) · Lighthouse · Reddit MCP · Google autocomplete + People-Also-Ask · AI prompt battery (manual, logged) · the DS pipeline's own Open-Meteo/actuals archive as *content* data · **Bing Webmaster Tools (new, DS-owned — Bing feeds ChatGPT search)**.

**Fingerprint rule (hard):** shared work tooling (Ahrefs, Semrush) is **read-only API queries only**. Never create for DS in those workspaces: Rank Tracker projects, Brand Radar reports, keyword lists, site-audit projects, tracking campaigns. Consequences:

- **Brand Radar is out for v1** (it requires a configured workspace report). The prompt battery is the AIO measurement.
- **Rank tracking = GSC position data** (primary, free, ours) + sparing Ahrefs `serp-overview` spot-checks.
- Every research run logs its Ahrefs unit spend in the run artifact (corpay artifact-catalog habit). Target ≤ a few hundred units/cycle; full lens sweep ≈ 15–25 calls.
- Anything persistent lives in DS-owned properties: GSC, GA4, Bing WMT, this repo.
- Prompt battery runs on personal accounts/devices only (tracker §5.3 "IP wall").

## 5. Research phase (Phase 1a) — validate C1–C14, don't invent

The tracker already defines keyword clusters C1–C14. Research **quantifies and prioritizes** them:

1. **Keyword lens:** per cluster, Ahrefs matching-terms/keywords-explorer (question filters on) + volumes/KD; GSC overlay (what DS already ranks/impresses for); Semrush cross-check on the head terms. Output: `planning/seo/keyword-map.md` — cluster → target URL → priority (volume × winnability × strategic weight), with C1 beachhead first.
2. **Content lens:** SERP-shape checks on priority queries (who ranks, what format wins); raysweather.com content inventory via Screaming Frog; autocomplete/PAA expansion appended to the map.
3. **Backlink lens:** raysweather.com referring domains via Ahrefs → `planning/seo/link-targets.md` (local news, App State, chambers, outdoors) — handed to owner; no outreach from this program.
4. **AI-visibility lens:** baseline prompt battery — the tracker's §5.3 set plus ~10 more across C1/C2/C11 — logged to `planning/seo/prompt-battery/2026-07.md` with per-assistant results.
5. **Voice-of-customer:** Reddit skill over r/boone + r/appstate; language mined feeds titles/FAQs.

Artifacts are dated, carry a data-source + unit-cost stamp, and sit behind the freshness gate (14-day heartbeat; gap lenses ~49d; re-runs reuse fresh artifacts).

## 6. Site architecture

### 6.1 Sections (pages, not posts — tracker §6)

- **`/accuracy` hub:** the C1 pillar = the tracker's "money post" ("We scored Ray's Weather for N days. Here's the data.") — one definitive page; plus eight `/accuracy/{source}` forecaster reviews ("Is Ray's Weather accurate?" is the flagship navigational intercept, name in title/H1); monthly report cards (§6.2) as the supporting archive.
- **C2 forecast pages:** daily-refreshed "Boone weather" page family (DSI/today + accuracy record + structured data), town-level programmatic pages (Blowing Rock, Banner Elk, Valle Crucis, Deep Gap, …), and 12 evergreen "Boone weather in {month}" pages off the 474-day history.
- **Blog stays `/blog`**, native posts added alongside the Substack mirror (§7); `/dispatches` stays walled if/when it exists.

### 6.2 Reports & recurring series

The tracker's §4 series become a first-class surface:

- **URL-pattern archives per franchise** (doc convention kept): `/report-card/2026-07`, `/weekend/2026-10-09`, annual-reuse event pages (`/fireworks`). One pattern per franchise; archives crawlable.
- **`/reports` hub:** indexes every franchise (current edition + archive), gets a nav slot, and is the internal-link spine (report cards ↔ scoreboard ↔ methodology ↔ franchise pages). New franchises (Leaf-o-Meter, Snow Day Index, Wool Index, rivers) are added as entries, not IA changes.
- **Module contract (non-negotiable, tracker §6):** every data asset's build emits the standardized status blob `{asset, verdict, headline_number, detail, timestamp}` to the shared registry directory so the Weekend Outlook later assembles itself. Fail-closed everywhere: a module that can't reach its source renders "unavailable," never stale-as-current.

### 6.3 Franchise landing-page template (fireworks = instance #1)

Every franchise page is a **landing page**, one shape:

1. **Verdict first:** answer block ≤40 words + headline number/gauge (server-rendered).
2. **The report:** the data body — for `/fireworks`: multi-town matrix (Boone, Blowing Rock, Beech, Banner Elk, Elk Park, Tweetsie), computed dusk ("shows ≈ 9:15–9:30 PM"), hourly 8–11 PM cloud/precip/wind.
3. **Interactive layer as client islands, never gating content:** all verdicts/answers exist in server-rendered HTML (tracker §5.5); islands enhance — town picker/tabs, countdown-to-dusk (client ticks off the build-time timestamp; no runtime API), hover/tap detail. Reduced-motion + a11y per site standards (AA, axe-clean).
4. **On-page methodology:** plain-language "how we compute this" section (for fireworks: the astral dusk math, Open-Meteo hourly source, fail-closed rule) + link to `/methodology`. Self-grading receipts where the franchise has history.
5. **FAQ block** (question H2s/H3s, 30–50-word answers) + schema: Event (where applicable), FAQPage, Dataset for series with data, `dateModified` stamped by the pipeline.

**Handoff to the P-FIREWORKS session:** slug `/fireworks`; follow this template; emit the module blob; server-rendered answers; sitemap entry. This program adds (decoupled, after it ships): `/reports` hub entry, nav, holiday-window homepage link, methodology cross-links.

### 6.4 Blog taxonomy

Category = front-matter field; each category gets an index page (own metadata, `CollectionPage` + `BreadcrumbList`), acting as a hub for its cluster. Lanes map to the tracker: **Report Cards & Accuracy** (C1/§4) · **How Weather Works** (C5/C6 authority spine) · **Build Log** (C7) · **The Genre** (C8 satire lane) · **Seasons & Events** (C12/C13/C14). Existing Substack-mirrored posts get tagged into the same taxonomy. Final names confirmed against the Phase-1a clustering.

## 7. Editorial pipeline (~1/week)

Brief → draft → validate, ported:

- **Three DS guideline files** (`guidelines/seo/`): `DS_VOICE.md` (dry, wry, data-backed; sharp never bitter; satire-lane rules from tracker §6), `DS_CONTENT_STRUCTURE.md` (AEO template: 40-word answer block, question H2s sentence-case, FAQ, comparison table, internal-link minimums, atomic liftable facts near the top), `DS_WRITING_QUALITY.md` (anti-AI-tell bans; citation standards — every stat traceable, which for DS usually means *our own dataset*).
- **Validator:** `validate_article.py` adapted into the repo (`scripts/seo/validate_article.py` + `style_rules.json`); internal links checked against a generated DS page index; Corpay/CMS checks removed; runs locally per piece before merge.
- **Briefs** generated from the keyword map (cluster, target query set, SERP shape, VoC language, internal-link plan).
- **Publishing:** native pages/MDX in the repo; Substack gets excerpt + canonical link back. Blog posts carry Article schema and always link scoreboard + methodology (tracker §6).

## 8. AIO layer (merged with tracker §5)

- **Originate data → earn citations:** Dataset schema on scoreboard/franchise pages, public CSV/JSON score endpoints (CSV export exists; add stable URLs), public repo as crawler diet, `/methodology` as flagship AEO asset.
- **Extraction shape:** atomic liftable facts placed near the top of pillars; query fan-out (one H2 per sub-question, answer in first 40–60 words); answers outside JS-gated components.
- **Freshness moat:** pipeline stamps `dateModified` and refreshes current-status lines daily at zero marginal cost.
- **Crawlability:** server-rendered HTML; do not block GPTBot/ClaudeBot/PerplexityBot/CCBot in robots; add `llms.txt` pointing at methodology + scoreboard + pillars.
- **Measurement:** monthly prompt battery (§5.4 artifact), personal-side only. Brand Radar reconsidered only if DS ever warrants paid SOV tracking outside the work workspace.

## 9. Institutionalized skills (Phase 2, in-repo `.claude/skills/`)

1. **`ds-seo-research`** — four-lens run, freshness-gated, emits dated artifacts + unit-cost stamp, updates keyword map.
2. **`ds-seo-draft`** — brief → draft under the three guideline files.
3. **`ds-seo-validate`** — runs the validator; blocks on errors.
4. **`ds-visibility-snapshot`** — weekly GSC pull + serp spot-checks + latest prompt-battery results (battery itself runs monthly, §8) → JSON (module-contract blob included) → renders the **public visibility page** (the transparency bit, applied to ourselves).

Each skill updates `CHECKLIST.md` on completion.

## 10. Cadence & sequencing (aligned to tracker §7)

- **Weekly:** visibility snapshot · one editorial piece.
- **Monthly:** Ray's Report Card auto-publishes (`/report-card/{yyyy-mm}`) — doubles as the measurement ritual; prompt battery re-run.
- **~Quarterly:** full lens re-runs per freshness multipliers.
- **Now (July):** `/fireworks` lands (other session) → hub/nav/homepage linkage here · Phase-1a cluster validation · C2 "boone weather" page family design.
- **August:** C1 definitive post drafted through the new pipeline (also the precondition for any Ray's-adjacent ad spend, with counsel — tracker §6) · report-card franchise starts.
- **Sept–Oct:** leaf/snow clusters ride the tracker's critical path; this program supplies briefs, validation, and the landing template.

## 11. IDEAS.md adoption

Bring the Master Idea Tracker into the repo as `IDEAS.md` (canonical, CC-maintained; the Google Doc becomes the browser-side mirror, per the doc's own "Owed" item). Division of authority: `IDEAS.md` = what to build (content roadmap) · this spec = how the engine works · `CHECKLIST.md` = task state.

## 12. Risks & constraints

- **Full-send Ray's targeting** while R10 counsel is open — owner-accepted 2026-07-01; mitigations: claims data-traceable, satire framing honest, ads separately gated (§3.4).
- **Shared Ahrefs workspace** — read-only rule + unit logging (§4); small, visible, defensible draw.
- **Generic weather queries** — long game by design; accuracy niche is the wedge; C2 won by page quality + freshness + accuracy receipts over time.
- **Substack duplication** — native-first with canonical control; mirror posts tagged, excerpted going forward.
- **Module contract discipline** — every new data asset must emit the blob from day one or the Weekend Outlook retrofit costs six rewrites (tracker §6).
- **Fail-closed** — house rule inherited everywhere.

## 13. Out of scope

Paid ads (owner; separately gated) · link outreach/distribution (owner) · Brand Radar v1 · Contentful/docx/OneDrive machinery · multi-brand governance · the Ecowitt station (tracked in `CHECKLIST.md` as M6).
