# Dave's Sweater — content structure

Structural rules for the editorial pipeline (briefs → drafts → publish, `CLAUDE.md`
"Content production"). Layers on top of `DS_VOICE.md`; see `DS_WRITING_QUALITY.md`
for sentence-level rules. These are mechanical — a drafting session should be able
to follow them without re-deriving intent.

## Two content shapes

DS ships two different page shapes. Don't mix their conventions.

1. **Blog posts** (`src/content/posts/*.md`, rendered at `/resources/{category}/{slug}`) —
   the answer-first article pattern below.
2. **Franchise landing pages** (`src/app/reports/{slug}/page.tsx`, e.g. the fireworks
   and Grandfather Mountain Highland Games planners) — the franchise-page pattern
   further down. Hand-built React, not markdown; heavier interactive layer.

## Answer-first structure (blog posts)

Every post front-loads the answer, then earns it. Model: `is-rays-weather-accurate.md`,
`rays-weather-report-card-june-2026.md`.

1. **Quick-answer block first.** Open with the direct answer in plain language before
   any setup or scene-setting — the reader (and an AI answer engine) gets the verdict
   in the first 40–60 words, no scrolling required.
2. **Key takeaways** — a short bulleted or tabular summary near the top (see "Key
   takeaways" H2 in both existing posts), giving the atomic liftable facts an answer
   engine or skimmer needs without reading the body.
3. **Query fan-out via H2s.** Each H2 is a real question a reader would search
   ("How did Ray's Weather score in June 2026?"), answered in its own first 40–60
   words, then developed. One sub-question per H2; H3s break a big question into
   parts, not sub-topics.
4. **FAQ section, always last content section.** H2 "Frequently asked questions",
   each question as an H3, 30–50-word answers. Every post that has one emits
   `faqPage()` JSON-LD (see `src/lib/schema.ts`) — wired automatically in
   `src/app/resources/[category]/[slug]/page.tsx` whenever `post.faqs` is non-empty,
   so a post without a "Frequently asked questions" H2 silently loses the schema.
5. **Methodology / sourcing section** before the FAQ — how the number was produced,
   what it's scored against, and a link back to the scoreboard. Every post links
   both the live scoreboard (`/right-wrong-ray`) and `/methodology` (spec §7 /
   CLAUDE.md sourcing discipline) — that's the non-negotiable internal-link
   minimum, not optional flavor.

## Jump nav and section anchors

Longer posts and all franchise pages get an on-page table of contents:

- Native blog posts: automatic. `src/lib/data.ts` (`parseHeadings` / `buildToc` /
  `injectHeadingIds`) builds the TOC from H2/H3s and stamps heading `id`s; the
  post-detail page renders it as a collapsible nav whenever `post.toc.length > 1`.
  Nothing to hand-build — just write real H2/H3s.
- Franchise pages: hand-built jump nav in the hero (anchor buttons/links to each
  major section, e.g. `#forecast`, `#times`, `#spots`, `#faq`, `#method`), and every
  `<section>` carries a matching `id` plus `scroll-mt-20` so the anchor lands below
  the sticky header. See `fireworks-fourth-july-2026/page.tsx` for the reference
  shape (hero CTA row + a second-line text nav with `|` separators).

## Heading rules

- **Post titles: Title Case.** The H1 / frontmatter `title` / `<title>` metadata
  ("Ray's Weather Report Card: June 2026", "Is Ray's Weather Accurate? We Scored
  It for 118 Days").
- **H2/H3: sentence case.** First word and proper nouns/acronyms only capitalized —
  including after the post title. Title-case subheadings are an AI tell (see
  `DS_WRITING_QUALITY.md`); every existing post already follows this, keep it.
- Franchise-page section headers are the one sanctioned exception — those are
  landing-page labels ("Where to Watch Fireworks in Boone"), not article
  subheadings, and stay Title Case by design. Don't import that casing into a
  blog post H2, and don't flatten a franchise page's H2s to sentence case.

## Internal-linking expectations

- **Article mesh:** a new post links at least one other relevant post in the same
  category/cluster (report cards ↔ "how weather works" ↔ satire lane) — don't
  publish an orphan.
- **Main-page links, every post:** the live scoreboard (`/right-wrong-ray`) and
  `/methodology`, woven into a sentence per the anchor-text rule in
  `DS_WRITING_QUALITY.md` — never a bare "click here" or a trailing "Learn more →".
- **Franchise pages** additionally cross-link sibling franchises where relevant
  (the fireworks page links the GMHG planner and vice versa) and get an entry on
  the `/reports` hub — the hub is the internal-link spine tying report cards,
  scoreboard, methodology, and franchise pages together (spec §6.2).

## Franchise-page pattern (evergreen URL, annual re-verify)

One URL per franchise, reused year over year — not a new URL per edition:

- **URL is evergreen and year-stamped in the slug** when the event is annual
  (`/reports/fireworks-fourth-july-2026`,
  `/reports/grandfather-mountain-highland-games-planner-2026`) — the year moves
  when the event recurs; the route doesn't fork into a new pattern.
- **Annual re-verify, not a rebuild.** Each year's edition is a content refresh of
  the same template (dates, venues, verdicts, FAQ answers) — re-verify every
  hard-coded fact (dates, prices, official sources) before the season, don't
  assume last year's numbers still hold.
- **Template shape** (see `fireworks-fourth-july-2026/page.tsx`,
  `grandfather-mountain-highland-games-planner-2026/page.tsx`):
  1. Verdict/hero first — answer block plus hero CTA + jump nav, server-rendered.
  2. The report — the data body (matrix, schedule, computed times).
  3. Interactive layer as client islands that enhance, never gate — all verdicts
     exist in server-rendered HTML; islands (pickers, tabs, countdowns) sit on top.
  4. On-page methodology section — plain-language "how we compute this" + link to
     `/methodology`.
  5. FAQ block (question H2s, 30–50-word answers) with `FAQPage` schema, plus
     `Event`/`Dataset` schema and a pipeline-stamped `dateModified` where the page
     has one (see the `dateModified: todayStr` pattern in the fireworks page).
- Fail-closed: any module that can't reach its data source renders "unavailable,"
  never a stale number presented as current (spec §6.2 module contract).
