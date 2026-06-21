# M1 — Next.js Port (Design Spec)

**Date:** 2026-06-21
**Status:** Approved design, pre-plan
**Milestone:** 1 of the larger "migrate + grow into a Ray's-Weather-class site" program.

## Goal

Move Dave's Sweater's **presentation layer** from the single-file Python generator
(`scripts/build_site.py` → `docs/index.html`) to a Next.js app matching the owner's other
projects — **at content/feature parity**, plus three deliberate upgrades (real pages, native
blog, embedded shop). The Python **data pipeline and scoring stay untouched.** This milestone
is the foundation that later milestones (real forecast experience, radar/cams, multi-location,
station ground-truth) build on.

## Scope

**In scope (M1):**
- Next.js scaffold like the owner's other repos (Next 16 / React 19 / TS / Tailwind 4 / shadcn).
- Port every piece of current content to the new app with visual + brand parity.
- Upgrade 1: hash tabs → real subfolder routes with working nav + deep links.
- Upgrade 2: blog rendered natively as DS's own blog (no Substack framing).
- Upgrade 3: swag shop browsing embedded on-site (checkout still hands off to Fourthwall).
- Rewire deployment/CI so Vercel builds with `next build` and the daily bot commits data only.

**Out of scope (deferred to later milestones):**
- New forecast features (current conditions, hourly, radar, webcams, photo-of-the-day) — M2/M4.
- Homepage head-to-head, methodology page, sweater-scale recalibration — M3.
- Multi-location pages — M5. (Routing is built to *accommodate* this, but only Boone/Deep Gap ships.)
- Fourthwall Storefront-API custom cart — blocked by the persistent 403; remains a roadmap item.
- Weather-station ground truth — M6.

## Stack & scaffolding

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui — mirror
  `~/Projects/my-site` and `pigasus-group` (same `AGENTS.md` Next-16 rules file, `components.json`,
  `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `next.config.ts`).
- **Respect Next.js 16 breaking changes** — read `node_modules/next/dist/docs/` before writing code
  (per the owner's standing `AGENTS.md` rule); do not rely on memorized Next APIs.
- Carry over brand + platform bits: teal `#3C5468`, orange `#f97316`, card `#F8F9FC`, Inter font,
  logo (`assets/logo.svg`), tagline "Boone's most mostly reliable weather tracker and resource",
  the "Updated: …" bar, footer. Preserve `favicon.ico`, `apple-touch-icon.png`, `docs/CNAME`
  (davessweater.com), GA tag `G-7XL0TZ4GSS`, and **both** Google site-verification meta tags.

## Information architecture (routes)

Today: one `index.html`, JS `data-tab` buttons toggle `.tab-panel` divs. New mapping:

| Route | Ported content (current source) |
|---|---|
| `/` | **Weather** — `build_sweater_section` (sweater verdict + 5-sweater scale) + `build_phone_forecast` (today's forecast) |
| `/right-wrong-ray` | `build_rightwrong_section` (yesterday's scored comparison) + `build_scoreboard_section` (season scoreboard) |
| `/blog` + `/blog/[slug]` | Native blog (see Feature 2) |
| `/videos` | `build_videos_section` (YouTube RSS) |
| `/shop` | Swag (see Feature 3) |

Header nav becomes real `<Link>`s to these routes with an active state. Route name
`/right-wrong-ray` chosen to match the brand (alternatives `/scoreboard`, `/accuracy` rejected).

## Data layer (source unchanged)

- Typed TS readers (e.g. `src/lib/data.ts`) read the repo's existing `data/*.json` at **build time**:
  `scores.json`, `comparisons/{date}.json`, `predictions/{date}/*.json`, `actuals/{date}.json`,
  `substack_feed.json`. Exact TS types are derived from `compare.py`'s outputs + sample data files
  during implementation (not guessed).
- Build-time fetches (mirroring current `build_site.py` behavior): YouTube RSS (videos) and the
  Fourthwall Merchant Center RSS (`/.well-known/merchant-center/rss.xml`, grouped by
  `item_group_id`). Substack is already pre-cached to `substack_feed.json` by `fetch_substack.py`.
- The site is **statically generated** — content changes only when the daily bot commits new
  `data/`. No runtime server/database. Pages use static generation (`generateStaticParams` for
  `/blog/[slug]`). RSS fetches that fail at build degrade gracefully (empty-state UI), matching
  today's `try/except` behavior.

## Feature 1 — Navigation → real subfolder pages

Replace the JS tab system with App Router routes (table above). Each route is its own page/segment;
nav links use `<Link>` with active styling. Deep links and back/forward work. This is a net SEO gain
(previously all content lived at `/` behind hash tabs; now there are crawlable pages). Keep `/` as
the home so existing equity is preserved.

## Feature 2 — Blog, natively integrated

- `/blog`: index of post cards (title, date, summary), newest first.
- `/blog/[slug]`: full post page rendering the RSS `content:encoded` HTML in DS's styling, with the
  in-post heading-anchor TOC behavior the current builder already produces. Slug derived from the
  post GUID (stable), falling back to a title slug.
- **Fully native — no Substack branding.** Remove "Substack" heading, "Read on Substack →" links,
  and any subscribe-to-Substack CTA. (Content is still *sourced* from the Substack RSS feed; it's the
  owner's own writing republished on his own site.) There is currently ~1 post; structure is built to
  scale to many.

## Feature 3 — Swag shop, embedded (honest ceiling)

- Keep the native product grid built from the Merchant Center RSS feed (name, image, price), grouped
  by `item_group_id` as today.
- **Change the click target:** instead of opening Fourthwall in a new tab, a product opens its
  **Fourthwall product page embedded in an on-site modal `<iframe>`** (Fourthwall supports iframing
  individual product pages), so browsing stays on DS. (A dedicated `/shop/[handle]` route is a
  possible later enhancement; M1 uses the modal so the grid stays the single shop page.)
- **Checkout hands off to Fourthwall** — unavoidable (Fourthwall's full shop/cart can't be embedded as
  a widget, and our Storefront-API path is 403'd, blocking a true on-site cart). Net result: embedded
  browsing, Fourthwall-hosted checkout. Keep the existing shop copy (dropship / $3-to-charity note).
- A custom on-site cart via the Storefront API stays a roadmap item pending the 403 fix.

## Deployment / CI cutover (do this so the live site never breaks)

**Phase A — build alongside (no production change):**
- Add the Next.js app to the repo but **do not** modify `vercel.json` or `.github/workflows/*` yet.
- The live site keeps shipping from `build_site.py` → `docs/` exactly as now.
- Develop via `next dev` locally and Vercel **preview** deploys on the `m1-nextjs-migration` branch.
- Rebase `main` into the branch periodically (the daily bot keeps committing `data/` to `main`;
  `data/` rarely conflicts with `app/`, so drift is low — but keep M1 reasonably short).

**Phase B — cutover (single PR, after preview verified):**
- `vercel.json`: set `framework: "nextjs"` and remove the `python` `buildCommand`/`outputDirectory`
  overrides (or point them at the Next build). **Verify Vercel project dashboard settings don't
  override** (Output Directory may be pinned to `docs`); set framework explicitly.
- `daily_compare.yml`: remove the `build_site.py` step; stop committing `docs/`; commit only `data/`.
  Move the Ray's screenshot copy from `docs/screenshots/` → `public/screenshots/` (or read from `data/`).
- Retire `build_site.py` (keep in history; optionally a `legacy/` note) once parity is confirmed.
- Promote only after a green preview deploy. Rollback = revert the cutover PR (build_site.py path still
  intact in history).

## What stays untouched

`capture_openmeteo.py`, `capture_rays.py`, `capture_iphone_weather.py`, `compare.py` (scoring),
`export_scores_csv.py`, `fetch_substack.py`, `daily_capture.yml`, and all `data/` formats. This
migration swaps presentation and *who builds the HTML* — nothing about data capture or scoring.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Daily bot commits to `main` → migration branch drifts | `data/` vs `app/` rarely conflict; rebase main in periodically; keep M1 short |
| Vercel dashboard settings override `vercel.json` at cutover | Verify on preview URL before promoting; set `framework` explicitly; rollback = revert PR |
| Build-time RSS (YouTube/Fourthwall) flaky during `next build` | Graceful empty states (as today); consider pre-caching to JSON in the Action later |
| SEO/analytics regression | Carry GA, both GSC tags, title/description, favicon, CNAME; keep `/`; add `sitemap`/`robots` |
| Screenshots not served after cutover | Bot writes them to `public/screenshots/` (or build copies from `data/`) |

## Acceptance criteria

1. New routes (`/`, `/right-wrong-ray`, `/blog`, `/blog/[slug]`, `/videos`, `/shop`) all render the
   corresponding current content; nav links + deep links + back/forward work.
2. Visual/brand parity: colors, Inter, logo, tagline, update bar, footer match today.
3. SEO/analytics carried over: title, meta description, both GSC verification tags, GA, favicon,
   apple-touch-icon, CNAME; plus `sitemap.xml` + `robots.txt`.
4. Blog reads as DS's own (no Substack framing); `/blog/[slug]` renders full post content.
5. Shop: native grid; product click opens embedded Fourthwall product page on-site; checkout
   redirects to Fourthwall.
6. `next build` succeeds; a Vercel **preview** deploy of the branch is green and visually verified.
7. Cutover PR flips Vercel to `next build` and trims the daily workflow to commit `data/` only;
   production verified post-promote; rollback path intact.
8. Python data pipeline + scoring untouched; daily capture still works.

## Spec location note

The brainstorming skill's default spec dir is `docs/`, but that's this repo's Vercel **output**
directory — specs live in top-level `planning/specs/` instead so they never leak into the deployed
site or get touched by the daily `git add docs/`.
