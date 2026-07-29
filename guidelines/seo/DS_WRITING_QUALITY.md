# Dave's Sweater — writing quality

Sentence- and claim-level rules for the editorial pipeline. This is a thin layer
on top of the universal styleguide — **it never loosens that baseline, only adds
DS-specific requirements on top.** Read the universal styleguide first:
`~/Projects/shared-skills/writing-styleguide.md`. See `DS_CONTENT_STRUCTURE.md` for
page-shape rules and `DS_VOICE.md` for tone.

## Validators

Two of them. The article validator judges a draft; the copy lint guards what is
already on the site.

**Drafts** — run before every draft is considered done:

```bash
python3 ~/Projects/shared-skills/seo/seo-validate/scripts/validate_article.py <draft.md>
```

**Shipped UI copy** — `scripts/copy_lint.py` (this repo), and it **blocks**:

```bash
python3 scripts/copy_lint.py
```

It reads the user-facing strings out of `src/` (JSX text, prose literals, metadata,
aria-labels, native posts) and errors on AP colon violations, lowercase
"label: value" skeletons, em-dashes in UI copy, middots used as data-line
separators, nav/category label sets that break Title Case, lowercase table cells and
stat captions, straight quotes in JSX, words running together at an element
boundary, and Tier 1 banned vocabulary.
`tests/test_copy_lint.py` runs it over the real tree, so a violation fails
`python3 -m pytest tests/` rather than waiting for the owner to catch it by reading
the page — which is what kept happening while these rules lived only in prose
(the styleguide's own 2026-07-18 changelog asks every project to adopt this check).
Its word lists come from the shared `style_rules.json`; it never forks a copy.
Warnings (colon budget, lowercase-after-colon fragments, markdown em-dash density)
are advisory and do not block — read them, don't ignore them.

Fixes the mechanical stuff — vocabulary bans, puffery, colon/em-dash counts,
repetition, blog-structure checks. Blocks on errors per spec §7 ("Validator...
runs locally per piece before merge"). It enforces the universal styleguide's Tiers
1–4; it does not (and cannot) check Tier 5 or the DS-specific rules below — those
need a human read.

## DS-specific rules (on top of the universal baseline)

These either sharpen a universal rule for DS's own conventions or add something
the universal validator has no way to check.

- **Dates: "Month D, YYYY" everywhere in rendered copy** — `fmtLongDate()` from
  `src/lib/dates.ts`, never a raw ISO string (`2026-07-02`) reaching the page.
  Short form "Mon D" (`fmtShortDate()`) only where space is genuinely tight (chart
  tooltips) — see `CLAUDE.md`. This is a render-layer rule as much as a writing
  one: format at the component boundary, not by hand-writing dates into copy.
- **Pipes as data separators — not em-dashes, not middots.** Scoreboard/stat lines
  use `|` between data points ("OM 92 | Ray's 67 | Apple 88"), matching the codebase
  convention (`TrendChartInteractive.tsx`, homepage headers). Keep prose em-dashes
  for the universal styleguide's normal use (≤1 per ~200 words); don't reach for
  one where a pipe belongs in a data line, and don't reach for a pipe inside a
  sentence. **Copy lint enforces this** (`SEPARATOR`): a middot in shipped copy,
  literal or `&middot;`, is an error. The standard was set 2026-07-02 and swept
  site-wide, then drifted back twice — by 2026-07-28 the embeddable widget card
  read "TODAY | JUL 28" two lines above "Sunrise 6:24 AM · Sunset 8:41 PM", so one
  card contradicted itself. Two exemptions, both narrow: a middot **opening an
  `<li>`** is a hand-rolled bullet glyph (the fireworks report's logistics and
  observed-record lists), and **next/og share cards** (`opengraph-image.tsx`,
  `twitter-image.tsx`) are rasterized poster art with their own display typography.
- **Em-dashes minimized further than the universal ceiling where a plainer option
  exists.** The universal cap (≤1 per ~200 words) is the outer bound, not a
  target — prefer a period or comma first; spend the em-dash only when nothing
  else reads as naturally.
- **No emojis in prose** (already universal Tier 4) — DS extends this to on-page
  UI copy too: buttons, captions, nav labels. The README's 🧣 and workflow-name
  emojis (`.github/workflows/*.yml` names like "📸 Daily Capture") are the
  sanctioned exception — operational/file-identification labels, not prose.
- **Smart quotes at render, not source.** Write straight quotes in source markdown
  (universal Tier 4 mechanic); typographic quotes/apostrophes are a render-time
  concern (the markdown pipeline), never hand-typed into a draft. Don't "fix" a
  draft by pasting curly quotes into it.
- **Every claim is tracked data with a traceable number.** DS's whole credibility
  rests on this (`CLAUDE.md` premise section): a stat in a post must trace to
  `data/scores.json` or a sibling data file, not to a vibe. If a number can't be
  traced to the dataset, don't publish it as a claim — describe the trend
  qualitatively instead, per the universal Craft baseline's "every statistic gets
  a named, verifiable source" rule. For DS that source is almost always "our own
  dataset, N days" — name the N.
- **Satire lane: sharp, never bitter.** Ray's Weather is the named symbol of gated
  expertise, credited wherever the data credits him (a day he scores well gets
  said plainly). The bit is pointed at a business model, not a person — no
  personal jabs, no implying incompetence beyond what the scored data shows. If a
  line reads more like a jab than a data point, cut it or reframe it as the
  finding it's based on.
- **Tier 5 (structural authenticity) is applied at the outline stage, not as a
  polish pass** — the universal styleguide is explicit that post-hoc editing
  barely moves detection. Before drafting: decide where the piece leaves something
  unresolved, where it names a real specific thing instead of a vague allusion,
  and where it breaks from a uniform rhythm. Retrofitting these into a finished
  draft doesn't work; plan them into the brief.

## What NOT to duplicate here

Everything already covered by the universal styleguide (vocabulary bans, opener
phrases, colon/semicolon limits, heading case, paragraph length, series
conjunctions, arrow bans, anchor-text rules, Tier 5 principles in full) lives
there — this file only adds what's DS-specific or under-specified upstream. If a
rule isn't listed above, the universal file's version applies as-is.
