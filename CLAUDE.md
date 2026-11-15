# Dave's Sweater

Weather tracking site for Boone / Deep Gap, NC. Compares forecasts from Ray's Weather, Open-Meteo, and Apple Weather against verified actuals, then scores accuracy on a 100-point scale.

Live at **davessweater.com** (deployed via Vercel).

A Python data pipeline (stdlib) writes `data/*.json` through daily GitHub Actions. A Next.js 16 app in `src/` reads that JSON at build time. Satirical voice, real data: keep claims framed as tracked data.

> **Note for contributors:** There is additional background context (origin story, tone guidance, and copy direction) that is intentionally **kept out of this public repo**. If you're working locally and need it, ask the owner — it lives in a private/local context file, not in version control. Do not commit personal, political, third-party, or network/infrastructure details to this public repository.

## Must-know rules

**Read `AGENTS.md` before writing any code.** It holds the Next.js 16 rule: this Next differs from training data, so check `node_modules/next/dist/docs/` first.

**Merging to `main` triggers a Vercel production deploy.** Every push to `main` runs `next build` and goes live at davessweater.com. Work on a branch. Merge to `main` only after the owner says yes in chat for that merge; a request to ship is not that yes until the owner confirms it.

**Mobile check is mandatory (owner rule, 2026-07-08):** every UI change gets verified at iPhone width
before it ships — 390x844 viewport (via Chrome device emulation or `next start` + devtools), checking for
horizontal overflow, wrapping, and layout of the changed elements. The owner can't easily preview mobile;
the verifier is responsible for confirming it renders well on phones.

Other owner rules live in `docs/agent/design-type-scale.md`. Read it before any UI work.

- Type scale (owner rule, 2026-07-27): use the named `ds-*` classes. Never compose a fresh size and weight combo.
- Copy lint (owner rule, 2026-07-28): run `python3 scripts/copy_lint.py` before shipping UI copy. It blocks the test suite.
- Design gate: run it before any UI-touching PR. Exit 2 is not a pass.
- `CHECKLIST.md` is the single source of truth for outstanding work. Read it at the start and update it in the same change that finishes a task.
- Never edit scoring without reading `docs/agent/scoring.md` first.

## Task router

| Job | Read | Skip | Use | Save to |
|---|---|---|---|---|
| Run or debug the daily pipeline | `docs/agent/pipeline.md`, `docs/agent/scoring.md` | `src/`, `docs/agent/design-type-scale.md` | `scripts/capture_openmeteo.py`, `scripts/capture_rays.py`, `scripts/compare.py`, `scripts/scoring.py` | `data/`, or `scripts/` for a code fix |
| Change scoring or sweater logic | `docs/agent/scoring.md` | `src/`, `docs/agent/shop.md` | `scripts/scoring.py`, `scripts/compare.py`, `scripts/rescore_history.py` | `scripts/`, `data/comparisons/` |
| Edit site design or type | `docs/agent/design-type-scale.md`, `docs/DESIGN-BANLIST.md` | `data/` | `scripts/copy_lint.py`, `.design-gate.json` | `src/` |
| Write content or posts | `docs/agent/content-production.md`, `docs/agent/premise-voice.md` | `docs/agent/scoring.md` | `guidelines/seo/`, `data/scores.json`, `scripts/copy_lint.py` (see `docs/agent/design-type-scale.md`) | `src/content/posts/` |
| Deploy | `docs/agent/deployment.md` | `data/`, `docs/agent/scoring.md` | `vercel.json`, `scripts/prepare_public.mjs` | `main` (production) |
| Add a roadmap item | `docs/agent/roadmap.md` | `src/`, `scripts/` | `CHECKLIST.md` | `CHECKLIST.md` for scheduled work; the "Future Ideas" list in `docs/agent/roadmap.md` for unscheduled ideas |
| Work on the swag shop | `docs/agent/shop.md` | `data/`, `docs/agent/scoring.md` | `src/app/shop` | `src/app/shop` |

## Where moved detail lives

Detail moved word for word from this file into `docs/agent/`. Each file holds one job.

- `docs/agent/pipeline.md`: architecture, daily pipeline, Apple Weather data, implementation details, dev commands, coordinates.
- `docs/agent/scoring.md`: scoring system and sweater weather logic.
- `docs/agent/design-type-scale.md`: type scale, copy lint, design gate.
- `docs/agent/deployment.md`: hosting and build.
- `docs/agent/content-production.md`: guidelines stack and where content lives.
- `docs/agent/premise-voice.md`: premise and voice.
- `docs/agent/shop.md`: Fourthwall and the Merchant Center feed.
- `docs/agent/roadmap.md`: `CHECKLIST.md` rules and future ideas.
