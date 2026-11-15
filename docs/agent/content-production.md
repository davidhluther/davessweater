## Content production

The editorial pipeline predates the cross-project scaffold, so DS keeps its own
layout (no `output/` dir):

- **Guidelines stack:** the universal writing styleguide
  (`~/Projects/shared-skills/writing-styleguide.md`) auto-applies via
  `~/Projects/CLAUDE.md`; DS voice notes layer on top at `guidelines/seo/DS_VOICE.md`
  (DRAFT stub — the full stack per `planning/specs/2026-07-02-seo-aio-program-design.md`
  §7 adds `DS_CONTENT_STRUCTURE.md` + `DS_WRITING_QUALITY.md`, still to build).
- **Where content lives:** briefs → `planning/seo/briefs/`; working drafts →
  `planning/seo/drafts/`; published finals are native posts in `src/content/posts/`
  (rendered under `/resources/articles/`).
- **Shared content skills:** `~/Projects/shared-skills/seo/` is the canonical
  cross-project location (being populated by the SEO platform program) — check there
  before building content tooling locally.
- Program design: `planning/specs/2026-07-02-seo-aio-program-design.md`. Tasks
  (including the standing monthly report card) tracked in `CHECKLIST.md` as usual.

