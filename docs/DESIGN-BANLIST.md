# Design banlist — DavesSweater

Append-only. A device listed here has been flagged by the owner and does not come
back — that is the whole point of the list. Seeded 2026-08-31 while wiring the
shared design gate (`~/Projects/shared-skills/design-gate/`); this file is layer 1's
cheapest half and the gate's judgment layer reads it directly, ahead of a full
`docs/DESIGN-STANDARD.md` existing.

## Banned devices

- **Middots (`·`) as a data-line separator.** Pipes, with spaces around them —
  `A | B | C`. **The standard, in the words that first set it** (`CHECKLIST.md`,
  "Right/Wrong Ray v2 + brand standards — DONE 2026-07-02, owner-directed,
  pre-traffic"): *"data-line separators are pipes ('|'), swept site-wide."*
  It has **drifted back twice** since — most recently caught during the widget's
  cross-origin verification, where the embeddable card rendered `TODAY | JUL 28`
  two lines above `Sunrise 6:24 AM · Sunset 8:41 PM · Waxing gibbous, 99% lit`,
  one card contradicting its own separator grammar inside one box
  (`CHECKLIST.md`, "Separator standard re-swept, and made enforceable —
  2026-07-28"). That pass converted 8 sites across 5 files and grew
  `scripts/copy_lint.py` a `SEPARATOR` rule (error) so the drift is caught
  mechanically now, not just by re-reading the live page.
  **Two exemptions, both deliberate, both anchored narrowly:**
  - a middot **opening an `<li>`** is a hand-rolled bullet glyph, not a
    separator (the fireworks report's venue-logistics and observed-record
    lists — nothing sits to its left of it);
  - **next/og share cards** (`opengraph-image.tsx` / `twitter-image.tsx`) are
    satori-rasterized poster art running their own display typography, outside
    the site's own separator grammar.

  Full citation: `CLAUDE.md` § "Development" → copy-lint paragraph; `CHECKLIST.md`
  lines documenting the 2026-07-02 standard and the 2026-07-28 re-sweep.
