### Type scale (owner rule, 2026-07-27)

Headings, kickers, and captions use the named `ds-*` classes defined in
`src/app/globals.css` (`@layer components`). **Never compose a fresh
size+weight combo** — that is how the site ended up with ten different card
titles and the owner's "different fonts and sizes and bolding" complaint.

| Class | Renders | Use for |
|---|---|---|
| `ds-h1` | Space Grotesk bold, 3xl → 4xl at `sm` | The page title. One per page. |
| `ds-h2` | Space Grotesk bold, 2xl | A section heading — opens a band or a major block. |
| `ds-h3` | Space Grotesk bold, lg → xl at `sm` | A card or module title. |
| `ds-h4` | Space Grotesk bold, base | A heading nested inside a card: FAQ question, venue, table group. |
| `ds-kicker` | bold, xs, uppercase, tracked | The eyebrow label above a title. |
| `ds-stat` | Space Grotesk bold, 2xl → 3xl at `sm`, tabular-nums | The numeric readout a module exists to state. |
| `ds-body` | sm | Body prose. The site's body size is `sm`, not `base`; add `text-muted` for secondary prose. |
| `ds-caption` | xs, muted | A footnote, caption, or source line. |

- **Color is a call-site decision**, so one token works on both treatments:
  `text-orange-300` / `text-white/70` on the dark teal bands, `text-orange-600` /
  `text-muted` on the light body. Orange stays brand/editorial only (M2 rule).
- **Deliberate one-offs** take a utility on the same element (`ds-stat text-4xl`).
  Tailwind sorts `utilities` after `components`, so the utility wins — and leave a
  comment saying why. Current exceptions: the `LiveConditions` temperature
  (largest readout on the site), the `/widget` embed (its own compact scale — it
  renders inside other people's pages), the GMHG print one-pager (forced to serif
  by `.gmhg-print`), and the dense `FiveDayStrip` day cards.
- **Not kickers:** inline badges/chips and dense-grid micro-labels. `ds-kicker` is
  for titling labels only.
- Article prose headings live in `PostBody.tsx` as arbitrary variants
  (`[&_h2]:…`), which can only compose utilities — they mirror the scale by hand.
  Keep them in sync.

**Copy lint — run before shipping UI copy; it blocks the test suite (owner rule, 2026-07-28):**

```bash
python3 scripts/copy_lint.py            # the shipped copy: src/app, src/components, src/content
python3 scripts/copy_lint.py --dump     # every user-facing string it can see
```

`scripts/copy_lint.py` pulls the user-facing strings out of the codebase (JSX text nodes, prose
string literals, metadata titles/descriptions, aria-labels, native posts) and enforces the
mechanically-decidable parts of the writing styleguide: AP colon capitalization, lowercase
"label: value" skeletons, em-dashes in UI copy, middots where a data-line separator must be a pipe,
Title Case across nav/category label sets, capitalized table cells and stat captions, straight
quotes in JSX, words that run together at an element boundary, and the Tier 1 banned vocabulary
(the pipe standard was set 2026-07-02 and had drifted back twice before the lint rule landed
2026-07-28; a middot opening an `<li>` and next/og share-card art are the two exemptions).
`tests/test_copy_lint.py` runs it over the
real `src/` tree and **fails pytest on any error**, because the rules existed as prose for months
and the owner still kept catching violations by reading the live page. Banned-word lists are read
from the canonical shared `style_rules.json` (`~/Projects/shared-skills/seo/seo-validate/data/`),
never copied in. The rule list and its reasoning live in the script's docstring; the DS-specific
notes are in `guidelines/seo/DS_WRITING_QUALITY.md`.

One rule worth knowing before you write JSX: a text node that carries an HTML entity **and** wraps
across source lines loses its leading space at build time, so `<em>range</em> is scored ...
5&ndash;15 mph` ships as "rangeis scored". Use an explicit `{" "}` at that boundary. The linter
catches it; verified against a production build (Next 16 / SWC).

**Design gate before any UI-touching PR.** Run the shared design gate
(`~/Projects/shared-skills/design-gate/`) on the routes the PR changed:

```bash
python3 ~/Projects/shared-skills/design-gate/scripts/design_gate.py \
  --config .design-gate.json --routes /the,/routes,/you,/changed
```

Same standing as `vitest` in the definition of done. Exit 1 = FAIL. **Exit 2
means it could not run — nothing was measured, and that is not a pass.** Then
the judgment pass, by an agent that did NOT build the page: hand it
`.design-gate/judgment-packet.md` and the design system, and withhold your
reasoning for the change. Any severity-1 blocks the PR. If the feature
legitimately needs a new pattern, the PR updates `docs/DESIGN-STANDARD.md` in
the same change with the reasoning — new work FITS the template or CHANGES it
deliberately; divergence-by-omission is the failure mode this kills.
**Judgment layer status (2026-08-31): mechanical only is wired.** Layer B
switches on once `docs/DESIGN-STANDARD.md` and a named `reference_page` exist
(`CHECKLIST.md` § "NEXT BUILD: design/template consistency gate") — layer 1
comes first by design, per that section's ordering note.

